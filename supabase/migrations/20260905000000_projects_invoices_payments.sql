-- Projects, invoicing, manual payments, project costs, and customer-safe invoice links.
create type public.project_status as enum ('upcoming','in_progress','on_hold','completed','cancelled');
create type public.invoice_status as enum ('draft','sent','viewed','partial','paid','overdue','void');
create type public.invoice_type as enum ('deposit','progress','final','custom');
create type public.payment_method as enum ('cash','check','credit_card','ach','zelle','venmo','wire_transfer','other');
create type public.project_cost_category as enum ('materials','labor','equipment','subcontractor','permit','disposal','fuel','other');

create table public.projects (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id), job_site_id uuid references public.job_sites(id),
  estimate_id uuid not null unique references public.estimates(id), project_number text not null, project_name text not null,
  status public.project_status not null default 'upcoming', original_contract_value numeric(14,2) not null default 0,
  estimated_internal_cost numeric(14,2) not null default 0, estimated_start_date date, estimated_completion_date date,
  actual_start_date date, actual_completion_date date, project_manager text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,project_number)
);
create index projects_company_status_idx on public.projects(company_id,status);

create table public.invoices (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id), job_site_id uuid references public.job_sites(id),
  project_id uuid references public.projects(id) on delete set null, estimate_id uuid references public.estimates(id) on delete set null,
  invoice_number text not null, invoice_type public.invoice_type not null default 'custom', invoice_date date not null default current_date,
  due_date date not null, po_number text, customer_notes text, internal_notes text, payment_terms text,
  status public.invoice_status not null default 'draft', subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0, sales_tax_percent numeric(8,4) not null default 0,
  sales_tax_amount numeric(14,2) not null default 0, total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0, balance_due numeric(14,2) not null default 0,
  overpayment_amount numeric(14,2) not null default 0, public_token uuid unique,
  public_token_revoked_at timestamptz, sent_at timestamptz, first_viewed_at timestamptz,
  last_viewed_at timestamptz, view_count integer not null default 0, paid_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,invoice_number)
);
create index invoices_company_status_idx on public.invoices(company_id,status);
create index invoices_project_idx on public.invoices(project_id);
create index invoices_public_token_idx on public.invoices(public_token) where public_token is not null;

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade, sort_order integer not null default 0,
  description text not null, quantity numeric(12,3) not null default 1 check(quantity>=0), unit text not null default 'each',
  unit_price numeric(14,2) not null default 0 check(unit_price>=0), taxable boolean not null default false,
  amount numeric(14,2) not null default 0, created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade, payment_date date not null default current_date,
  amount numeric(14,2) not null check(amount>0), payment_method public.payment_method not null,
  reference_number text, notes text, overpayment_amount numeric(14,2) not null default 0,
  voided_at timestamptz, void_reason text, created_at timestamptz not null default now()
);
create index payments_invoice_idx on public.payments(invoice_id,voided_at);

create table public.project_costs (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, cost_date date not null default current_date,
  category public.project_cost_category not null, description text not null, vendor text, amount numeric(14,2) not null check(amount>=0),
  notes text, created_at timestamptz not null default now()
);

create table public.financial_events (
  id bigint generated always as identity primary key, company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade, invoice_id uuid references public.invoices(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete cascade, event_type text not null,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

alter table public.projects enable row level security; alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security; alter table public.payments enable row level security;
alter table public.project_costs enable row level security; alter table public.financial_events enable row level security;
create policy projects_owner_all on public.projects for all using(public.owns_company(company_id)) with check(public.owns_company(company_id));
create policy invoices_owner_all on public.invoices for all using(public.owns_company(company_id)) with check(public.owns_company(company_id));
create policy invoice_items_owner_all on public.invoice_items for all using(public.owns_company(company_id)) with check(public.owns_company(company_id));
create policy payments_owner_all on public.payments for all using(public.owns_company(company_id)) with check(public.owns_company(company_id));
create policy project_costs_owner_all on public.project_costs for all using(public.owns_company(company_id)) with check(public.owns_company(company_id));
create policy financial_events_owner_select on public.financial_events for select using(public.owns_company(company_id));

create or replace function public.create_project_from_estimate(target_estimate_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare e public.estimates; result_id uuid; number text; internal_cost numeric;
begin
  select * into e from public.estimates where id=target_estimate_id and public.owns_company(company_id) for update;
  if e.id is null then raise exception 'Estimate not found'; end if;
  if e.status<>'approved' then raise exception 'Only approved estimates can become projects'; end if;
  select id into result_id from public.projects where estimate_id=e.id;
  if result_id is not null then return result_id; end if;
  number := 'PRJ-'||to_char(current_date,'YYYY')||'-'||lpad(((select count(*)+1 from public.projects where company_id=e.company_id and extract(year from created_at)=extract(year from now())))::text,4,'0');
  select coalesce(sum(cost_after_overhead),0) into internal_cost from public.estimate_items where estimate_id=e.id;
  insert into public.projects(company_id,customer_id,job_site_id,estimate_id,project_number,project_name,original_contract_value,estimated_internal_cost,estimated_start_date,estimated_completion_date)
  values(e.company_id,e.customer_id,e.job_site_id,e.id,number,e.project_name,e.total,internal_cost,e.estimated_start_date,e.estimated_completion_date) returning id into result_id;
  insert into public.financial_events(company_id,project_id,event_type,metadata) values(e.company_id,result_id,'project_created',jsonb_build_object('estimate_id',e.id));
  return result_id;
end $$;

create or replace function public.update_project_status(target_project_id uuid,new_status public.project_status) returns void
language plpgsql security definer set search_path=public as $$ declare p public.projects; begin
  update public.projects set status=new_status,updated_at=now(),actual_start_date=case when new_status='in_progress' then coalesce(actual_start_date,current_date) else actual_start_date end,
  actual_completion_date=case when new_status='completed' then coalesce(actual_completion_date,current_date) else actual_completion_date end
  where id=target_project_id and public.owns_company(company_id) returning * into p;
  if p.id is null then raise exception 'Project not found'; end if;
  insert into public.financial_events(company_id,project_id,event_type,metadata) values(p.company_id,p.id,'project_status_changed',jsonb_build_object('status',new_status));
end $$;

create or replace function public.create_invoice(payload jsonb, line_items jsonb, allow_overbilling boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
declare p public.projects; e public.estimates; company uuid; customer uuid; site uuid; project uuid; estimate uuid;
  result_id uuid; number text; kind public.invoice_type; row jsonb; sub numeric:=0; taxable_sub numeric:=0; discount numeric; tax_rate numeric; tax numeric; grand numeric; prior numeric:=0; contract numeric:=0;
begin
  project:=nullif(payload->>'project_id','')::uuid; estimate:=nullif(payload->>'estimate_id','')::uuid; kind:=coalesce(nullif(payload->>'invoice_type','')::public.invoice_type,'custom');
  if project is not null then
    select * into p from public.projects where id=project and public.owns_company(company_id);
    if p.id is null then raise exception 'Project not found'; end if;
    company:=p.company_id; customer:=p.customer_id; site:=p.job_site_id; estimate:=coalesce(estimate,p.estimate_id);
    select p.original_contract_value+coalesce(sum(co.total) filter(where co.status='approved'),0) into contract from public.change_orders co where co.estimate_id=p.estimate_id;
    select coalesce(sum(total),0) into prior from public.invoices where project_id=p.id and status<>'void';
  elsif estimate is not null then
    select * into e from public.estimates where id=estimate and status='approved' and public.owns_company(company_id);
    if e.id is null then raise exception 'Approved estimate not found'; end if;
    company:=e.company_id; customer:=e.customer_id; site:=e.job_site_id; contract:=e.total;
    select coalesce(sum(total),0) into prior from public.invoices where estimate_id=e.id and status<>'void';
  else raise exception 'An approved estimate or project is required'; end if;
  if jsonb_typeof(line_items)<>'array' or jsonb_array_length(line_items)=0 then raise exception 'At least one line item is required'; end if;
  for row in select * from jsonb_array_elements(line_items) loop
    if char_length(trim(coalesce(row->>'description','')))=0 then raise exception 'Every item needs a description'; end if;
    sub:=sub+round(greatest(0,coalesce((row->>'quantity')::numeric,0))*greatest(0,coalesce((row->>'unit_price')::numeric,0)),2);
    if coalesce((row->>'taxable')::boolean,false) then taxable_sub:=taxable_sub+round(greatest(0,coalesce((row->>'quantity')::numeric,0))*greatest(0,coalesce((row->>'unit_price')::numeric,0)),2); end if;
  end loop;
  discount:=least(sub,greatest(0,coalesce((payload->>'discount_amount')::numeric,0))); tax_rate:=greatest(0,coalesce((payload->>'sales_tax_percent')::numeric,0));
  tax:=round(greatest(0,taxable_sub-(case when sub>0 then discount*(taxable_sub/sub) else 0 end))*tax_rate/100,2); grand:=round(sub-discount+tax,2);
  if contract>0 and prior+grand>contract and not allow_overbilling then raise exception 'This invoice exceeds the remaining contract value. Confirm overbilling to continue.'; end if;
  number:=coalesce(nullif(trim(payload->>'invoice_number'),''),'INV-'||to_char(current_date,'YYYY')||'-'||lpad(((select count(*)+1 from public.invoices where company_id=company and extract(year from created_at)=extract(year from now())))::text,4,'0'));
  insert into public.invoices(company_id,customer_id,job_site_id,project_id,estimate_id,invoice_number,invoice_type,invoice_date,due_date,po_number,customer_notes,internal_notes,payment_terms,subtotal,discount_amount,sales_tax_percent,sales_tax_amount,total,balance_due)
  values(company,customer,site,project,estimate,number,kind,coalesce((payload->>'invoice_date')::date,current_date),coalesce((payload->>'due_date')::date,current_date+30),nullif(trim(payload->>'po_number'),''),nullif(trim(payload->>'customer_notes'),''),nullif(trim(payload->>'internal_notes'),''),nullif(trim(payload->>'payment_terms'),''),sub,discount,tax_rate,tax,grand,grand) returning id into result_id;
  insert into public.invoice_items(invoice_id,company_id,sort_order,description,quantity,unit,unit_price,taxable,amount)
  select result_id,company,ordinality-1,trim(value->>'description'),greatest(0,coalesce((value->>'quantity')::numeric,0)),coalesce(nullif(value->>'unit',''),'each'),greatest(0,coalesce((value->>'unit_price')::numeric,0)),coalesce((value->>'taxable')::boolean,false),round(greatest(0,coalesce((value->>'quantity')::numeric,0))*greatest(0,coalesce((value->>'unit_price')::numeric,0)),2) from jsonb_array_elements(line_items) with ordinality;
  insert into public.financial_events(company_id,project_id,invoice_id,event_type,metadata) values(company,project,result_id,'invoice_created',jsonb_build_object('type',kind));
  return result_id;
end $$;

create or replace function public.send_invoice(target_invoice_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare i public.invoices; token uuid; begin
  update public.invoices set public_token=coalesce(public_token,gen_random_uuid()),public_token_revoked_at=null,status=case when status='draft' then 'sent' else status end,sent_at=coalesce(sent_at,now()),updated_at=now()
  where id=target_invoice_id and public.owns_company(company_id) and status not in('void','paid') returning * into i;
  if i.id is null then raise exception 'Invoice not found or cannot be sent'; end if;
  insert into public.financial_events(company_id,project_id,invoice_id,event_type) values(i.company_id,i.project_id,i.id,'invoice_sent'); return i.public_token;
end $$;

create or replace function public.revoke_invoice_link(target_invoice_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin update public.invoices set public_token_revoked_at=now(),updated_at=now() where id=target_invoice_id and public.owns_company(company_id); if not found then raise exception 'Invoice not found'; end if; end $$;

create or replace function public.get_public_invoice(target_token uuid,raw_ip text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare i public.invoices; payload jsonb; begin
  perform public.enforce_public_rate_limit(target_token,'invoice_view',raw_ip,60);
  select * into i from public.invoices where public_token=target_token and public_token_revoked_at is null and status<>'draft' for update;
  if i.id is null then return null; end if;
  update public.invoices set first_viewed_at=coalesce(first_viewed_at,now()),last_viewed_at=now(),view_count=view_count+1,status=case when status='sent' then 'viewed'::public.invoice_status else status end where id=i.id returning * into i;
  if i.view_count=1 then insert into public.financial_events(company_id,project_id,invoice_id,event_type) values(i.company_id,i.project_id,i.id,'invoice_viewed'); end if;
  select jsonb_build_object('kind','invoice','status',case when i.status not in('paid','void','partial') and i.due_date<current_date and i.balance_due>0 then 'overdue' else i.status::text end,
    'company',jsonb_build_object('logo_url',c.logo_url,'name',c.name,'address',c.address,'city',c.city,'state',c.state,'zip',c.zip,'phone',c.phone,'email',c.email,'website',c.website,'contractor_license',c.contractor_license),
    'invoice',jsonb_build_object('invoice_number',i.invoice_number,'invoice_type',i.invoice_type,'invoice_date',i.invoice_date,'due_date',i.due_date,'po_number',i.po_number,'payment_terms',i.payment_terms,'customer_notes',i.customer_notes),
    'customer',jsonb_build_object('name',cu.name,'company_name',cu.company_name,'billing_address',cu.billing_address),
    'job_site',case when js.id is null then null else jsonb_build_object('job_name',js.job_name,'address',js.address,'city',js.city,'state',js.state,'zip',js.zip) end,
    'project',case when p.id is null then null else jsonb_build_object('project_number',p.project_number,'project_name',p.project_name) end,
    'estimate',case when e.id is null then null else jsonb_build_object('estimate_number',e.estimate_number) end,
    'items',(select coalesce(jsonb_agg(jsonb_build_object('description',x.description,'quantity',x.quantity,'unit',x.unit,'unit_price',x.unit_price,'amount',x.amount) order by x.sort_order),'[]'::jsonb) from public.invoice_items x where x.invoice_id=i.id),
    'payments',(select coalesce(jsonb_agg(jsonb_build_object('payment_date',x.payment_date,'amount',x.amount,'payment_method',x.payment_method,'reference_number',x.reference_number) order by x.payment_date) filter(where x.voided_at is null),'[]'::jsonb) from public.payments x where x.invoice_id=i.id),
    'summary',jsonb_build_object('subtotal',i.subtotal,'discount',i.discount_amount,'tax',i.sales_tax_amount,'total',i.total,'amount_paid',i.amount_paid,'balance_due',i.balance_due)) into payload
  from public.companies c join public.customers cu on cu.id=i.customer_id left join public.job_sites js on js.id=i.job_site_id left join public.projects p on p.id=i.project_id left join public.estimates e on e.id=i.estimate_id where c.id=i.company_id;
  return payload;
end $$;

create or replace function public.recalculate_invoice(target_invoice_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare i public.invoices; paid numeric; begin select * into i from public.invoices where id=target_invoice_id for update; if i.id is null then return; end if;
  select coalesce(sum(amount),0) into paid from public.payments where invoice_id=i.id and voided_at is null;
  update public.invoices set amount_paid=paid,balance_due=greatest(0,total-paid),overpayment_amount=greatest(0,paid-total),paid_at=case when paid>=total and total>0 then coalesce(paid_at,now()) else null end,
    status=case when status='void' then status when paid>=total and total>0 then 'paid'::public.invoice_status when paid>0 then 'partial'::public.invoice_status when status in('partial','paid') then 'sent'::public.invoice_status else status end,updated_at=now() where id=i.id;
end $$;

create or replace function public.record_payment(target_invoice_id uuid,payment_date date,amount numeric,method public.payment_method,reference_number text default null,notes text default null,allow_overpayment boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$ declare i public.invoices; result_id uuid; overpay numeric; begin
  select * into i from public.invoices where id=target_invoice_id and public.owns_company(company_id) for update;
  if i.id is null or i.status='void' then raise exception 'Invoice not found or void'; end if; if amount<=0 then raise exception 'Payment must be greater than zero'; end if;
  overpay:=greatest(0,round(amount-i.balance_due,2)); if overpay>0 and not allow_overpayment then raise exception 'Payment exceeds balance due. Confirm overpayment to continue.'; end if;
  insert into public.payments(company_id,invoice_id,payment_date,amount,payment_method,reference_number,notes,overpayment_amount) values(i.company_id,i.id,payment_date,round(amount,2),method,nullif(trim(reference_number),''),nullif(trim(notes),''),overpay) returning id into result_id;
  perform public.recalculate_invoice(i.id); insert into public.financial_events(company_id,project_id,invoice_id,payment_id,event_type,metadata) values(i.company_id,i.project_id,i.id,result_id,'payment_recorded',jsonb_build_object('amount',amount,'overpayment',overpay));
  if (select status from public.invoices where id=i.id)='paid' then insert into public.financial_events(company_id,project_id,invoice_id,payment_id,event_type) values(i.company_id,i.project_id,i.id,result_id,'invoice_paid'); end if; return result_id;
end $$;

create or replace function public.void_payment(target_payment_id uuid,reason text) returns void language plpgsql security definer set search_path=public as $$
declare p public.payments; i public.invoices; begin if char_length(trim(reason))<3 then raise exception 'Void reason is required'; end if;
  update public.payments set voided_at=now(),void_reason=trim(reason) where id=target_payment_id and voided_at is null and public.owns_company(company_id) returning * into p;
  if p.id is null then raise exception 'Payment not found'; end if; select * into i from public.invoices where id=p.invoice_id; perform public.recalculate_invoice(p.invoice_id);
  insert into public.financial_events(company_id,project_id,invoice_id,payment_id,event_type,metadata) values(p.company_id,i.project_id,i.id,p.id,'payment_voided',jsonb_build_object('reason',reason));
end $$;

create or replace function public.add_project_cost(target_project_id uuid,cost_date date,category public.project_cost_category,description text,vendor text,amount numeric,notes text default null) returns uuid
language plpgsql security definer set search_path=public as $$ declare p public.projects; result_id uuid; begin select * into p from public.projects where id=target_project_id and public.owns_company(company_id); if p.id is null then raise exception 'Project not found'; end if;
  insert into public.project_costs(company_id,project_id,cost_date,category,description,vendor,amount,notes) values(p.company_id,p.id,cost_date,category,trim(description),nullif(trim(vendor),''),round(greatest(0,amount),2),nullif(trim(notes),'')) returning id into result_id;
  insert into public.financial_events(company_id,project_id,event_type,metadata) values(p.company_id,p.id,'project_cost_added',jsonb_build_object('amount',amount,'category',category)); return result_id; end $$;

create or replace function public.refresh_overdue_invoices() returns integer language plpgsql security definer set search_path=public as $$
declare changed integer; begin
  with updated as (update public.invoices set status='overdue',updated_at=now() where public.owns_company(company_id) and due_date<current_date and balance_due>0 and status in('sent','viewed') returning *)
  insert into public.financial_events(company_id,project_id,invoice_id,event_type) select company_id,project_id,id,'invoice_overdue' from updated;
  get diagnostics changed=row_count; return changed;
end $$;

revoke all on public.projects,public.invoices,public.invoice_items,public.payments,public.project_costs,public.financial_events from anon;
revoke execute on function public.create_project_from_estimate(uuid),public.update_project_status(uuid,public.project_status),public.create_invoice(jsonb,jsonb,boolean),public.send_invoice(uuid),public.revoke_invoice_link(uuid),public.recalculate_invoice(uuid),public.record_payment(uuid,date,numeric,public.payment_method,text,text,boolean),public.void_payment(uuid,text),public.add_project_cost(uuid,date,public.project_cost_category,text,text,numeric,text),public.refresh_overdue_invoices() from public,anon;
revoke execute on function public.get_public_invoice(uuid,text) from public,anon,authenticated;
grant execute on function public.create_project_from_estimate(uuid),public.update_project_status(uuid,public.project_status),public.create_invoice(jsonb,jsonb,boolean),public.send_invoice(uuid),public.revoke_invoice_link(uuid),public.record_payment(uuid,date,numeric,public.payment_method,text,text,boolean),public.void_payment(uuid,text),public.add_project_cost(uuid,date,public.project_cost_category,text,text,numeric,text),public.refresh_overdue_invoices() to authenticated;
grant execute on function public.get_public_invoice(uuid,text) to anon,authenticated;
comment on function public.get_public_invoice(uuid,text) is 'Customer-safe invoice projection. Never returns internal notes, internal costs, profit, markup, overhead, or margin.';

