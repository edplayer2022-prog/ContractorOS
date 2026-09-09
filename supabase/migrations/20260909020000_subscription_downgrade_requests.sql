begin;
-- A request is NOT a provider-confirmed downgrade and never changes entitlements.
alter table public.company_subscriptions add column downgrade_requested_at timestamptz;
create function public.request_plan_downgrade(target_plan text) returns jsonb language plpgsql security definer set search_path=public as $$
declare c uuid;s public.company_subscriptions;occupied integer;limit_count integer;
begin
 select company_id into c from public.users where id=auth.uid();
 if public.active_member_role(c) is distinct from 'owner' then raise exception 'Owner required';end if;
 if target_plan is null or target_plan not in('free','starter','pro')then raise exception 'Invalid downgrade plan';end if;
 select * into s from public.company_subscriptions where company_id=c for update;
 if s.legacy_access then raise exception 'Legacy access is managed internally';end if;
 if array_position(array['free','starter','pro','business'],target_plan)>=array_position(array['free','starter','pro','business'],s.plan)then raise exception 'Choose a lower plan';end if;
 select count(*)into occupied from public.company_members where company_id=c and status='active';
 occupied:=occupied+(select count(*)from public.team_invitations where company_id=c and revoked_at is null and accepted_at is null and expires_at>now());
 limit_count:=public.plan_user_limit(target_plan);
 update public.company_subscriptions set pending_plan=target_plan,pending_effective_at=null,downgrade_requested_at=now(),updated_at=now()where company_id=c;
 perform public.subscription_log(c,'downgrade_requested',s.plan,target_plan,jsonb_build_object('occupied_seats',occupied,'required_seats',limit_count));
 return jsonb_build_object('occupied_seats',occupied,'max_users',limit_count,'seats_to_free',greatest(0,occupied-limit_count),'provider_confirmation_required',true);
end $$;
revoke all on function public.request_plan_downgrade(text)from public,anon;
grant execute on function public.request_plan_downgrade(text)to authenticated;
commit;
