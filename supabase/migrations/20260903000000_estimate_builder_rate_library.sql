-- Additive ContractorOS estimating upgrade. Safe to run after the initial schema.
alter type public.estimate_status add value if not exists 'viewed';
alter type public.estimate_status add value if not exists 'rejected';
alter type public.estimate_status add value if not exists 'expired';

alter table public.rate_library
  add column if not exists subcontractor_cost numeric(14,2) not null default 0,
  add column if not exists other_direct_cost numeric(14,2) not null default 0,
  add column if not exists is_sample boolean not null default false;

alter table public.estimate_items
  add column if not exists service_name text,
  add column if not exists labor_hours_per_unit numeric(12,3),
  add column if not exists internal_notes text;

update public.estimate_items
set service_name = coalesce(nullif(service_name, ''), description),
    labor_hours_per_unit = case when quantity > 0 then labor_hours / quantity else 0 end
where service_name is null or labor_hours_per_unit is null;

alter table public.estimate_items alter column service_name set not null;
alter table public.estimate_items alter column labor_hours_per_unit set not null;
alter table public.estimate_items alter column labor_hours_per_unit set default 0;

create or replace function public.sync_estimate_item_labor_hours()
returns trigger language plpgsql set search_path = public as $$
begin
  new.quantity := greatest(coalesce(new.quantity, 0), 0);
  new.labor_hours_per_unit := greatest(coalesce(new.labor_hours_per_unit, 0), 0);
  new.labor_hours := round(new.quantity * new.labor_hours_per_unit, 3);
  return new;
end;
$$;

drop trigger if exists sync_estimate_item_labor_hours on public.estimate_items;
create trigger sync_estimate_item_labor_hours
before insert or update of quantity, labor_hours_per_unit on public.estimate_items
for each row execute procedure public.sync_estimate_item_labor_hours();

alter table public.rate_library
  drop constraint if exists rate_library_subcontractor_cost_check,
  add constraint rate_library_subcontractor_cost_check check (subcontractor_cost >= 0),
  drop constraint if exists rate_library_other_direct_cost_check,
  add constraint rate_library_other_direct_cost_check check (other_direct_cost >= 0),
  drop constraint if exists rate_library_waste_percent_check,
  add constraint rate_library_waste_percent_check check (waste_percent between 0 and 1000),
  drop constraint if exists rate_library_default_overhead_check,
  add constraint rate_library_default_overhead_check check (default_overhead between 0 and 1000),
  drop constraint if exists rate_library_default_markup_check,
  add constraint rate_library_default_markup_check check (default_markup between 0 and 1000);

alter table public.estimate_items
  drop constraint if exists estimate_items_nonnegative_check,
  add constraint estimate_items_nonnegative_check check (
    quantity >= 0 and waste_percent >= 0 and material_unit_cost >= 0 and labor_hours_per_unit >= 0 and
    labor_hours >= 0 and labor_rate >= 0 and equipment_cost >= 0 and subcontractor_cost >= 0 and
    other_direct_cost >= 0 and overhead_percent >= 0 and profit_markup_percent >= 0
  );

create or replace function public.add_sample_rates(target_company_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.rate_library where company_id = target_company_id and is_sample) then return; end if;

  insert into public.rate_library (
    company_id, category, service_name, description, unit, material_cost_per_unit,
    labor_hours_per_unit, labor_rate, waste_percent, equipment_cost, subcontractor_cost,
    other_direct_cost, default_overhead, default_markup, taxable, is_sample
  ) values
    (target_company_id, 'Framing', 'Interior Wall Framing', 'Sample: Frame interior partition walls per plan.', 'linear_foot', 3.25, 0.18, 55, 5, 0, 0, 0, 12, 20, true, true),
    (target_company_id, 'Framing', 'Exterior Wall Framing', 'Sample: Frame exterior walls per plan.', 'linear_foot', 5.75, 0.28, 55, 8, 0, 0, 0, 12, 20, true, true),
    (target_company_id, 'Framing', 'Door Opening Framing', 'Sample: Frame one standard door opening.', 'each', 42, 1.25, 55, 5, 0, 0, 0, 12, 20, true, true),
    (target_company_id, 'Painting', 'Interior Wall Painting', 'Sample: Prepare and paint interior wall surfaces.', 'square_foot', 0.48, 0.018, 52, 10, 0, 0, 0, 12, 22, true, true),
    (target_company_id, 'Painting', 'Exterior Painting', 'Sample: Prepare and paint exterior surfaces.', 'square_foot', 0.72, 0.024, 55, 12, 0, 0, 0, 12, 22, true, true),
    (target_company_id, 'Landscaping', 'Mulch Installation', 'Sample: Supply and install landscape mulch.', 'cubic_yard', 38, 0.8, 48, 5, 18, 0, 0, 10, 20, true, true),
    (target_company_id, 'Landscaping', 'Lawn Mowing', 'Sample: Mow, edge and blow one standard property.', 'each', 0, 0.65, 45, 0, 8, 0, 0, 10, 20, false, true),
    (target_company_id, 'Handyman', 'General Labor', 'Sample: General handyman labor.', 'hour', 0, 1, 65, 0, 0, 0, 0, 10, 20, false, true);
end;
$$;

create or replace function public.seed_company_sample_rates()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.add_sample_rates(new.id); return new; end;
$$;

revoke execute on function public.add_sample_rates(uuid) from public, anon, authenticated;
revoke execute on function public.seed_company_sample_rates() from public, anon, authenticated;

drop trigger if exists seed_company_sample_rates on public.companies;
create trigger seed_company_sample_rates after insert on public.companies
for each row execute procedure public.seed_company_sample_rates();

do $$ declare company_record record;
begin
  for company_record in select id from public.companies loop
    perform public.add_sample_rates(company_record.id);
  end loop;
end $$;

comment on column public.rate_library.is_sample is 'True only for fictional demonstration rates; never market pricing.';
comment on column public.estimate_items.description is 'Private technical description, never customer-facing.';
comment on column public.estimate_items.internal_notes is 'Private contractor notes, never customer-facing.';
