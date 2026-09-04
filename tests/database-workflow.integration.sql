-- Run against a migrated development database. Creates isolated QA records,
-- validates the public lifecycle, then removes every QA record before commit.
do $$
declare
  company uuid; customer uuid; estimate_ok uuid; estimate_reject uuid; estimate_expired uuid;
  change_id uuid; token_ok uuid:=gen_random_uuid(); token_reject uuid:=gen_random_uuid();
  token_expired uuid:=gen_random_uuid(); token_change uuid:=gen_random_uuid(); payload jsonb; blocked boolean:=false;
begin
  select id into company from public.companies order by created_at limit 1;
  if company is null then raise exception 'QA requires one configured company'; end if;
  insert into public.customers(company_id,name,company_name,email) values(company,'ContractorOS Workflow QA','Temporary QA','qa@example.com') returning id into customer;

  insert into public.estimates(company_id,customer_id,estimate_number,estimate_date,valid_until,status,project_name,subtotal,sales_tax_amount,total,deposit_required,remaining_balance,public_token,sent_at)
  values(company,customer,'QA-APPROVE',current_date,current_date+30,'sent','Approval QA',1000,70,1070,321,749,token_ok,now()) returning id into estimate_ok;
  insert into public.estimate_items(estimate_id,company_id,sort_order,category,service_name,description,customer_description,unit,quantity,labor_hours_per_unit,labor_hours,labor_rate,overhead_percent,profit_markup_percent)
  values(estimate_ok,company,0,'QA','Private QA service','Private technical text','Customer-safe service','each',1,10,10,50,25,60);
  payload:=public.get_public_estimate(token_ok,'127.0.0.1');
  if payload->>'status'<>'viewed' or payload::text like '%labor_rate%' or payload::text like '%internal_notes%' then raise exception 'Unsafe or invalid public estimate payload'; end if;
  perform public.approve_public_estimate(token_ok,'QA Signer','qa@example.com','typed','QA Signature',true,'ContractorOS QA','127.0.0.1');
  if (select view_count from public.estimates where id=estimate_ok)<>1 then raise exception 'Approval changed estimate view count'; end if;
  if not exists(select 1 from public.estimate_snapshots where estimate_id=estimate_ok) then raise exception 'Estimate snapshot missing'; end if;
  begin update public.estimates set project_name='Silent mutation' where id=estimate_ok; exception when others then blocked:=true; end;
  if not blocked then raise exception 'Approved estimate mutation was not blocked'; end if;

  insert into public.estimates(company_id,customer_id,estimate_number,estimate_date,valid_until,status,project_name,total,public_token,sent_at)
  values(company,customer,'QA-REJECT',current_date,current_date+30,'sent','Reject QA',100,token_reject,now()) returning id into estimate_reject;
  perform public.reject_public_estimate(token_reject,'Price','QA decline','127.0.0.1');
  if (select status from public.estimates where id=estimate_reject)<>'rejected' then raise exception 'Reject transition failed'; end if;

  insert into public.estimates(company_id,customer_id,estimate_number,estimate_date,valid_until,status,project_name,total,public_token,sent_at)
  values(company,customer,'QA-EXPIRED',current_date-40,current_date-1,'sent','Expired QA',100,token_expired,now()) returning id into estimate_expired;
  payload:=public.get_public_estimate(token_expired,'127.0.0.1');
  if payload->>'status'<>'expired' then raise exception 'Expiration transition failed'; end if;
  blocked:=false;
  begin perform public.approve_public_estimate(token_expired,'QA Signer','qa@example.com','typed','QA Signature',true,'ContractorOS QA','127.0.0.1'); exception when others then blocked:=true; end;
  if not blocked then raise exception 'Expired estimate approval was not blocked'; end if;

  insert into public.change_orders(company_id,estimate_id,change_order_number,change_date,description,status,public_token,subtotal,sales_tax_amount,total,original_contract_value,previous_changes_value,new_contract_value,sent_at)
  values(company,estimate_ok,'QA-APPROVE-CO-01',current_date,'QA change','sent',token_change,100,7,107,1070,0,1177,now()) returning id into change_id;
  insert into public.change_order_items(change_order_id,company_id,description,quantity,unit,unit_price,taxable) values(change_id,company,'Customer-safe change',1,'each',100,true);
  payload:=public.get_public_change_order(token_change,'127.0.0.1');
  if payload->>'status'<>'viewed' or (payload->'summary'->>'new_contract_value')::numeric<>1177 then raise exception 'Change order view or contract value failed'; end if;
  perform public.approve_public_change_order(token_change,'QA Signer','qa@example.com','typed','QA Signature',true,'ContractorOS QA','127.0.0.1');
  if (select view_count from public.change_orders where id=change_id)<>1 then raise exception 'Approval changed change-order view count'; end if;
  if not exists(select 1 from public.change_order_snapshots where change_order_id=change_id) then raise exception 'Change order snapshot missing'; end if;

  delete from public.change_order_snapshots where change_order_id=change_id;
  delete from public.change_order_approvals where change_order_id=change_id;
  update public.change_orders set status='draft' where id=change_id;
  delete from public.change_orders where id=change_id;
  delete from public.estimate_snapshots where estimate_id=estimate_ok;
  delete from public.estimate_approvals where estimate_id=estimate_ok;
  update public.estimates set status='draft' where id in(estimate_ok,estimate_reject,estimate_expired);
  delete from public.estimates where id in(estimate_ok,estimate_reject,estimate_expired);
  delete from public.customers where id=customer;
  delete from public.public_request_log where public_token in(token_ok,token_reject,token_expired,token_change);
end $$;
select 'PASS' as workflow_integration, 0 as qa_records_left;
