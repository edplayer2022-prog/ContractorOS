-- Financial rows are readable through owner-scoped RLS, but all writes must use
-- the validated security-definer workflow functions. This prevents a browser
-- from choosing company_id or directly changing totals, statuses, or payments.
drop policy if exists projects_owner_all on public.projects;
drop policy if exists invoices_owner_all on public.invoices;
drop policy if exists invoice_items_owner_all on public.invoice_items;
drop policy if exists payments_owner_all on public.payments;
drop policy if exists project_costs_owner_all on public.project_costs;

create policy projects_owner_select on public.projects for select using(public.owns_company(company_id));
create policy invoices_owner_select on public.invoices for select using(public.owns_company(company_id));
create policy invoice_items_owner_select on public.invoice_items for select using(public.owns_company(company_id));
create policy payments_owner_select on public.payments for select using(public.owns_company(company_id));
create policy project_costs_owner_select on public.project_costs for select using(public.owns_company(company_id));

revoke insert,update,delete,truncate,references,trigger on public.projects,public.invoices,public.invoice_items,public.payments,public.project_costs,public.financial_events from authenticated,anon;
grant select on public.projects,public.invoices,public.invoice_items,public.payments,public.project_costs,public.financial_events to authenticated;

