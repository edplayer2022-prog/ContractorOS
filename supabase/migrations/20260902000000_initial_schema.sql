create extension if not exists pgcrypto;

create type public.estimate_status as enum ('draft', 'sent', 'approved');
create type public.discount_type as enum ('fixed', 'percent');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  owner_name text not null,
  logo_url text,
  address text, city text, state text, zip text, phone text, email text, website text,
  contractor_license text,
  default_sales_tax numeric(7,3) not null default 0 check (default_sales_tax between 0 and 100),
  default_overhead numeric(7,3) not null default 10 check (default_overhead between 0 and 1000),
  default_profit_markup numeric(7,3) not null default 20 check (default_profit_markup between 0 and 1000),
  default_deposit numeric(7,3) not null default 30 check (default_deposit between 0 and 100),
  estimate_validity_days integer not null default 30 check (estimate_validity_days between 1 and 365),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.users add constraint users_company_fk foreign key (company_id) references public.companies(id) on delete set null;

create or replace function public.link_company_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin update public.users set company_id = new.id where id = new.owner_id; return new; end; $$;
create trigger on_company_created after insert on public.companies for each row execute procedure public.link_company_owner();

create table public.customers (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, company_name text, phone text, email text, billing_address text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index customers_company_id_idx on public.customers(company_id);

create table public.job_sites (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  job_name text not null, address text not null, city text not null, state text not null, zip text not null, notes text,
  created_at timestamptz not null default now()
);
create index job_sites_customer_id_idx on public.job_sites(customer_id);

create table public.rate_library (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  category text not null, service_name text not null, description text, unit text not null,
  material_cost_per_unit numeric(14,2) not null default 0 check (material_cost_per_unit >= 0),
  labor_hours_per_unit numeric(12,3) not null default 0 check (labor_hours_per_unit >= 0),
  labor_rate numeric(14,2) not null default 0 check (labor_rate >= 0), waste_percent numeric(7,3) not null default 0,
  equipment_cost numeric(14,2) not null default 0 check (equipment_cost >= 0),
  default_overhead numeric(7,3) not null default 0, default_markup numeric(7,3) not null default 0,
  taxable boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index rate_library_company_id_idx on public.rate_library(company_id);

create table public.estimates (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  job_site_id uuid references public.job_sites(id) on delete set null,
  estimate_number text not null, estimate_date date not null default current_date, valid_until date not null,
  status public.estimate_status not null default 'draft', project_name text not null, scope_of_work text,
  internal_notes text, customer_notes text, discount_type public.discount_type not null default 'fixed', discount_value numeric(14,2) not null default 0,
  sales_tax_percent numeric(7,3) not null default 0, deposit_percent numeric(7,3) not null default 0,
  estimated_start_date date, estimated_completion_date date, payment_terms text, inclusions text, exclusions text,
  subtotal numeric(14,2) not null default 0, discount_amount numeric(14,2) not null default 0,
  sales_tax_amount numeric(14,2) not null default 0, total numeric(14,2) not null default 0,
  deposit_required numeric(14,2) not null default 0, remaining_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(company_id, estimate_number)
);
create index estimates_company_id_idx on public.estimates(company_id);

create table public.estimate_items (
  id uuid primary key default gen_random_uuid(), estimate_id uuid not null references public.estimates(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade, rate_library_id uuid references public.rate_library(id) on delete set null,
  sort_order integer not null default 0, category text not null, phase text, description text not null, customer_description text,
  unit text not null, quantity numeric(12,3) not null default 1, waste_percent numeric(7,3) not null default 0,
  material_unit_cost numeric(14,2) not null default 0, labor_hours numeric(12,3) not null default 0,
  labor_rate numeric(14,2) not null default 0, equipment_cost numeric(14,2) not null default 0,
  subcontractor_cost numeric(14,2) not null default 0, other_direct_cost numeric(14,2) not null default 0,
  taxable boolean not null default true, overhead_percent numeric(7,3) not null default 0, profit_markup_percent numeric(7,3) not null default 0,
  adjusted_quantity numeric(14,3) generated always as (quantity * (1 + waste_percent / 100)) stored,
  material_cost numeric(14,2) generated always as (round(quantity * (1 + waste_percent / 100) * material_unit_cost, 2)) stored,
  labor_cost numeric(14,2) generated always as (round(labor_hours * labor_rate, 2)) stored,
  direct_cost numeric(14,2) generated always as (round(quantity * (1 + waste_percent / 100) * material_unit_cost + labor_hours * labor_rate + equipment_cost + subcontractor_cost + other_direct_cost, 2)) stored,
  overhead_amount numeric(14,2) generated always as (round((quantity * (1 + waste_percent / 100) * material_unit_cost + labor_hours * labor_rate + equipment_cost + subcontractor_cost + other_direct_cost) * overhead_percent / 100, 2)) stored,
  cost_after_overhead numeric(14,2) generated always as (round((quantity * (1 + waste_percent / 100) * material_unit_cost + labor_hours * labor_rate + equipment_cost + subcontractor_cost + other_direct_cost) * (1 + overhead_percent / 100), 2)) stored,
  profit_amount numeric(14,2) generated always as (round((quantity * (1 + waste_percent / 100) * material_unit_cost + labor_hours * labor_rate + equipment_cost + subcontractor_cost + other_direct_cost) * (1 + overhead_percent / 100) * profit_markup_percent / 100, 2)) stored,
  selling_price numeric(14,2) generated always as (round((quantity * (1 + waste_percent / 100) * material_unit_cost + labor_hours * labor_rate + equipment_cost + subcontractor_cost + other_direct_cost) * (1 + overhead_percent / 100) * (1 + profit_markup_percent / 100), 2)) stored,
  created_at timestamptz not null default now()
);
create index estimate_items_estimate_id_idx on public.estimate_items(estimate_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.users (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name'); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger companies_updated_at before update on public.companies for each row execute procedure public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute procedure public.set_updated_at();
create trigger rates_updated_at before update on public.rate_library for each row execute procedure public.set_updated_at();
create trigger estimates_updated_at before update on public.estimates for each row execute procedure public.set_updated_at();

create or replace function public.owns_company(target_company_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.companies where id = target_company_id and owner_id = auth.uid());
$$;

alter table public.users enable row level security;
alter table public.companies enable row level security;
alter table public.customers enable row level security;
alter table public.job_sites enable row level security;
alter table public.rate_library enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;

create policy "users read self" on public.users for select using (id = auth.uid());
create policy "users update self" on public.users for update using (id = auth.uid()) with check (id = auth.uid());
create policy "owners manage company" on public.companies for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage customers" on public.customers for all using (public.owns_company(company_id)) with check (public.owns_company(company_id));
create policy "owners manage job sites" on public.job_sites for all using (public.owns_company(company_id)) with check (public.owns_company(company_id));
create policy "owners manage rates" on public.rate_library for all using (public.owns_company(company_id)) with check (public.owns_company(company_id));
create policy "owners manage estimates" on public.estimates for all using (public.owns_company(company_id)) with check (public.owns_company(company_id));
create policy "owners manage estimate items" on public.estimate_items for all using (public.owns_company(company_id)) with check (public.owns_company(company_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-logos', 'company-logos', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;
create policy "logo public read" on storage.objects for select using (bucket_id = 'company-logos');
create policy "owner upload logo" on storage.objects for insert to authenticated with check (bucket_id = 'company-logos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner update logo" on storage.objects for update to authenticated using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner delete logo" on storage.objects for delete to authenticated using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = auth.uid()::text);

comment on table public.estimate_items is 'Internal estimating details. Never expose this table to anonymous users; customer documents must project safe fields only.';
