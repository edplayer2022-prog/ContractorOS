begin;

create table public.company_subscriptions (
  company_id uuid primary key references public.companies(id) on delete cascade,
  plan text not null default 'free' check(plan in('free','starter','pro','business')),
  status text not null default 'free' check(status in('free','trialing','active','past_due','canceled','incomplete')),
  trial_started_at timestamptz, trial_ends_at timestamptz,
  current_period_start timestamptz, current_period_end timestamptz,
  cancel_at_period_end boolean not null default false, canceled_at timestamptz,
  grace_ends_at timestamptz, legacy_access boolean not null default false,
  pending_plan text check(pending_plan in('free','starter','pro','business')), pending_effective_at timestamptz,
  stripe_customer_id text unique, stripe_subscription_id text unique, last_provider_event_at bigint not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index subscriptions_lifecycle_idx on public.company_subscriptions(status,current_period_end,trial_ends_at);
create index subscriptions_plan_idx on public.company_subscriptions(plan);
create table public.subscription_usage (
  company_id uuid not null references public.companies(id) on delete cascade,
  period_start date not null, estimates_created integer not null default 0 check(estimates_created>=0),
  primary key(company_id,period_start)
);
create table public.subscription_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id), event_type text not null,
  old_plan text, new_plan text, provider_event_id text unique, metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index subscription_events_company_idx on public.subscription_events(company_id,created_at desc);
alter table public.company_subscriptions enable row level security;
alter table public.subscription_usage enable row level security;
alter table public.subscription_events enable row level security;
revoke all on public.company_subscriptions,public.subscription_usage,public.subscription_events from anon,authenticated;
grant select on public.company_subscriptions,public.subscription_usage,public.subscription_events to authenticated;
create policy subscription_owner_read on public.company_subscriptions for select to authenticated using(public.active_member_role(company_id) in('owner','admin'));
create policy usage_owner_read on public.subscription_usage for select to authenticated using(public.active_member_role(company_id) in('owner','admin'));
create policy subscription_events_owner_read on public.subscription_events for select to authenticated using(public.active_member_role(company_id) in('owner','admin'));

-- Preserve the full existing feature set. This is internal legacy access, NOT a paid subscription.
insert into public.company_subscriptions(company_id,legacy_access) select id,true from public.companies;
insert into public.subscription_usage(company_id,period_start,estimates_created)
select company_id,date_trunc('month',created_at at time zone 'UTC')::date,count(*) from public.estimates group by 1,2;
create function public.initialize_company_subscription() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.company_subscriptions(company_id)values(new.id) on conflict do nothing;return new;end $$;
create trigger a_initialize_subscription after insert on public.companies for each row execute function public.initialize_company_subscription();

create function public.effective_company_plan(target_company uuid) returns text language sql stable security definer set search_path=public as $$
select coalesce((select case
 when legacy_access then 'business'
 when status='trialing' and trial_ends_at>now() then 'pro'
 when status='past_due' and grace_ends_at>now() then plan
 when status in('active','canceled') and current_period_end>now() then plan
 else 'free' end from public.company_subscriptions where company_id=target_company),'free');
$$;
create function public.plan_feature(plan_name text,feature text) returns boolean language sql immutable set search_path=public as $$
select case
 when feature='advanced_permissions' then plan_name='business'
 when feature in('estimates.unlimited','customer_links','digital_approval') then plan_name in('starter','pro','business')
 when feature in('digital_signatures','change_orders','projects','invoices','payments','reports','financial_reports','team_members','audit_log','advanced_analytics') then plan_name in('pro','business')
 else false end;
$$;
create function public.plan_user_limit(plan_name text) returns integer language sql immutable set search_path=public as $$
select case plan_name when 'business' then 10 when 'pro' then 3 else 1 end;
$$;
create function public.has_company_plan_feature(target_company uuid,feature text) returns boolean language sql stable security definer set search_path=public as $$
select public.is_active_company_member(target_company) and public.plan_feature(public.effective_company_plan(target_company),feature);
$$;
-- Copy the role policy, preserving the original function OID used by existing RLS policies.
do $$begin execute replace(pg_get_functiondef('public.has_company_permission(uuid,text)'::regprocedure),'FUNCTION public.has_company_permission(', 'FUNCTION public.role_has_company_permission(');end $$;
create or replace function public.has_company_permission(target_company_id uuid,permission_name text) returns boolean language plpgsql stable security definer set search_path=public as $$
declare feature text;
begin
 if not public.role_has_company_permission(target_company_id,permission_name) then return false;end if;
 feature:=case when permission_name='reports.view' then 'reports' when permission_name='reports.financial' then 'financial_reports'
 when permission_name='team.manage' then 'team_members' when permission_name='estimates.send' then 'customer_links'
 when permission_name~'\.(create|edit|send|delete|record)$' and split_part(permission_name,'.',1)in('projects','project_costs','invoices','payments','change_orders')
 then case when split_part(permission_name,'.',1)='project_costs' then 'projects' else split_part(permission_name,'.',1) end else null end;
 return feature is null or public.plan_feature(public.effective_company_plan(target_company_id),feature);
end $$;

create function public.subscription_log(target_company uuid,event_name text,old_value text,new_value text,details jsonb default '{}') returns void language plpgsql security definer set search_path=public as $$
begin
 insert into public.subscription_events(company_id,user_id,event_type,old_plan,new_plan,metadata)values(target_company,auth.uid(),event_name,old_value,new_value,details);
 perform public.write_audit(target_company,event_name,'subscription',target_company,jsonb_build_object('old_plan',old_value,'new_plan',new_value)||details);
end $$;
create function public.refresh_subscription(target_company uuid) returns void language plpgsql security definer set search_path=public as $$
declare s public.company_subscriptions;
begin
 select * into s from public.company_subscriptions where company_id=target_company for update;
 if s.status='trialing' and s.trial_ends_at<=now() then
  update public.company_subscriptions set plan='free',status='free',updated_at=now() where company_id=target_company;
  perform public.subscription_log(target_company,'trial_expired','pro','free');
 elsif s.status in('active','canceled') and s.current_period_end<=now() and s.stripe_subscription_id is null then
  update public.company_subscriptions set plan='free',status='free',cancel_at_period_end=false,updated_at=now() where company_id=target_company;
  perform public.subscription_log(target_company,'subscription_period_ended',s.plan,'free');
 end if;
 -- Pending downgrades never grant access. Provider-backed changes require a verified provider event.
 if s.pending_plan is not null and s.pending_effective_at<=now() and s.stripe_subscription_id is null
 and (select count(*) from public.company_members where company_id=target_company and status='active')<=public.plan_user_limit(s.pending_plan) then
  update public.company_subscriptions set plan='free',status='free',pending_plan=null,pending_effective_at=null,updated_at=now() where company_id=target_company;
  perform public.subscription_log(target_company,'plan_downgraded',s.plan,'free');
 end if;
end $$;
create function public.get_subscription_access() returns jsonb language plpgsql security definer set search_path=public as $$
declare c uuid; s public.company_subscriptions; role_name public.member_role; start_date date;
begin
 select company_id into c from public.users where id=auth.uid();role_name:=public.active_member_role(c);
 if role_name is null then raise exception 'Active membership required';end if;
 perform public.refresh_subscription(c);select * into s from public.company_subscriptions where company_id=c;
 start_date:=date_trunc('month',now() at time zone 'UTC')::date;
 return (to_jsonb(s)-array['company_id','stripe_customer_id','stripe_subscription_id','last_provider_event_at'])||jsonb_build_object(
 'effective_plan',public.effective_company_plan(c),'server_now',now(),'period_start',start_date,'period_end',(start_date+interval '1 month')::date,
 'estimates_created',case when role_name in('owner','admin') then coalesce((select estimates_created from public.subscription_usage where company_id=c and period_start=start_date),0) else null end,
 'active_team_members',case when role_name in('owner','admin') then (select count(*)from public.company_members where company_id=c and status='active') else null end,
 'pending_invites',case when role_name in('owner','admin') then (select count(*)from public.team_invitations where company_id=c and accepted_at is null and revoked_at is null and expires_at>now()) else null end);
end $$;
create function public.start_pro_trial() returns void language plpgsql security definer set search_path=public as $$
declare c uuid; s public.company_subscriptions;
begin
 select company_id into c from public.users where id=auth.uid();if public.active_member_role(c) is distinct from 'owner' or c is null then raise exception 'Owner required';end if;
 select * into s from public.company_subscriptions where company_id=c for update;
 if s.trial_started_at is not null or s.legacy_access or s.status<>'free' or s.stripe_subscription_id is not null then raise exception 'Trial is not available';end if;
 update public.company_subscriptions set plan='pro',status='trialing',trial_started_at=now(),trial_ends_at=now()+interval '14 days',updated_at=now() where company_id=c;
 perform public.subscription_log(c,'trial_started','free','pro');
end $$;
create function public.schedule_free_downgrade() returns void language plpgsql security definer set search_path=public as $$
declare c uuid;s public.company_subscriptions;
begin
 select company_id into c from public.users where id=auth.uid();if public.active_member_role(c) is distinct from 'owner' or c is null then raise exception 'Owner required';end if;
 select * into s from public.company_subscriptions where company_id=c for update;
 if s.stripe_subscription_id is not null then raise exception 'Use the billing provider to change a paid subscription';end if;
 if s.legacy_access then raise exception 'Legacy access is managed internally and will not be removed here';end if;
 update public.company_subscriptions set pending_plan='free',pending_effective_at=coalesce(trial_ends_at,current_period_end,now()),cancel_at_period_end=true,canceled_at=now(),updated_at=now()where company_id=c;
 perform public.subscription_log(c,'subscription_canceled',s.plan,'free');
end $$;
create function public.resume_local_subscription() returns void language plpgsql security definer set search_path=public as $$
declare c uuid;s public.company_subscriptions;
begin
 select company_id into c from public.users where id=auth.uid();if public.active_member_role(c) is distinct from 'owner' or c is null then raise exception 'Owner required';end if;
 select * into s from public.company_subscriptions where company_id=c for update;
 if s.stripe_subscription_id is not null then raise exception 'Use the billing provider';end if;
 if coalesce(s.trial_ends_at,s.current_period_end,now())<=now()then raise exception 'This subscription period has ended';end if;
 update public.company_subscriptions set pending_plan=null,pending_effective_at=null,cancel_at_period_end=false,canceled_at=null,updated_at=now() where company_id=c;
 perform public.subscription_log(c,'subscription_resumed',s.plan,s.plan);
end $$;

-- Atomic, server-clock usage. Deleting an estimate does not restore its monthly allowance.
create function public.enforce_estimate_subscription() returns trigger language plpgsql security definer set search_path=public as $$
declare p text;used integer;month_start date;
begin
 perform 1 from public.company_subscriptions where company_id=new.company_id for update;
 p:=public.effective_company_plan(new.company_id);
 if tg_op='INSERT' then
  month_start:=date_trunc('month',now() at time zone 'UTC')::date;
  insert into public.subscription_usage(company_id,period_start)values(new.company_id,month_start)on conflict do nothing;
  select estimates_created into used from public.subscription_usage where company_id=new.company_id and period_start=month_start for update;
  if p='free' and used>=3 then raise exception 'You have reached your Free plan limit of 3 estimates this month. Upgrade Plan.';end if;
  update public.subscription_usage set estimates_created=estimates_created+1 where company_id=new.company_id and period_start=month_start;
 end if;
 if (tg_op='INSERT' and (new.public_token is not null or new.status in('sent','viewed'))) or
 (tg_op='UPDATE' and ((new.public_token is distinct from old.public_token and new.public_token is not null) or (new.status='sent' and old.status is distinct from new.status))) then
  if not public.plan_feature(p,'customer_links') then raise exception 'Customer estimate links are available on Starter. Upgrade Plan.';end if;
 end if;
 if new.status='approved' and (tg_op='INSERT' or old.status is distinct from new.status) and not public.plan_feature(p,'digital_approval') then raise exception 'Digital approval is available on Starter. Upgrade Plan.';end if;
 return new;
end $$;
create trigger subscription_estimates before insert or update on public.estimates for each row execute function public.enforce_estimate_subscription();

create function public.enforce_paid_record() returns trigger language plpgsql security definer set search_path=public as $$
declare c uuid;feature text;before_row jsonb;after_row jsonb;
begin
 c:=case when tg_op='DELETE' then old.company_id else new.company_id end;
 feature:=case when tg_table_name in('project_costs','projects') then 'projects' when tg_table_name in('invoice_items','invoices')then 'invoices' when tg_table_name like 'change_order%' then 'change_orders' else 'payments' end;
 -- Public view/expiry tracking must continue for historical documents after downgrade.
 if tg_op='UPDATE' and tg_table_name in('invoices','change_orders') then
  before_row:=to_jsonb(old)-array['view_count','first_viewed_at','last_viewed_at','updated_at','status','expired_at'];
  after_row:=to_jsonb(new)-array['view_count','first_viewed_at','last_viewed_at','updated_at','status','expired_at'];
  if before_row=after_row and (new.status=old.status or new.status::text in('viewed','expired','overdue')) then return new;end if;
 end if;
 if not public.plan_feature(public.effective_company_plan(c),feature) then raise exception '% is read-only on your current plan. Upgrade to Pro to make changes.',feature;end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
do $$declare t text;begin foreach t in array array['projects','project_costs','invoices','invoice_items','payments','change_orders','change_order_items']loop
 execute format('create trigger subscription_write_guard before insert or update or delete on public.%I for each row execute function public.enforce_paid_record()',t);
end loop;end $$;
create function public.enforce_approval_subscription() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not public.plan_feature(public.effective_company_plan(new.company_id),'digital_approval')then raise exception 'Digital approval is unavailable for this company';end if;
 if new.signature_type::text='drawn' and not public.plan_feature(public.effective_company_plan(new.company_id),'digital_signatures')then raise exception 'Drawn signatures require Pro. Use a typed approval.';end if;
 return new;
end $$;
create trigger subscription_approval_guard before insert on public.estimate_approvals for each row execute function public.enforce_approval_subscription();

create function public.enforce_subscription_seats() returns trigger language plpgsql security definer set search_path=public as $$
declare p text;seats integer;pending integer;limit_count integer;target_email text;
begin
 if tg_table_name='company_members' then
  if tg_op='UPDATE' and new.status<>'active' and new.role=old.role then return new;end if;
 else
  if tg_op='UPDATE' and (new.accepted_at is not null or new.revoked_at is not null)then return new;end if;
 end if;
 perform 1 from public.company_subscriptions where company_id=new.company_id for update;
 p:=public.effective_company_plan(new.company_id);limit_count:=public.plan_user_limit(p);
 -- Existing roles remain valid after downgrade, but changing advanced roles requires Business.
 if tg_table_name='company_members' then
  if tg_op='UPDATE' and new.role is distinct from old.role and not public.plan_feature(p,'advanced_permissions')then raise exception 'Role management requires Business';end if;
  if tg_op='UPDATE' and new.status=old.status then return new;end if;
  if new.status<>'active' then return new;end if;
 end if;
 target_email:=new.email;
 select count(*)into seats from public.company_members where company_id=new.company_id and status='active' and (tg_table_name<>'company_members' or id<>new.id);
 select count(*)into pending from public.team_invitations where company_id=new.company_id and accepted_at is null and revoked_at is null and expires_at>now()
 and (tg_table_name<>'team_invitations' or id<>new.id)
 and not(tg_table_name='company_members' and lower(email)=lower(target_email));
 if seats+pending>=limit_count then raise exception 'Your % plan includes up to % team members. Upgrade Plan.',initcap(p),limit_count;end if;
 if seats>0 and not public.plan_feature(p,'team_members')then raise exception 'Team collaboration requires Pro';end if;
 if seats>0 and new.role<>'admin' and not public.plan_feature(p,'advanced_permissions')then raise exception 'Pro collaborators use the Admin role. Advanced roles require Business.';end if;
 return new;
end $$;
create trigger subscription_seat_guard before insert or update on public.company_members for each row execute function public.enforce_subscription_seats();
create trigger subscription_invitation_guard before insert or update on public.team_invitations for each row execute function public.enforce_subscription_seats();

-- All entitlement writers are private; only explicitly listed RPCs are callable by users.
revoke all on function public.effective_company_plan(uuid),public.subscription_log(uuid,text,text,text,jsonb),public.refresh_subscription(uuid),public.initialize_company_subscription(),public.enforce_estimate_subscription(),public.enforce_paid_record(),public.enforce_approval_subscription(),public.enforce_subscription_seats() from public,anon,authenticated;
revoke all on function public.get_subscription_access(),public.start_pro_trial(),public.schedule_free_downgrade(),public.resume_local_subscription(),public.has_company_plan_feature(uuid,text),public.role_has_company_permission(uuid,text) from public,anon;
grant execute on function public.get_subscription_access(),public.start_pro_trial(),public.schedule_free_downgrade(),public.resume_local_subscription(),public.has_company_plan_feature(uuid,text),public.role_has_company_permission(uuid,text) to authenticated;
commit;
