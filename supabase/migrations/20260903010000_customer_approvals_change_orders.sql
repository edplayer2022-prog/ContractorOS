-- Customer approval and change-order workflow for ContractorOS.
-- Public pages access data only through the security-definer RPCs below. Anonymous
-- users never receive direct SELECT privileges on business or internal-cost tables.

create type public.signature_type as enum ('drawn', 'typed');
create type public.change_order_status as enum ('draft', 'sent', 'viewed', 'approved', 'rejected');

alter table public.estimates
  add column public_token uuid unique,
  add column public_token_revoked_at timestamptz,
  add column sent_at timestamptz,
  add column first_viewed_at timestamptz,
  add column last_viewed_at timestamptz,
  add column view_count integer not null default 0 check (view_count >= 0),
  add column approved_at timestamptz,
  add column approved_by_name text,
  add column approved_by_email text,
  add column rejected_at timestamptz,
  add column rejection_reason text,
  add column rejection_comments text;

create unique index estimates_public_token_idx on public.estimates(public_token) where public_token is not null;

create table public.estimate_approvals (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null unique references public.estimates(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete cascade,
  public_token uuid not null,
  signer_name text not null,
  signer_email text not null,
  signature_type public.signature_type not null,
  signature_data text not null check (char_length(signature_data) between 1 and 300000),
  accepted boolean not null check (accepted),
  signed_at timestamptz not null default now(),
  user_agent text,
  ip_address inet,
  created_at timestamptz not null default now()
);

create table public.estimate_snapshots (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null unique references public.estimates(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete cascade,
  version integer not null default 1,
  snapshot_data jsonb not null,
  approved_total numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (estimate_id, version)
);

create table public.change_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  change_order_number text not null,
  change_date date not null default current_date,
  description text not null,
  status public.change_order_status not null default 'draft',
  public_token uuid unique,
  public_token_revoked_at timestamptz,
  subtotal numeric(14,2) not null default 0,
  sales_tax_percent numeric(7,3) not null default 0 check (sales_tax_percent between 0 and 100),
  sales_tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  original_contract_value numeric(14,2) not null default 0,
  previous_changes_value numeric(14,2) not null default 0,
  new_contract_value numeric(14,2) not null default 0,
  sent_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  approved_at timestamptz,
  approved_by_name text,
  approved_by_email text,
  rejected_at timestamptz,
  rejection_reason text,
  rejection_comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, change_order_number)
);

create index change_orders_company_idx on public.change_orders(company_id);
create index change_orders_estimate_idx on public.change_orders(estimate_id);
create unique index change_orders_public_token_idx on public.change_orders(public_token) where public_token is not null;

create table public.change_order_items (
  id uuid primary key default gen_random_uuid(),
  change_order_id uuid not null references public.change_orders(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  sort_order integer not null default 0,
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity >= 0),
  unit text not null,
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  taxable boolean not null default true,
  amount numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now()
);

create index change_order_items_order_idx on public.change_order_items(change_order_id);

create table public.change_order_approvals (
  id uuid primary key default gen_random_uuid(),
  change_order_id uuid not null unique references public.change_orders(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete cascade,
  public_token uuid not null,
  signer_name text not null,
  signer_email text not null,
  signature_type public.signature_type not null,
  signature_data text not null check (char_length(signature_data) between 1 and 300000),
  accepted boolean not null check (accepted),
  signed_at timestamptz not null default now(),
  user_agent text,
  ip_address inet,
  created_at timestamptz not null default now()
);

create table public.change_order_snapshots (
  id uuid primary key default gen_random_uuid(),
  change_order_id uuid not null unique references public.change_orders(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete cascade,
  snapshot_data jsonb not null,
  approved_total numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create table public.estimate_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  change_order_id uuid references public.change_orders(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index estimate_events_estimate_idx on public.estimate_events(estimate_id, created_at);

create table public.public_request_log (
  id bigint generated always as identity primary key,
  public_token uuid not null,
  action text not null,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index public_request_log_limit_idx on public.public_request_log(public_token, action, created_at);

alter table public.estimate_approvals enable row level security;
alter table public.estimate_snapshots enable row level security;
alter table public.change_orders enable row level security;
alter table public.change_order_items enable row level security;
alter table public.change_order_approvals enable row level security;
alter table public.change_order_snapshots enable row level security;
alter table public.estimate_events enable row level security;
alter table public.public_request_log enable row level security;

create policy "owners read estimate approvals" on public.estimate_approvals for select using (public.owns_company(company_id));
create policy "owners read estimate snapshots" on public.estimate_snapshots for select using (public.owns_company(company_id));
create policy "owners manage change orders" on public.change_orders for all using (public.owns_company(company_id)) with check (public.owns_company(company_id));
create policy "owners manage change order items" on public.change_order_items for all using (public.owns_company(company_id)) with check (public.owns_company(company_id));
create policy "owners read change order approvals" on public.change_order_approvals for select using (public.owns_company(company_id));
create policy "owners read change order snapshots" on public.change_order_snapshots for select using (public.owns_company(company_id));
create policy "owners read estimate events" on public.estimate_events for select using (public.owns_company(company_id));

create trigger change_orders_updated_at before update on public.change_orders
for each row execute procedure public.set_updated_at();

create or replace function public.safe_request_ip(raw_ip text) returns inet
language plpgsql immutable set search_path = public as $$
begin
  return nullif(split_part(coalesce(raw_ip, ''), ',', 1), '')::inet;
exception when others then return null;
end;
$$;

create or replace function public.enforce_public_rate_limit(
  target_token uuid, target_action text, raw_ip text, request_limit integer
) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.public_request_log where created_at < now() - interval '24 hours';
  if (select count(*) from public.public_request_log
      where public_token = target_token and action = target_action
        and created_at > now() - interval '10 minutes'
        and (public.safe_request_ip(raw_ip) is null or ip_address = public.safe_request_ip(raw_ip))) >= request_limit then
    raise exception 'Too many requests. Please try again later.' using errcode = 'P0001';
  end if;
  insert into public.public_request_log(public_token, action, ip_address)
  values (target_token, target_action, public.safe_request_ip(raw_ip));
end;
$$;

create or replace function public.record_estimate_event(
  target_estimate_id uuid, target_event text, event_metadata jsonb default '{}'::jsonb,
  target_change_order_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare target_company uuid;
begin
  select company_id into target_company from public.estimates where id = target_estimate_id;
  if target_company is null then raise exception 'Estimate not found'; end if;
  if auth.uid() is not null and not public.owns_company(target_company) then raise exception 'Forbidden'; end if;
  insert into public.estimate_events(company_id, estimate_id, change_order_id, event_type, metadata)
  values (target_company, target_estimate_id, target_change_order_id, target_event, coalesce(event_metadata, '{}'::jsonb));
end;
$$;

create or replace function public.on_estimate_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.estimate_events(company_id, estimate_id, event_type)
  values (new.company_id, new.id, 'estimate_created');
  return new;
end;
$$;

create trigger estimate_created_event after insert on public.estimates
for each row execute procedure public.on_estimate_created();

insert into public.estimate_events(company_id,estimate_id,event_type,created_at)
select e.company_id,e.id,'estimate_created',e.created_at from public.estimates e
where not exists(select 1 from public.estimate_events event where event.estimate_id=e.id and event.event_type='estimate_created');

create or replace function public.send_estimate(target_estimate_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare result_token uuid; target_company uuid; item_count integer; estimate_total numeric; target_status public.estimate_status;
begin
  select company_id, total, status into target_company, estimate_total, target_status
  from public.estimates where id = target_estimate_id for update;
  if target_company is null or not public.owns_company(target_company) then raise exception 'Estimate not found'; end if;
  select count(*) into item_count from public.estimate_items where estimate_id = target_estimate_id;
  if item_count = 0 or coalesce(estimate_total, 0) <= 0 then raise exception 'Customer, project, line items, and a valid total are required.'; end if;
  if (select valid_until from public.estimates where id=target_estimate_id) < current_date then raise exception 'Extend the expiration date before sending.'; end if;
  if target_status = 'approved' then raise exception 'Approved estimates cannot be resent or edited.'; end if;
  update public.estimates set public_token = coalesce(public_token, gen_random_uuid()), public_token_revoked_at = null,
    status = 'sent', sent_at = now(), rejected_at = null, rejection_reason = null, rejection_comments = null
  where id = target_estimate_id returning public_token into result_token;
  perform public.record_estimate_event(target_estimate_id, 'estimate_sent');
  return result_token;
end;
$$;

create or replace function public.extend_estimate_expiration(target_estimate_id uuid, new_valid_until date) returns void
language plpgsql security definer set search_path = public as $$
declare target_company uuid;
begin
  select company_id into target_company from public.estimates where id = target_estimate_id;
  if target_company is null or not public.owns_company(target_company) then raise exception 'Estimate not found'; end if;
  if new_valid_until <= current_date then raise exception 'Expiration date must be in the future.'; end if;
  update public.estimates set valid_until = new_valid_until, status = 'draft' where id = target_estimate_id and status = 'expired';
  if not found then raise exception 'Only expired estimates can be extended.'; end if;
  perform public.record_estimate_event(target_estimate_id, 'expiration_extended', jsonb_build_object('valid_until', new_valid_until));
end;
$$;

create or replace function public.duplicate_estimate(target_estimate_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare source public.estimates; new_id uuid; new_number text;
begin
  select * into source from public.estimates where id=target_estimate_id;
  if source.id is null or not public.owns_company(source.company_id) then raise exception 'Estimate not found'; end if;
  new_number:=source.estimate_number||'-REV-'||to_char(clock_timestamp(),'YYMMDDHH24MISS');
  insert into public.estimates(company_id,customer_id,job_site_id,estimate_number,estimate_date,valid_until,status,project_name,scope_of_work,internal_notes,customer_notes,discount_type,discount_value,sales_tax_percent,deposit_percent,estimated_start_date,estimated_completion_date,payment_terms,inclusions,exclusions,subtotal,discount_amount,sales_tax_amount,total,deposit_required,remaining_balance)
  values(source.company_id,source.customer_id,source.job_site_id,new_number,current_date,greatest(source.valid_until,current_date+30),'draft',source.project_name,source.scope_of_work,source.internal_notes,source.customer_notes,source.discount_type,source.discount_value,source.sales_tax_percent,source.deposit_percent,source.estimated_start_date,source.estimated_completion_date,source.payment_terms,source.inclusions,source.exclusions,source.subtotal,source.discount_amount,source.sales_tax_amount,source.total,source.deposit_required,source.remaining_balance) returning id into new_id;
  insert into public.estimate_items(estimate_id,company_id,rate_library_id,sort_order,category,phase,service_name,description,customer_description,internal_notes,unit,quantity,waste_percent,material_unit_cost,labor_hours_per_unit,labor_hours,labor_rate,equipment_cost,subcontractor_cost,other_direct_cost,taxable,overhead_percent,profit_markup_percent)
  select new_id,company_id,rate_library_id,sort_order,category,phase,service_name,description,customer_description,internal_notes,unit,quantity,waste_percent,material_unit_cost,labor_hours_per_unit,labor_hours,labor_rate,equipment_cost,subcontractor_cost,other_direct_cost,taxable,overhead_percent,profit_markup_percent from public.estimate_items where estimate_id=source.id;
  return new_id;
end;
$$;

create or replace function public.get_public_estimate(target_token uuid, raw_ip text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.estimates; payload jsonb; snapshot jsonb;
begin
  perform public.enforce_public_rate_limit(target_token, 'estimate_view', raw_ip, 60);
  select * into e from public.estimates where public_token = target_token and public_token_revoked_at is null and status <> 'draft' for update;
  if e.id is null then return null; end if;
  if e.valid_until < current_date and e.status in ('sent','viewed') then
    update public.estimates set status = 'expired' where id = e.id;
    e.status := 'expired';
    insert into public.estimate_events(company_id, estimate_id, event_type) values (e.company_id, e.id, 'estimate_expired');
  end if;
  update public.estimates set first_viewed_at = coalesce(first_viewed_at, now()), last_viewed_at = now(),
    view_count = view_count + 1, status = case when status = 'sent' then 'viewed'::public.estimate_status else status end
  where id = e.id returning * into e;
  if e.view_count = 1 then insert into public.estimate_events(company_id, estimate_id, event_type) values (e.company_id, e.id, 'estimate_viewed'); end if;
  if e.status = 'approved' then select snapshot_data into snapshot from public.estimate_snapshots where estimate_id = e.id; end if;
  if snapshot is not null then return snapshot || jsonb_build_object('status', e.status, 'view_count', e.view_count); end if;
  select jsonb_build_object(
    'kind','estimate','status',e.status,'expired',e.status='expired',
    'company',jsonb_build_object('logo_url',c.logo_url,'name',c.name,'address',c.address,'city',c.city,'state',c.state,'zip',c.zip,'phone',c.phone,'email',c.email,'website',c.website,'contractor_license',c.contractor_license),
    'estimate',jsonb_build_object('estimate_number',e.estimate_number,'estimate_date',e.estimate_date,'valid_until',e.valid_until,'project_name',e.project_name,'scope_of_work',e.scope_of_work),
    'customer',jsonb_build_object('name',cu.name,'company_name',cu.company_name),
    'job_site',case when js.id is null then null else jsonb_build_object('job_name',js.job_name,'address',js.address,'city',js.city,'state',js.state,'zip',js.zip) end,
    'items',(select coalesce(jsonb_agg(jsonb_build_object('description',coalesce(i.customer_description,'Project service'),'quantity',i.quantity,'unit',i.unit,'amount',i.selling_price) order by i.sort_order),'[]'::jsonb) from public.estimate_items i where i.estimate_id=e.id),
    'summary',jsonb_build_object('subtotal',e.subtotal,'discount',e.discount_amount,'tax',e.sales_tax_amount,'total',e.total,'deposit',e.deposit_required,'remaining_balance',e.remaining_balance),
    'details',jsonb_build_object('estimated_start_date',e.estimated_start_date,'estimated_completion_date',e.estimated_completion_date,'payment_terms',e.payment_terms,'inclusions',e.inclusions,'exclusions',e.exclusions,'customer_notes',e.customer_notes)
  ) into payload from public.companies c join public.customers cu on cu.id=e.customer_id left join public.job_sites js on js.id=e.job_site_id where c.id=e.company_id;
  return payload;
end;
$$;

create or replace function public.approve_public_estimate(
  target_token uuid, signer_name text, signer_email text, signature_kind public.signature_type,
  signature_value text, accepted_terms boolean, request_user_agent text default null, raw_ip text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.estimates; approval_time timestamptz := now(); payload jsonb;
begin
  perform public.enforce_public_rate_limit(target_token, 'estimate_approve', raw_ip, 5);
  if not accepted_terms or char_length(trim(signer_name)) < 2 or position('@' in signer_email) < 2 or char_length(signature_value) < 1 then raise exception 'Name, valid email, signature, and acceptance are required.'; end if;
  select * into e from public.estimates where public_token=target_token and public_token_revoked_at is null for update;
  if e.id is null then raise exception 'Estimate not found'; end if;
  if e.status='approved' then raise exception 'This estimate has already been approved.'; end if;
  if e.status='rejected' then raise exception 'This estimate has been declined.'; end if;
  if e.valid_until < current_date or e.status='expired' then raise exception 'This estimate has expired.'; end if;
  if e.status not in ('sent','viewed') then raise exception 'This estimate is not available for approval.'; end if;
  insert into public.estimate_approvals(estimate_id,company_id,public_token,signer_name,signer_email,signature_type,signature_data,accepted,signed_at,user_agent,ip_address)
  values(e.id,e.company_id,target_token,trim(signer_name),lower(trim(signer_email)),signature_kind,signature_value,true,approval_time,left(request_user_agent,1000),public.safe_request_ip(raw_ip));
  update public.estimates set status='approved',approved_at=approval_time,approved_by_name=trim(signer_name),approved_by_email=lower(trim(signer_email)) where id=e.id returning * into e;
  payload := public.get_public_estimate(target_token, raw_ip) || jsonb_build_object('approval',jsonb_build_object('approved_by',trim(signer_name),'email',lower(trim(signer_email)),'signature_type',signature_kind,'signature_data',signature_value,'approved_at',approval_time,'electronically_approved',true));
  insert into public.estimate_snapshots(estimate_id,company_id,snapshot_data,approved_total) values(e.id,e.company_id,payload,e.total);
  insert into public.estimate_events(company_id,estimate_id,event_type,metadata) values(e.company_id,e.id,'estimate_approved',jsonb_build_object('signer_name',trim(signer_name)));
  return jsonb_build_object('estimate_number',e.estimate_number,'project_name',e.project_name,'total',e.total,'approved_at',approval_time);
end;
$$;

create or replace function public.reject_public_estimate(target_token uuid, reason text default null, comments text default null, raw_ip text default null) returns void
language plpgsql security definer set search_path = public as $$
declare e public.estimates;
begin
  perform public.enforce_public_rate_limit(target_token, 'estimate_reject', raw_ip, 5);
  select * into e from public.estimates where public_token=target_token and public_token_revoked_at is null for update;
  if e.id is null then raise exception 'Estimate not found'; end if;
  if e.status='approved' then raise exception 'An approved estimate cannot be declined.'; end if;
  if e.status not in ('sent','viewed') then raise exception 'This estimate is not available for decline.'; end if;
  update public.estimates set status='rejected',rejected_at=now(),rejection_reason=nullif(trim(reason),''),rejection_comments=nullif(trim(comments),'') where id=e.id;
  insert into public.estimate_events(company_id,estimate_id,event_type,metadata) values(e.company_id,e.id,'estimate_rejected',jsonb_build_object('reason',reason));
end;
$$;

create or replace function public.on_change_order_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.estimate_events(company_id,estimate_id,change_order_id,event_type)
  values(new.company_id,new.estimate_id,new.id,'change_order_created'); return new;
end;
$$;
create trigger change_order_created_event after insert on public.change_orders for each row execute procedure public.on_change_order_created();

create or replace function public.send_change_order(target_change_order_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare co public.change_orders; result_token uuid; item_count integer;
begin
  select * into co from public.change_orders where id=target_change_order_id for update;
  if co.id is null or not public.owns_company(co.company_id) then raise exception 'Change order not found'; end if;
  if co.status='approved' then raise exception 'Approved change orders cannot be resent.'; end if;
  select count(*) into item_count from public.change_order_items where change_order_id=co.id;
  if item_count=0 or co.total<=0 then raise exception 'At least one line item and a valid total are required.'; end if;
  update public.change_orders set public_token=coalesce(public_token,gen_random_uuid()),public_token_revoked_at=null,status='sent',sent_at=now(),rejected_at=null,rejection_reason=null,rejection_comments=null where id=co.id returning public_token into result_token;
  insert into public.estimate_events(company_id,estimate_id,change_order_id,event_type) values(co.company_id,co.estimate_id,co.id,'change_order_sent');
  return result_token;
end;
$$;

create or replace function public.get_public_change_order(target_token uuid, raw_ip text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare co public.change_orders; e public.estimates; snapshot jsonb; payload jsonb;
begin
  perform public.enforce_public_rate_limit(target_token,'change_order_view',raw_ip,60);
  select * into co from public.change_orders where public_token=target_token and public_token_revoked_at is null and status<>'draft' for update;
  if co.id is null then return null; end if;
  update public.change_orders set first_viewed_at=coalesce(first_viewed_at,now()),last_viewed_at=now(),view_count=view_count+1,status=case when status='sent' then 'viewed'::public.change_order_status else status end where id=co.id returning * into co;
  if co.view_count=1 then insert into public.estimate_events(company_id,estimate_id,change_order_id,event_type) values(co.company_id,co.estimate_id,co.id,'change_order_viewed'); end if;
  if co.status='approved' then select snapshot_data into snapshot from public.change_order_snapshots where change_order_id=co.id; end if;
  if snapshot is not null then return snapshot || jsonb_build_object('status',co.status,'view_count',co.view_count); end if;
  select * into e from public.estimates where id=co.estimate_id;
  select jsonb_build_object(
    'kind','change_order','status',co.status,
    'company',jsonb_build_object('logo_url',c.logo_url,'name',c.name,'address',c.address,'city',c.city,'state',c.state,'zip',c.zip,'phone',c.phone,'email',c.email,'website',c.website,'contractor_license',c.contractor_license),
    'change_order',jsonb_build_object('number',co.change_order_number,'date',co.change_date,'description',co.description,'original_estimate_number',e.estimate_number,'project_name',e.project_name),
    'customer',jsonb_build_object('name',cu.name,'company_name',cu.company_name),
    'job_site',case when js.id is null then null else jsonb_build_object('job_name',js.job_name,'address',js.address,'city',js.city,'state',js.state,'zip',js.zip) end,
    'items',(select coalesce(jsonb_agg(jsonb_build_object('description',i.description,'quantity',i.quantity,'unit',i.unit,'unit_price',i.unit_price,'amount',i.amount) order by i.sort_order),'[]'::jsonb) from public.change_order_items i where i.change_order_id=co.id),
    'summary',jsonb_build_object('subtotal',co.subtotal,'tax',co.sales_tax_amount,'total',co.total,'original_contract_value',co.original_contract_value,'previous_changes_value',co.previous_changes_value,'new_contract_value',co.new_contract_value)
  ) into payload from public.companies c join public.customers cu on cu.id=e.customer_id left join public.job_sites js on js.id=e.job_site_id where c.id=co.company_id;
  return payload;
end;
$$;

create or replace function public.approve_public_change_order(
  target_token uuid, signer_name text, signer_email text, signature_kind public.signature_type,
  signature_value text, accepted_terms boolean, request_user_agent text default null, raw_ip text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare co public.change_orders; approval_time timestamptz:=now(); payload jsonb;
begin
  perform public.enforce_public_rate_limit(target_token,'change_order_approve',raw_ip,5);
  if not accepted_terms or char_length(trim(signer_name))<2 or position('@' in signer_email)<2 or char_length(signature_value)<1 then raise exception 'Name, valid email, signature, and acceptance are required.'; end if;
  select * into co from public.change_orders where public_token=target_token and public_token_revoked_at is null for update;
  if co.id is null then raise exception 'Change order not found'; end if;
  if co.status='approved' then raise exception 'This change order has already been approved.'; end if;
  if co.status='rejected' then raise exception 'This change order has been declined.'; end if;
  if co.status not in ('sent','viewed') then raise exception 'This change order is not available for approval.'; end if;
  insert into public.change_order_approvals(change_order_id,company_id,public_token,signer_name,signer_email,signature_type,signature_data,accepted,signed_at,user_agent,ip_address)
  values(co.id,co.company_id,target_token,trim(signer_name),lower(trim(signer_email)),signature_kind,signature_value,true,approval_time,left(request_user_agent,1000),public.safe_request_ip(raw_ip));
  update public.change_orders set status='approved',approved_at=approval_time,approved_by_name=trim(signer_name),approved_by_email=lower(trim(signer_email)) where id=co.id returning * into co;
  payload:=public.get_public_change_order(target_token,raw_ip)||jsonb_build_object('approval',jsonb_build_object('approved_by',trim(signer_name),'email',lower(trim(signer_email)),'signature_type',signature_kind,'signature_data',signature_value,'approved_at',approval_time,'electronically_approved',true));
  insert into public.change_order_snapshots(change_order_id,company_id,snapshot_data,approved_total) values(co.id,co.company_id,payload,co.total);
  insert into public.estimate_events(company_id,estimate_id,change_order_id,event_type,metadata) values(co.company_id,co.estimate_id,co.id,'change_order_approved',jsonb_build_object('signer_name',trim(signer_name)));
  return jsonb_build_object('number',co.change_order_number,'total',co.total,'new_contract_value',co.new_contract_value,'approved_at',approval_time);
end;
$$;

create or replace function public.reject_public_change_order(target_token uuid, reason text default null, comments text default null, raw_ip text default null) returns void
language plpgsql security definer set search_path = public as $$
declare co public.change_orders;
begin
  perform public.enforce_public_rate_limit(target_token,'change_order_reject',raw_ip,5);
  select * into co from public.change_orders where public_token=target_token and public_token_revoked_at is null for update;
  if co.id is null then raise exception 'Change order not found'; end if;
  if co.status='approved' then raise exception 'An approved change order cannot be declined.'; end if;
  if co.status not in ('sent','viewed') then raise exception 'This change order is not available for decline.'; end if;
  update public.change_orders set status='rejected',rejected_at=now(),rejection_reason=nullif(trim(reason),''),rejection_comments=nullif(trim(comments),'') where id=co.id;
  insert into public.estimate_events(company_id,estimate_id,change_order_id,event_type,metadata) values(co.company_id,co.estimate_id,co.id,'change_order_rejected',jsonb_build_object('reason',reason));
end;
$$;

create or replace function public.protect_approved_estimate() returns trigger language plpgsql set search_path=public as $$
begin
  if old.status='approved' and exists(select 1 from public.estimate_snapshots where estimate_id=old.id)
     and (to_jsonb(new)-array['last_viewed_at','view_count','updated_at']) <> (to_jsonb(old)-array['last_viewed_at','view_count','updated_at']) then
    raise exception 'Approved estimate is immutable. Create a new version or change order.';
  end if; return new;
end; $$;
create trigger protect_approved_estimate before update on public.estimates for each row execute procedure public.protect_approved_estimate();

create or replace function public.protect_approved_estimate_items() returns trigger language plpgsql set search_path=public as $$
declare target_id uuid;
begin
  target_id:=case when tg_op='DELETE' then old.estimate_id else new.estimate_id end;
  if exists(select 1 from public.estimates where id=target_id and status='approved') then raise exception 'Approved estimate items are immutable.'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;
create trigger protect_approved_estimate_items before insert or update or delete on public.estimate_items for each row execute procedure public.protect_approved_estimate_items();

create or replace function public.protect_approved_change_order() returns trigger language plpgsql set search_path=public as $$
begin
  if old.status='approved' and exists(select 1 from public.change_order_snapshots where change_order_id=old.id)
     and (to_jsonb(new)-array['last_viewed_at','view_count','updated_at']) <> (to_jsonb(old)-array['last_viewed_at','view_count','updated_at']) then
    raise exception 'Approved change order is immutable.';
  end if; return new;
end; $$;
create trigger protect_approved_change_order before update on public.change_orders for each row execute procedure public.protect_approved_change_order();

create or replace function public.protect_approved_change_order_items() returns trigger language plpgsql set search_path=public as $$
declare target_id uuid;
begin
  target_id:=case when tg_op='DELETE' then old.change_order_id else new.change_order_id end;
  if exists(select 1 from public.change_orders where id=target_id and status='approved') then raise exception 'Approved change order items are immutable.'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;
create trigger protect_approved_change_order_items before insert or update or delete on public.change_order_items for each row execute procedure public.protect_approved_change_order_items();

revoke all on public.estimate_approvals, public.estimate_snapshots, public.change_orders, public.change_order_items,
  public.change_order_approvals, public.change_order_snapshots, public.estimate_events, public.public_request_log from anon;
revoke execute on function public.safe_request_ip(text) from public, anon, authenticated;
revoke execute on function public.enforce_public_rate_limit(uuid,text,text,integer) from public, anon, authenticated;
revoke execute on function public.record_estimate_event(uuid,text,jsonb,uuid) from public, anon, authenticated;
revoke execute on function public.send_estimate(uuid) from public, anon, authenticated;
revoke execute on function public.extend_estimate_expiration(uuid,date) from public, anon, authenticated;
revoke execute on function public.duplicate_estimate(uuid) from public, anon, authenticated;
revoke execute on function public.get_public_estimate(uuid,text) from public, anon, authenticated;
revoke execute on function public.approve_public_estimate(uuid,text,text,public.signature_type,text,boolean,text,text) from public, anon, authenticated;
revoke execute on function public.reject_public_estimate(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.send_change_order(uuid) from public, anon, authenticated;
revoke execute on function public.get_public_change_order(uuid,text) from public, anon, authenticated;
revoke execute on function public.approve_public_change_order(uuid,text,text,public.signature_type,text,boolean,text,text) from public, anon, authenticated;
revoke execute on function public.reject_public_change_order(uuid,text,text,text) from public, anon, authenticated;

grant execute on function public.get_public_estimate(uuid,text) to anon, authenticated;
grant execute on function public.approve_public_estimate(uuid,text,text,public.signature_type,text,boolean,text,text) to anon, authenticated;
grant execute on function public.reject_public_estimate(uuid,text,text,text) to anon, authenticated;
grant execute on function public.get_public_change_order(uuid,text) to anon, authenticated;
grant execute on function public.approve_public_change_order(uuid,text,text,public.signature_type,text,boolean,text,text) to anon, authenticated;
grant execute on function public.reject_public_change_order(uuid,text,text,text) to anon, authenticated;
grant execute on function public.send_estimate(uuid) to authenticated;
grant execute on function public.extend_estimate_expiration(uuid,date) to authenticated;
grant execute on function public.duplicate_estimate(uuid) to authenticated;
grant execute on function public.send_change_order(uuid) to authenticated;

comment on function public.get_public_estimate(uuid,text) is 'Safe customer projection. Never returns estimate_items internal-cost columns.';
comment on table public.estimate_snapshots is 'Immutable customer-safe document approved by the customer.';
comment on table public.public_request_log is 'Private, short-lived request metadata used for basic public endpoint rate limiting.';
