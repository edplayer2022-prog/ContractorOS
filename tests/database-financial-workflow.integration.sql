-- Run after 20260905000000_projects_invoices_payments.sql in a development project.
-- Uses one existing company inside a transaction and rolls back every QA row.
begin;
do $$
declare company uuid; owner uuid; customer uuid; estimate_id uuid; project_id uuid; change_id uuid;
  deposit_invoice uuid; progress_invoice uuid; final_invoice uuid; payment_one uuid; payment_two uuid; token uuid; payload jsonb;
begin
  select id,owner_id into company,owner from public.companies order by created_at limit 1;
  if company is null then raise exception 'QA requires one configured company'; end if;
  perform set_config('request.jwt.claim.sub',owner::text,true);
  insert into public.customers(company_id,name,email) values(company,'Financial Workflow QA','financial-qa@example.com') returning id into customer;
  insert into public.estimates(company_id,customer_id,estimate_number,estimate_date,valid_until,status,project_name,total,deposit_percent,deposit_required,remaining_balance)
  values(company,customer,'QA-FIN-001',current_date,current_date+30,'draft','Financial QA Project',10000,30,3000,7000) returning id into estimate_id;
  insert into public.estimate_items(estimate_id,company_id,category,service_name,description,customer_description,unit,quantity,material_unit_cost,overhead_percent,profit_markup_percent)
  values(estimate_id,company,'QA','QA service','Private QA detail','Customer-safe service','each',1,5000,10,0);
  update public.estimates set status='approved' where id=estimate_id;
  project_id:=public.create_project_from_estimate(estimate_id);
  if (select status from public.projects where id=project_id)<>'upcoming' or (select original_contract_value from public.projects where id=project_id)<>10000 then raise exception 'Approved estimate to project failed'; end if;
  insert into public.change_orders(company_id,estimate_id,change_order_number,change_date,description,status,total,original_contract_value,new_contract_value)
  values(company,estimate_id,'QA-FIN-CO-1',current_date,'Approved QA change','approved',500,10000,10500) returning id into change_id;
  if (select p.original_contract_value+coalesce(sum(co.total) filter(where co.status='approved'),0) from public.projects p left join public.change_orders co on co.estimate_id=p.estimate_id where p.id=project_id group by p.original_contract_value)<>10500 then raise exception 'Approved change order was not included'; end if;
  deposit_invoice:=public.create_invoice(jsonb_build_object('project_id',project_id,'estimate_id',estimate_id,'invoice_type','deposit','invoice_date',current_date,'due_date',current_date+7,'internal_notes','NEVER PUBLIC'),jsonb_build_array(jsonb_build_object('description','Project Deposit','quantity',1,'unit','each','unit_price',3000,'taxable',false)),false);
  if (select total from public.invoices where id=deposit_invoice)<>3000 then raise exception 'Deposit invoice is not $3,000'; end if;
  payment_one:=public.record_payment(deposit_invoice,current_date,1000,'check','QA-CHECK','Partial QA payment',false);
  if (select status<>'partial' or balance_due<>2000 from public.invoices where id=deposit_invoice) then raise exception 'Partial payment calculation failed'; end if;
  payment_two:=public.record_payment(deposit_invoice,current_date,2000,'cash',null,'Final QA payment',false);
  if (select status<>'paid' or balance_due<>0 from public.invoices where id=deposit_invoice) then raise exception 'Full payment calculation failed'; end if;
  perform public.void_payment(payment_two,'QA reversal');
  if (select status<>'partial' or amount_paid<>1000 or balance_due<>2000 from public.invoices where id=deposit_invoice) then raise exception 'Payment void recalculation failed'; end if;
  progress_invoice:=public.create_invoice(jsonb_build_object('project_id',project_id,'estimate_id',estimate_id,'invoice_type','progress','invoice_date',current_date,'due_date',current_date+14),jsonb_build_array(jsonb_build_object('description','Progress Billing - Phase 1','quantity',1,'unit','each','unit_price',2000,'taxable',false)),false);
  final_invoice:=public.create_invoice(jsonb_build_object('project_id',project_id,'estimate_id',estimate_id,'invoice_type','final','invoice_date',current_date,'due_date',current_date+30),jsonb_build_array(jsonb_build_object('description','Final Project Billing','quantity',1,'unit','each','unit_price',5500,'taxable',false)),false);
  if (select total from public.invoices where id=final_invoice)<>5500 then raise exception 'Final invoice remaining amount failed'; end if;
  token:=public.send_invoice(progress_invoice);payload:=public.get_public_invoice(token,'127.0.0.1');
  if payload->>'status'<>'viewed' or payload::text like '%internal_notes%' or payload::text like '%NEVER PUBLIC%' or payload::text like '%estimated_internal_cost%' then raise exception 'Unsafe or invalid public invoice payload'; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename in('projects','invoices','invoice_items','payments','project_costs','financial_events'))<>6 then raise exception 'RLS policies missing'; end if;
end $$;
rollback;
select 'PASS' as financial_workflow_integration,0 as qa_records_left;
