begin;
-- Remove the creator-based bypass; every company read/update now uses active membership.
drop policy if exists "owners manage company" on public.companies;
create policy companies_signup_insert on public.companies for insert to authenticated with check(owner_id=auth.uid());
revoke delete,truncate on public.companies from anon,authenticated;
revoke update on public.users from anon,authenticated;
grant update(full_name,phone,avatar_url) on public.users to authenticated;

create or replace function public.protect_company_identity() returns trigger language plpgsql as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id then
    raise exception 'Company identity cannot be changed';
  end if;
  return new;
end $$;
create trigger protect_company_identity before update on public.companies for each row execute function public.protect_company_identity();
revoke execute on function public.write_audit(uuid,text,text,uuid,jsonb),public.add_sample_rates(uuid) from public,anon,authenticated;

create or replace function public.list_my_companies() returns jsonb
language sql stable security definer set search_path=public as $$
select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'role',m.role) order by c.name),'[]')
from public.company_members m join public.companies c on c.id=m.company_id
where m.user_id=auth.uid() and m.status='active';
$$;
create or replace function public.switch_company(target_company uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.company_members where company_id=target_company and user_id=auth.uid() and status='active') then
    raise exception 'Active membership required';
  end if;
  update public.users set company_id=target_company where id=auth.uid();
end $$;
create or replace function public.update_project_details(target_project uuid,start_date date,completion_date date,internal_notes text,crew_notes text) returns void
language plpgsql security definer set search_path=public as $$
declare company uuid;
begin
  if completion_date<start_date then raise exception 'Completion must follow start';end if;
  update public.projects set estimated_start_date=start_date,estimated_completion_date=completion_date,notes=internal_notes,employee_notes=crew_notes,updated_at=now()
  where id=target_project and public.has_company_permission(company_id,'projects.edit') returning company_id into company;
  if company is null then raise exception 'Access denied';end if;
  perform public.write_audit(company,'project_details_updated','project',target_project);
end $$;
revoke execute on function public.list_my_companies(),public.switch_company(uuid),public.update_project_details(uuid,date,date,text,text) from public,anon;
grant execute on function public.list_my_companies(),public.switch_company(uuid),public.update_project_details(uuid,date,date,text,text) to authenticated;

-- Draft item removal is part of editing, not permission to delete an estimate.
create policy estimate_items_editor_delete on public.estimate_items for delete using(public.has_company_permission(company_id,'estimates.edit'));
create policy change_order_items_editor_delete on public.change_order_items for delete using(public.has_company_permission(company_id,'change_orders.create'));
drop policy customers_role_select on public.customers;
create policy customers_role_select on public.customers for select using(public.has_company_permission(company_id,'customers.view') and
(public.active_member_role(company_id)<>'project_manager' or exists(select 1 from public.projects p where p.customer_id=customers.id and p.company_id=customers.company_id)));
drop policy job_sites_role_select on public.job_sites;
create policy job_sites_role_select on public.job_sites for select using(public.has_company_permission(company_id,'customers.view') and
(public.active_member_role(company_id)<>'project_manager' or exists(select 1 from public.projects p where p.job_site_id=job_sites.id and p.company_id=job_sites.company_id)));
drop policy estimate_items_role_select on public.estimate_items;
create policy estimate_items_role_select on public.estimate_items for select using(public.has_company_permission(company_id,'financial.internal_costs') and
(public.active_member_role(company_id)<>'project_manager' or exists(select 1 from public.estimates e where e.id=estimate_items.estimate_id and e.status='approved')));
drop policy invoices_pm_select on public.invoices;
create policy invoices_pm_select on public.invoices for select using(public.active_member_role(company_id)='project_manager' and project_id is not null);
drop policy invoice_items_pm_select on public.invoice_items;
create policy invoice_items_pm_select on public.invoice_items for select using(public.active_member_role(company_id)='project_manager' and exists(select 1 from public.invoices i where i.id=invoice_items.invoice_id and i.project_id is not null));
create policy estimate_events_roles on public.estimate_events for select using(public.has_company_permission(company_id,'estimates.view') or public.has_company_permission(company_id,'projects.view'));
create policy estimate_snapshots_roles on public.estimate_snapshots for select using(public.has_company_permission(company_id,'estimates.view') or public.has_company_permission(company_id,'projects.view'));
create policy estimate_approvals_roles on public.estimate_approvals for select using(public.has_company_permission(company_id,'estimates.view') or public.has_company_permission(company_id,'projects.view'));
create policy change_order_snapshots_roles on public.change_order_snapshots for select using(public.has_company_permission(company_id,'change_orders.view'));
create policy change_order_approvals_roles on public.change_order_approvals for select using(public.has_company_permission(company_id,'change_orders.view'));

-- Parent references are tenant-checked even inside security-definer workflows.
create or replace function public.validate_company_relationships() returns trigger
language plpgsql security definer set search_path=public as $$
declare doc jsonb:=to_jsonb(new); key text; parent_table text; parent_company uuid; parent_customer uuid;
begin
  if TG_OP='UPDATE' and new.company_id is distinct from old.company_id then raise exception 'Company cannot be changed';end if;
  for key,parent_table in select * from (values
    ('customer_id','customers'),('job_site_id','job_sites'),('estimate_id','estimates'),
    ('rate_library_id','rate_library'),('change_order_id','change_orders'),
    ('project_id','projects'),('invoice_id','invoices')) v(k,t)
  loop
    if doc->>key is not null then
      execute format('select company_id from public.%I where id=$1',parent_table) into parent_company using (doc->>key)::uuid;
      if parent_company is distinct from new.company_id then raise exception 'Related record belongs to another company';end if;
    end if;
  end loop;
  if doc->>'job_site_id' is not null and doc->>'customer_id' is not null then
    select customer_id into parent_customer from public.job_sites where id=(doc->>'job_site_id')::uuid;
    if parent_customer is distinct from (doc->>'customer_id')::uuid then raise exception 'Job site belongs to another customer';end if;
  end if;
  return new;
end $$;
do $$ declare t text;begin
foreach t in array array['job_sites','estimates','estimate_items','change_orders','change_order_items','projects','invoices','invoice_items','payments','project_costs']
loop execute format('create trigger validate_company_relationships before insert or update on public.%I for each row execute function public.validate_company_relationships()',t);end loop;
end $$;

create or replace function public.audit_business_write() returns trigger
language plpgsql security definer set search_path=public as $$
declare doc jsonb;
begin
  doc:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  perform public.write_audit((doc->>'company_id')::uuid,TG_TABLE_NAME||'_'||lower(TG_OP),TG_ARGV[0],(doc->>'id')::uuid,jsonb_build_object('operation',lower(TG_OP)));
  return coalesce(new,old);
end $$;
do $$ declare t text;begin
foreach t in array array['customers','job_sites','estimates','rate_library','change_orders']
loop execute format('create trigger audit_business_write after insert or update or delete on public.%I for each row execute function public.audit_business_write(%L)',t,case t when 'customers' then 'customer' when 'job_sites' then 'job_site' when 'estimates' then 'estimate' when 'rate_library' then 'rate_library' else 'change_order' end);end loop;
end $$;
create or replace function public.mirror_workflow_audit() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 insert into public.audit_events(company_id,user_id,user_name,event_type,entity_type,entity_id,metadata,created_at)
 values(new.company_id,new.user_id,new.user_name,new.event_type,new.entity_type,new.entity_id,new.metadata,new.created_at);
 return new;
end $$;
create trigger mirror_workflow_audit after insert on public.estimate_events for each row execute function public.mirror_workflow_audit();
create trigger mirror_workflow_audit after insert on public.financial_events for each row execute function public.mirror_workflow_audit();
commit;
