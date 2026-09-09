-- Run in Supabase SQL Editor. Everything is rolled back, including Auth fixtures.
begin;
create function pg_temp.must_fail(statement text) returns void language plpgsql as $$
declare denied boolean:=false;
begin
 begin execute statement;exception when others then denied:=true;end;
 if not denied then raise exception 'SECURITY TEST FAILED: %',statement;end if;
end $$;
do $$
declare
 owner_a uuid:=gen_random_uuid();owner_b uuid:=gen_random_uuid();admin_u uuid:=gen_random_uuid();
 estimator_u uuid:=gen_random_uuid();pm_u uuid:=gen_random_uuid();employee_u uuid:=gen_random_uuid();
 invite_u uuid:=gen_random_uuid();c_a uuid;c_b uuid;customer_a uuid;customer_b uuid;e_a uuid;e_b uuid;
 project_a uuid;project_b uuid;invoice_b uuid;member_id uuid;token text;expired_token text;revoked_token text;doc jsonb;
 u uuid;label text;cost_id uuid;count_rows integer;
begin
 foreach u in array array[owner_a,owner_b,admin_u,estimator_u,pm_u,employee_u,invite_u] loop
  insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values(u,u::text||'@qa.contractoros.test',jsonb_build_object('full_name','QA actor'),now());
 end loop;
 perform set_config('request.jwt.claim.sub',owner_a::text,true);
 insert into public.companies(owner_id,name,owner_name)values(owner_a,'QA team A','QA Owner A') returning id into c_a;
 perform set_config('request.jwt.claim.sub',owner_b::text,true);
 insert into public.companies(owner_id,name,owner_name)values(owner_b,'QA team B','QA Owner B') returning id into c_b;
 -- Role suite preserves full legacy access; plan boundaries have a separate suite.
 update public.company_subscriptions set legacy_access=true where company_id in(c_a,c_b);
 insert into public.customers(company_id,name)values(c_a,'QA customer A')returning id into customer_a;
 insert into public.customers(company_id,name)values(c_b,'QA customer B')returning id into customer_b;
 insert into public.estimates(company_id,customer_id,estimate_number,valid_until,project_name,status,total)values(c_a,customer_a,'QA-A',current_date+30,'QA A','approved',1000)returning id into e_a;
 insert into public.estimates(company_id,customer_id,estimate_number,valid_until,project_name,status,total)values(c_b,customer_b,'QA-B',current_date+30,'QA B','approved',1000)returning id into e_b;
 insert into public.projects(company_id,customer_id,estimate_id,project_number,project_name,notes,employee_notes,original_contract_value,estimated_internal_cost)values(c_a,customer_a,e_a,'QA-P-A','QA project A','SECRET INTERNAL NOTE','Crew meeting at 8am',1000,500)returning id into project_a;
 insert into public.projects(company_id,customer_id,estimate_id,project_number,project_name)values(c_b,customer_b,e_b,'QA-P-B','QA project B')returning id into project_b;
 insert into public.invoices(company_id,customer_id,project_id,estimate_id,invoice_number,due_date,total)values(c_b,customer_b,project_b,e_b,'QA-I-B',current_date+30,1000)returning id into invoice_b;
 insert into public.company_members(company_id,user_id,role,status,email,display_name,accepted_at)values
 (c_a,estimator_u,'estimator','active',estimator_u::text||'@qa.contractoros.test','QA Estimator',now()),
 (c_a,pm_u,'project_manager','active',pm_u::text||'@qa.contractoros.test','QA PM',now()),
 (c_a,employee_u,'employee','active',employee_u::text||'@qa.contractoros.test','QA Employee',now());
 update public.users set company_id=c_a where id in(estimator_u,pm_u,employee_u);
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',owner_a::text,true);
 -- 1. Owner invites Admin; membership role comes from the stored invite.
 token:=public.create_team_invitation(c_a,admin_u::text||'@qa.contractoros.test','admin','QA','Admin');
 if length(token)<>64 then raise exception 'Token entropy failed';end if;
 perform set_config('request.jwt.claim.sub',admin_u::text,true);
 -- 2. Invite accepted exactly once.
 doc:=public.accept_team_invitation(token);
 if doc->>'role'<>'admin' or not public.has_company_permission(c_a,'team.manage')then raise exception 'Admin acceptance failed';end if;
 perform pg_temp.must_fail(format('select public.accept_team_invitation(%L)',token));
 perform pg_temp.must_fail(format('update public.companies set default_overhead=44 where id=%L',c_a));
 perform pg_temp.must_fail(format('select public.create_team_invitation(%L,%L,''owner'')',c_a,'unauthorized@qa.contractoros.test'));
 -- 3,4. Estimator creates/edits estimate, no team or reports, no delete.
 perform set_config('request.jwt.claim.sub',estimator_u::text,true);
 insert into public.estimates(company_id,customer_id,estimate_number,valid_until,project_name)values(c_a,customer_a,'QA-EST',current_date+30,'Estimator QA')returning id into e_a;
 insert into public.estimate_items(company_id,estimate_id,category,service_name,description,unit,material_unit_cost)values(c_a,e_a,'QA','QA service','QA item','each',10);
 delete from public.estimate_items where estimate_id=e_a;
 get diagnostics count_rows=row_count;
 if count_rows<>1 then raise exception 'Estimator item editing failed';end if;
 insert into public.estimate_items(company_id,estimate_id,category,service_name,description,unit,material_unit_cost)values(c_a,e_a,'QA','QA send','QA item','each',10);
 update public.estimates set total=10,subtotal=10 where id=e_a;
 perform public.send_estimate(e_a);
 perform pg_temp.must_fail(format('select public.record_estimate_event(%L,''forged'')',e_a));
 if public.has_company_permission(c_a,'team.manage') or public.has_company_permission(c_a,'reports.view')then raise exception 'Estimator restricted permissions failed';end if;
 perform pg_temp.must_fail(format('select public.create_team_invitation(%L,%L,''admin'')',c_a,'no@qa.contractoros.test'));
 delete from public.estimates where id=e_a;get diagnostics count_rows=row_count;
 if count_rows<>0 then raise exception 'Estimator deleted company data';end if;
 -- 11. Foreign keys and direct API cannot cross tenants.
 if exists(select 1 from public.projects where id=project_b) or exists(select 1 from public.invoices where id=invoice_b)then raise exception 'Cross-company read';end if;
 perform pg_temp.must_fail(format('insert into public.estimates(company_id,customer_id,estimate_number,valid_until,project_name)values(%L,%L,''QA-CROSS'',current_date+30,''Cross'')',c_a,customer_b));
 perform pg_temp.must_fail(format('update public.users set company_id=%L where id=%L',c_b,estimator_u));
 perform pg_temp.must_fail(format('select public.switch_company(%L)',c_b));
 -- 5,6. Employee cannot retrieve any internal table or sensitive company fields.
 perform set_config('request.jwt.claim.sub',owner_a::text,true);
 perform public.assign_project_member(project_a,employee_u);
 perform set_config('request.jwt.claim.sub',employee_u::text,true);
 foreach label in array array['estimates','estimate_items','rate_library','projects','invoices','invoice_items','payments','project_costs','companies','audit_events']loop
  execute format('select count(*) from public.%I',label)into count_rows;
  if count_rows<>0 then raise exception 'Employee leaked %',label;end if;
 end loop;
 doc:=public.get_assigned_projects();
 if jsonb_array_length(doc)<>1 or doc->0->>'notes'<>'Crew meeting at 8am' then raise exception 'Assigned projection failed';end if;
 if doc::text ~* 'SECRET INTERNAL|profit|markup|margin|labor_rate|original_contract_value|estimated_internal_cost' then raise exception 'Financial/notes exposure';end if;
 if public.has_company_permission(c_a,'reports.view')then raise exception 'Employee reports';end if;
 perform pg_temp.must_fail(format('select public.add_project_cost(%L,current_date,''labor'',''Bad'','''',10)',project_a));
 perform pg_temp.must_fail(format('select public.write_audit(%L,''fake'',''project'',%L)',c_a,project_a));
 -- 7,15. PM adds cost, event identifies actor, foreign project/invoice fail.
 perform set_config('request.jwt.claim.sub',pm_u::text,true);
 cost_id:=public.add_project_cost(project_a,current_date,'labor','QA cost','QA vendor',25);
 perform public.update_project_details(project_a,current_date,current_date+3,'Internal PM note','Crew PM note');
 perform pg_temp.must_fail(format('select public.add_project_cost(%L,current_date,''labor'',''Cross'','''',25)',project_b));
 perform pg_temp.must_fail(format('select public.send_invoice(%L)',invoice_b));
 perform set_config('request.jwt.claim.sub',owner_a::text,true);
 if not exists(select 1 from public.audit_events where entity_id=cost_id and user_id=pm_u and user_name='QA actor')then raise exception 'Audit attribution failed';end if;
 -- 8,9. Deactivated member loses session access immediately; reactivation restores role.
 select id into member_id from public.company_members where company_id=c_a and user_id=employee_u;
 perform public.set_member_status(member_id,'deactivated');
 perform set_config('request.jwt.claim.sub',employee_u::text,true);
 if public.has_company_permission(c_a,'dashboard.view') or jsonb_array_length(public.get_assigned_projects())<>0 then raise exception 'Deactivated access retained';end if;
 if exists(select 1 from public.project_members where user_id=employee_u)then raise exception 'Deactivated project assignment leaked';end if;
 perform set_config('request.jwt.claim.sub',owner_a::text,true);
 perform public.set_member_status(member_id,'active');
 perform set_config('request.jwt.claim.sub',employee_u::text,true);
 if not public.has_company_permission(c_a,'assigned_projects.view')then raise exception 'Reactivation failed';end if;
 -- 10. Last Owner cannot be downgraded, deactivated, invited or deleted directly.
 perform set_config('request.jwt.claim.sub',owner_a::text,true);
 select id into member_id from public.company_members where company_id=c_a and user_id=owner_a;
 perform pg_temp.must_fail(format('select public.set_member_status(%L,''deactivated'')',member_id));
 perform pg_temp.must_fail(format('select public.set_member_status(%L,''invited'')',member_id));
 perform pg_temp.must_fail(format('select public.change_member_role(%L,''admin'')',member_id));
 perform pg_temp.must_fail(format('delete from public.company_members where id=%L',member_id));
 -- 12. Role changes update permissions; client cannot forge a role.
 select id into member_id from public.company_members where company_id=c_a and user_id=estimator_u;
 perform public.change_member_role(member_id,'project_manager');
 perform set_config('request.jwt.claim.sub',estimator_u::text,true);
 if public.has_company_permission(c_a,'estimates.create') or not public.has_company_permission(c_a,'project_costs.create')then raise exception 'Role change failed';end if;
 perform pg_temp.must_fail(format('update public.company_members set role=''owner'' where id=%L',member_id));
 -- 13,14. Expired and revoked invites fail.
 perform set_config('request.jwt.claim.sub',owner_a::text,true);
 expired_token:=public.create_team_invitation(c_a,invite_u::text||'@qa.contractoros.test','employee');
 revoked_token:=public.create_team_invitation(c_a,invite_u::text||'@qa.contractoros.test','employee');
 select id into member_id from public.team_invitations where token_hash=encode(extensions.digest(revoked_token,'sha256'),'hex');
 perform public.revoke_team_invitation(member_id);
 execute 'reset role';
 update public.team_invitations set expires_at=now()-interval '1 minute' where token_hash=encode(extensions.digest(expired_token,'sha256'),'hex');
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',invite_u::text,true);
 perform pg_temp.must_fail(format('select public.accept_team_invitation(%L)',expired_token));
 perform pg_temp.must_fail(format('select public.accept_team_invitation(%L)',revoked_token));
 execute 'reset role';
end $$;
rollback;
select 'PASS: 15 team scenarios, API isolation, financial projection, role escalation and invite replay' as team_security, 'All fixtures rolled back' as cleanup;
