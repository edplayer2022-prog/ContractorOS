begin;

-- This helper is private. Its caller has already checked the workflow permission
-- (or a customer token). Do not reintroduce the legacy owner-only restriction.
create or replace function public.record_estimate_event(
  target_estimate_id uuid, target_event text, event_metadata jsonb default '{}'::jsonb,
  target_change_order_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare target_company uuid;
begin
  select company_id into target_company from public.estimates where id = target_estimate_id;
  if target_company is null then raise exception 'Estimate not found'; end if;
  insert into public.estimate_events(company_id, estimate_id, change_order_id, event_type, metadata)
  values (target_company, target_estimate_id, target_change_order_id, target_event, coalesce(event_metadata, '{}'::jsonb));
end;
$$;
revoke execute on function public.record_estimate_event(uuid,text,jsonb,uuid) from public, anon, authenticated;

-- Read the project's tenant without exposing its financial columns to employees.
create or replace function public.can_read_project_membership(target_project uuid, target_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = target_project and public.is_active_company_member(p.company_id)
      and (public.has_company_permission(p.company_id, 'projects.view') or target_user = auth.uid())
  );
$$;
revoke execute on function public.can_read_project_membership(uuid,uuid) from public, anon;
grant execute on function public.can_read_project_membership(uuid,uuid) to authenticated;
drop policy if exists project_members_project_read on public.project_members;
create policy project_members_project_read on public.project_members for select to authenticated
using (public.can_read_project_membership(project_id, user_id));

commit;
