begin;

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

  with requirements as (
    select product_id, planned_for, unit, sum(required_amount) as required_amount
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
    group by product_id, planned_for, unit
  ), threshold_deficits as (
    select threshold.product_id, threshold.unit, threshold.planned_for,
      greatest(0,
        (select coalesce(sum(required.required_amount), 0)
         from requirements required
         where required.product_id = threshold.product_id
           and required.unit = threshold.unit
           and required.planned_for >= threshold.planned_for)
        -
        (select coalesce(sum(batch.remaining_amount), 0)
         from public.inventory_batches batch
         where batch.household_id = target_household
           and batch.product_id = threshold.product_id
           and batch.unit = threshold.unit
           and batch.remaining_amount > 0
           and (coalesce(batch.use_by_date, batch.best_before_date) is null
             or coalesce(batch.use_by_date, batch.best_before_date) >= threshold.planned_for)
           and not public.batch_has_exact_recall(batch.id))
      ) as deficit
    from requirements threshold
  ), missing as (
    select product_id, unit, max(deficit) as missing_amount
    from threshold_deficits
    group by product_id, unit
    having max(deficit) > 0
  ), upserted as (
    insert into public.shopping_items (
      shopping_list_id, product_id, label, required_amount, unit, source,
      source_product_id, created_by
    )
    select list_id, missing.product_id, product.name, missing.missing_amount,
      missing.unit, 'plan', missing.product_id, actor_id
    from missing
    join public.products product on product.id = missing.product_id
    on conflict (shopping_list_id, source_product_id, unit)
      where source = 'plan' and source_product_id is not null and unit is not null
    do update set label = excluded.label, required_amount = excluded.required_amount,
      product_id = excluded.product_id
    returning source_product_id, unit
  )
  delete from public.shopping_items item
  where item.shopping_list_id = list_id
    and item.source = 'plan'
    and not exists (
      select 1 from missing
      where missing.product_id = item.source_product_id
        and missing.unit = item.unit
    );

  return list_id;
end;
$$;

revoke all on function public.generate_shopping_from_plan(uuid, date) from public;
grant execute on function public.generate_shopping_from_plan(uuid, date) to authenticated;

commit;
