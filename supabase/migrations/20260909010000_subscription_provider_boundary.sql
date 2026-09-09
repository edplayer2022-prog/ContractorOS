begin;
create function public.claim_subscription_customer(target_company uuid,customer text) returns text language plpgsql security definer set search_path=public as $$
declare result text;
begin
 if customer !~ '^cus_[a-zA-Z0-9]+$' then raise exception 'Invalid customer';end if;
 select stripe_customer_id into result from public.company_subscriptions where company_id=target_company for update;
 if not found then raise exception 'Subscription not found';end if;
 if result is null then update public.company_subscriptions set stripe_customer_id=customer where company_id=target_company;result:=customer;end if;
 return result;
end $$;
create function public.apply_subscription_provider_event(target_company uuid,provider_event text,provider_created bigint,provider_type text,customer text,subscription_id text,next_plan text,next_status text,period_start timestamptz,period_end timestamptz,cancel_at_end boolean,provider_trial_end timestamptz default null)
returns void language plpgsql security definer set search_path=public as $$
declare s public.company_subscriptions;event_name text;
begin
 select * into s from public.company_subscriptions where company_id=target_company for update;
 if s.company_id is null or s.stripe_customer_id is distinct from customer then raise exception 'Unknown billing customer';end if;
 if s.stripe_subscription_id is not null and s.stripe_subscription_id<>subscription_id and s.status not in('canceled','free','incomplete') then raise exception 'Another subscription already exists';end if;
 if provider_event !~ '^evt_[a-zA-Z0-9]+$' or subscription_id !~ '^sub_[a-zA-Z0-9]+$' or next_plan not in('starter','pro','business') or next_status not in('active','trialing','past_due','canceled','incomplete') or period_end<=period_start then raise exception 'Invalid provider state';end if;
 if exists(select 1 from public.subscription_events where provider_event_id=provider_event)then return;end if;
 if provider_created<s.last_provider_event_at then
  insert into public.subscription_events(company_id,event_type,provider_event_id,metadata)values(target_company,'stale_provider_event_ignored',provider_event,jsonb_build_object('provider_type',provider_type));return;
 end if;
 event_name:=case when provider_type='invoice.payment_failed' then 'subscription_payment_failed' when provider_type='invoice.payment_succeeded' then 'subscription_payment_succeeded'
 when next_status='canceled' or (cancel_at_end and not s.cancel_at_period_end) then 'subscription_canceled'
 when not cancel_at_end and s.cancel_at_period_end then 'subscription_resumed'
 when next_plan<>s.plan then case when array_position(array['free','starter','pro','business'],next_plan)>array_position(array['free','starter','pro','business'],s.plan)then 'plan_upgraded' else 'plan_downgraded'end else 'subscription_synchronized' end;
 update public.company_subscriptions set plan=next_plan,status=next_status,stripe_subscription_id=subscription_id,current_period_start=period_start,current_period_end=period_end,
 cancel_at_period_end=cancel_at_end,canceled_at=case when cancel_at_end or next_status='canceled' then coalesce(canceled_at,now()) else null end,
 trial_ends_at=case when next_status='trialing' then provider_trial_end else trial_ends_at end,
 grace_ends_at=case when next_status='past_due' then coalesce(case when s.status='past_due' then s.grace_ends_at end,now()+interval '7 days')else null end,
 legacy_access=false,last_provider_event_at=provider_created,updated_at=now(),pending_plan=null,pending_effective_at=null where company_id=target_company;
 insert into public.subscription_events(company_id,event_type,old_plan,new_plan,provider_event_id,metadata)values(target_company,event_name,s.plan,next_plan,provider_event,jsonb_build_object('provider_type',provider_type));
 perform public.write_audit(target_company,event_name,'subscription',target_company,jsonb_build_object('old_plan',s.plan,'new_plan',next_plan,'provider_event_id',provider_event));
end $$;
revoke all on function public.claim_subscription_customer(uuid,text),public.apply_subscription_provider_event(uuid,text,bigint,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_subscription_customer(uuid,text),public.apply_subscription_provider_event(uuid,text,bigint,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) to service_role;
commit;
