-- Reporting foundation: company-local dates and indexes for owner-scoped analytics.
alter table public.companies add column if not exists timezone text not null default 'America/New_York';

create index if not exists customers_company_created_idx on public.customers(company_id,created_at desc);
create index if not exists estimates_company_created_idx on public.estimates(company_id,created_at desc);
create index if not exists estimates_company_status_date_idx on public.estimates(company_id,status,estimate_date desc);
create index if not exists estimate_items_company_estimate_idx on public.estimate_items(company_id,estimate_id);
create index if not exists change_orders_company_status_date_idx on public.change_orders(company_id,status,change_date desc);
create index if not exists projects_company_created_idx on public.projects(company_id,created_at desc);
create index if not exists projects_customer_idx on public.projects(company_id,customer_id);
create index if not exists invoices_company_date_idx on public.invoices(company_id,invoice_date desc);
create index if not exists invoices_company_due_idx on public.invoices(company_id,due_date) where balance_due>0 and status<>'void';
create index if not exists invoices_customer_idx on public.invoices(company_id,customer_id);
create index if not exists payments_company_date_idx on public.payments(company_id,payment_date desc) where voided_at is null;
create index if not exists payments_invoice_idx on public.payments(invoice_id);
create index if not exists project_costs_company_date_idx on public.project_costs(company_id,cost_date desc);
create index if not exists project_costs_project_category_idx on public.project_costs(project_id,category,cost_date desc);
create index if not exists financial_events_company_created_idx on public.financial_events(company_id,created_at desc);

comment on column public.companies.timezone is 'IANA timezone used for company-local reporting date boundaries.';
comment on table public.financial_events is 'Owner-scoped audit timeline. Reporting reads remain protected by RLS and never accept browser-provided company identity.';
