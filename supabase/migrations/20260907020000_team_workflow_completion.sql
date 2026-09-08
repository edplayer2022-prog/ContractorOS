begin;
create or replace function public.accept_team_invitation(raw_token text) returns jsonb language plpgsql security definer set search_path=public as $$
declare invitation public.team_invitations;actual_email text;begin if auth.uid() is null then raise exception 'Authentication required';end if;select email into actual_email from auth.users where id=auth.uid();select * into invitation from public.team_invitations where token_hash=encode(extensions.digest(raw_token,'sha256'),'hex') for update;if invitation.id is null then raise exception 'Invitation not found';end if;if invitation.revoked_at is not null then raise exception 'Invitation revoked';end if;if invitation.accepted_at is not null then raise exception 'Invitation already used';end if;if invitation.expires_at<=now() then raise exception 'Invitation expired';end if;if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)then raise exception 'Confirm your email before accepting';end if;if lower(actual_email)<>lower(invitation.email) then raise exception 'Sign in with the invited email';end if;if exists(select 1 from public.company_members where company_id=invitation.company_id and user_id=auth.uid())then raise exception 'Membership already exists. Ask an Owner to reactivate or change your role';end if;insert into public.company_members(company_id,user_id,role,status,email,display_name,invited_by,invited_at,accepted_at)values(invitation.company_id,auth.uid(),invitation.role,'active',invitation.email,trim(concat_ws(' ',invitation.first_name,invitation.last_name)),invitation.invited_by,invitation.invited_at,now());update public.team_invitations set accepted_at=now() where id=invitation.id;update public.users set company_id=invitation.company_id where id=auth.uid();perform public.write_audit(invitation.company_id,'team_invitation_accepted','company_member',auth.uid(),jsonb_build_object('role',invitation.role));return jsonb_build_object('company_id',invitation.company_id,'role',invitation.role);end $$;

-- A PM can read approved estimates and project-level financial summaries, not company reports.
create or replace function public.has_company_permission(target_company_id uuid,permission_name text) returns boolean
language sql stable security definer set search_path=public as $$
select case public.active_member_role(target_company_id)
when 'owner' then true
when 'admin' then permission_name=any(array['dashboard.view','customers.view','customers.create','customers.edit','customers.delete','estimates.view','estimates.create','estimates.edit','estimates.send','estimates.delete','rate_library.view','rate_library.manage','projects.view','projects.create','projects.edit','change_orders.view','change_orders.create','change_orders.send','invoices.view','invoices.create','invoices.send','payments.view','payments.record','project_costs.view','project_costs.create','reports.view','reports.financial','team.view','team.manage','settings.company','financial.internal_costs','financial.profit','financial.margin','financial.revenue','financial.project_summary','audit.view'])
when 'estimator' then permission_name=any(array['dashboard.view','customers.view','customers.create','customers.edit','estimates.view','estimates.create','estimates.edit','estimates.send','rate_library.view','financial.internal_costs'])
when 'project_manager' then permission_name=any(array['dashboard.view','customers.view','estimates.view','projects.view','projects.edit','change_orders.view','change_orders.create','change_orders.send','invoices.view','invoices.create','invoices.send','project_costs.view','project_costs.create','financial.internal_costs','financial.project_summary'])
when 'employee' then permission_name=any(array['dashboard.view','assigned_projects.view'])
else false end;
$$;
drop policy estimates_role_select on public.estimates;
create policy estimates_role_select on public.estimates for select using(public.has_company_permission(company_id,'estimates.view') and (public.active_member_role(company_id)<>'project_manager' or status='approved'));
-- PM invoice creation requires a project; company-wide standalone billing remains Owner/Admin.
create or replace function public.validate_pm_invoice() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if public.active_member_role(new.company_id)='project_manager' and new.project_id is null then raise exception 'Project Managers must invoice a project';end if;
 return new;
end $$;
create trigger validate_pm_invoice before insert on public.invoices for each row execute function public.validate_pm_invoice();
-- Keep historical events visible in the unified audit page.
insert into public.audit_events(company_id,user_id,user_name,event_type,entity_type,entity_id,metadata,created_at)
select company_id,user_id,user_name,event_type,coalesce(entity_type,case when change_order_id is null then 'estimate' else 'change_order' end),coalesce(entity_id,change_order_id,estimate_id),metadata,created_at from public.estimate_events e
where not exists(select 1 from public.audit_events a where a.company_id=e.company_id and a.event_type=e.event_type and a.created_at=e.created_at);
insert into public.audit_events(company_id,user_id,user_name,event_type,entity_type,entity_id,metadata,created_at)
select company_id,user_id,user_name,event_type,coalesce(entity_type,case when payment_id is not null then 'payment' when invoice_id is not null then 'invoice' else 'project' end),coalesce(entity_id,payment_id,invoice_id,project_id),metadata,created_at from public.financial_events e
where not exists(select 1 from public.audit_events a where a.company_id=e.company_id and a.event_type=e.event_type and a.created_at=e.created_at);

-- INSERT RETURNING is evaluated before the AFTER INSERT owner-membership trigger.
-- This temporary onboarding read disappears as soon as a membership exists.
create or replace function public.is_new_company_creator(target_company uuid,creator uuid) returns boolean
language sql stable security definer set search_path=public as $$
select creator=auth.uid() and not exists(select 1 from public.company_members where company_id=target_company);
$$;
create policy company_onboarding_returning on public.companies for select to authenticated using(public.is_new_company_creator(id,owner_id));
commit;
