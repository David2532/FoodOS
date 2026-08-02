begin;

drop index if exists public.shopping_plan_product_idx;
create unique index shopping_plan_product_unit_idx
  on public.shopping_items (shopping_list_id, source_product_id, unit)
  where source = 'plan' and source_product_id is not null and unit is not null;

create or replace function public.generate_shopping_from_plan(
  target_household uuid,
  target_week_start date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  list_id uuid;
  requirement record;
  stock record;
  unmet_amount numeric;
  allocated_amount numeric;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if not public.is_household_member(target_household) then
    raise exception using errcode = '42501', message = 'Household access denied';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    actor_id::text || ':' || target_household::text || ':' || target_week_start::text,
    0
  ));

  insert into public.shopping_lists (household_id, week_start, created_by)
  values (target_household, target_week_start, actor_id)
  on conflict (household_id, week_start) do update set updated_at = now()
  returning id into list_id;

  create temporary table if not exists foodos_plan_requirements (
    product_id uuid not null,
    planned_for date not null,
    unit text not null,
    required_amount numeric not null,
    primary key (product_id, planned_for, unit)
  ) on commit drop;
  create temporary table if not exists foodos_plan_inventory (
    batch_id uuid primary key,
    product_id uuid not null,
    unit text not null,
    usable_until date,
    available_amount numeric not null
  ) on commit drop;
  create temporary table if not exists foodos_plan_shortages (
    product_id uuid not null,
    unit text not null,
    missing_amount numeric not null,
    primary key (product_id, unit)
  ) on commit drop;
  truncate foodos_plan_requirements, foodos_plan_inventory, foodos_plan_shortages;

  insert into foodos_plan_requirements (product_id, planned_for, unit, required_amount)
  select product_id, planned_for, unit, sum(required_amount)
  from (
    select slot.product_id, slot.planned_for,
      coalesce(product.package_unit, 'piece') as unit,
      coalesce(product.package_amount, 1) * slot.servings as required_amount
    from public.meal_plan_slots slot
    join public.products product on product.id = slot.product_id
    where slot.household_id = target_household
      and slot.user_id = actor_id
      and slot.planned_for >= target_week_start
      and slot.planned_for < target_week_start + 7
      and slot.product_id is not null
    union all
    select item.product_id, slot.planned_for, item.unit, item.amount * slot.servings
    from public.meal_plan_slots slot
    join public.recipe_items item on item.recipe_id = slot.recipe_id
    where slot.household_id = target_household
      and slot.user_id = actor_id
      and slot.planned_for >= target_week_start
      and slot.planned_for < target_week_start + 7
      and slot.recipe_id is not null
  ) raw_requirements
  group by product_id, planned_for, unit;

  insert into foodos_plan_inventory (batch_id, product_id, unit, usable_until, available_amount)
  select batch.id, batch.product_id, batch.unit,
    coalesce(batch.use_by_date, batch.best_before_date), batch.remaining_amount
  from public.inventory_batches batch
  where batch.household_id = target_household
    and batch.remaining_amount > 0
    and not public.batch_has_exact_recall(batch.id);

  for requirement in
    select * from foodos_plan_requirements
    order by planned_for, product_id, unit
  loop
    unmet_amount := requirement.required_amount;
    for stock in
      select batch_id, available_amount
      from foodos_plan_inventory
      where product_id = requirement.product_id
        and unit = requirement.unit
        and available_amount > 0
        and (usable_until is null or usable_until >= requirement.planned_for)
      order by usable_until asc nulls last, batch_id
      for update
    loop
      allocated_amount := least(unmet_amount, stock.available_amount);
      update foodos_plan_inventory
      set available_amount = available_amount - allocated_amount
      where batch_id = stock.batch_id;
      unmet_amount := unmet_amount - allocated_amount;
      exit when unmet_amount <= 0;
    end loop;

    if unmet_amount > 0 then
      insert into foodos_plan_shortages (product_id, unit, missing_amount)
      values (requirement.product_id, requirement.unit, unmet_amount)
      on conflict (product_id, unit) do update
      set missing_amount = foodos_plan_shortages.missing_amount + excluded.missing_amount;
    end if;
  end loop;

  insert into public.shopping_items (
    shopping_list_id, product_id, label, required_amount, unit, source,
    source_product_id, created_by
  )
  select list_id, shortage.product_id, product.name, shortage.missing_amount,
    shortage.unit, 'plan', shortage.product_id, actor_id
  from foodos_plan_shortages shortage
  join public.products product on product.id = shortage.product_id
  on conflict (shopping_list_id, source_product_id, unit)
    where source = 'plan' and source_product_id is not null and unit is not null
  do update set label = excluded.label, required_amount = excluded.required_amount,
    product_id = excluded.product_id;

  delete from public.shopping_items item
  where item.shopping_list_id = list_id
    and item.source = 'plan'
    and not exists (
      select 1 from foodos_plan_shortages shortage
      where shortage.product_id = item.source_product_id
        and shortage.unit = item.unit
    );

  return list_id;
end;
$$;

revoke all on function public.generate_shopping_from_plan(uuid, date) from public;
grant execute on function public.generate_shopping_from_plan(uuid, date) to authenticated;

commit;
