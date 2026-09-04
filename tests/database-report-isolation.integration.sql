-- Run against a development project after the reporting migration.
-- Creates a temporary second company and rolls everything back.
begin;
do $$ declare owner_a uuid; owner_b uuid:=gen_random_uuid();company_b uuid;leaked bigint;begin
  select owner_id into owner_a from public.companies order by created_at limit 1;
  if owner_a is null then raise exception 'QA requires one configured company';end if;
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values('00000000-0000-0000-0000-000000000000',owner_b,'authenticated','authenticated','report-isolation-qa@example.com','',now(),'{}','{}',now(),now());
  insert into public.companies(owner_id,name,owner_name) values(owner_b,'Report Isolation QA','QA') returning id into company_b;
  insert into public.customers(company_id,name) values(company_b,'Company B Secret Customer');
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  execute 'set local role authenticated';
  select count(*) into leaked from public.customers where company_id=company_b;
  if leaked<>0 then raise exception 'Company A can access Company B report rows';end if;
  execute 'reset role';
end $$;
rollback;
select 'PASS' as report_company_isolation,0 as qa_records_left;
