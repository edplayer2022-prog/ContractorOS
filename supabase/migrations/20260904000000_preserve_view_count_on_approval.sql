-- Approval renders the safe payload internally, but that internal render must not
-- count as an additional customer document view.
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
  update public.estimates set first_viewed_at=e.first_viewed_at,last_viewed_at=e.last_viewed_at,view_count=e.view_count where id=e.id;
  delete from public.public_request_log where id=(select max(id) from public.public_request_log where public_token=target_token and action='estimate_view');
  insert into public.estimate_snapshots(estimate_id,company_id,snapshot_data,approved_total) values(e.id,e.company_id,payload,e.total);
  insert into public.estimate_events(company_id,estimate_id,event_type,metadata) values(e.company_id,e.id,'estimate_approved',jsonb_build_object('signer_name',trim(signer_name)));
  return jsonb_build_object('estimate_number',e.estimate_number,'project_name',e.project_name,'total',e.total,'approved_at',approval_time);
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
  update public.change_orders set first_viewed_at=co.first_viewed_at,last_viewed_at=co.last_viewed_at,view_count=co.view_count where id=co.id;
  delete from public.public_request_log where id=(select max(id) from public.public_request_log where public_token=target_token and action='change_order_view');
  insert into public.change_order_snapshots(change_order_id,company_id,snapshot_data,approved_total) values(co.id,co.company_id,payload,co.total);
  insert into public.estimate_events(company_id,estimate_id,change_order_id,event_type,metadata) values(co.company_id,co.estimate_id,co.id,'change_order_approved',jsonb_build_object('signer_name',trim(signer_name)));
  return jsonb_build_object('number',co.change_order_number,'total',co.total,'new_contract_value',co.new_contract_value,'approved_at',approval_time);
end;
$$;

revoke execute on function public.approve_public_estimate(uuid,text,text,public.signature_type,text,boolean,text,text) from public, anon, authenticated;
revoke execute on function public.approve_public_change_order(uuid,text,text,public.signature_type,text,boolean,text,text) from public, anon, authenticated;
grant execute on function public.approve_public_estimate(uuid,text,text,public.signature_type,text,boolean,text,text) to anon, authenticated;
grant execute on function public.approve_public_change_order(uuid,text,text,public.signature_type,text,boolean,text,text) to anon, authenticated;
