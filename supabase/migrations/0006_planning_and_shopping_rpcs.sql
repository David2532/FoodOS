begin;

alter table public.meal_plan_slots add column if not exists client_mutation_id uuid;
create unique index if not exists meal_plan_user_mutation_idx
  on public.meal_plan_slots (user_id, client_mutation_id)
  where client_mutation_id is not null;

alter table public.shopping_items
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'plan')),
  add column if not exists source_product_id uuid references public.products(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists client_mutation_id uuid;
create unique index if not exists shopping_item_user_mutation_idx
  on public.shopping_items (created_by, client_mutation_id)
  where client_mutation_id is not null;
create unique index if not exists shopping_plan_product_idx
  on public.shopping_items (shopping_list_id, source_product_id)
  where source = 'plan' and source_product_id is not null;

create or replace function public.plan_product(
  target_household uuid,
  target_product uuid,
  target_date date,
  target_meal_type text,
  target_servings numeric,
  mutation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  saved_id uuid;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if not public.is_household_member(target_household) then
    raise exception using errcode = '42501', message = 'Household access denied';
  end if;
  if target_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack')
    or target_servings <= 0 or target_servings > 100 or mutation_id is null then
    raise exception using errcode = '22023', message = 'Invalid meal plan request';
  end if;
  if not exists (
    select 1 from public.products
    where id = target_product and household_id = target_household
  ) then
    raise exception using errcode = '42501', message = 'Product access denied';
  end if;

  select id into saved_id from public.meal_plan_slots
  where user_id = actor_id and client_mutation_id = mutation_id;
  if saved_id is not null then return saved_id; end if;

  insert into public.meal_plan_slots (
    household_id, user_id, planned_for, meal_type, product_id, servings,
    client_mutation_id
  ) values (
    target_household, actor_id, target_date, target_meal_type, target_product,
    target_servings, mutation_id
  ) returning id into saved_id;
  return saved_id;
end;
$$;

create or replace function public.add_manual_shopping_item(
  target_household uuid,
  target_week_start date,
  item_label text,
  item_amount numeric,
  item_unit text,
  mutation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  list_id uuid;
  saved_id uuid;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if not public.is_household_member(target_household) then
    raise exception using errcode = '42501', message = 'Household access denied';
  end if;
  if char_length(btrim(item_label)) not between 1 and 160 or mutation_id is null
    or (item_amount is not null and item_amount <= 0) then
    raise exception using errcode = '22023', message = 'Invalid shopping item';
  end if;
  if item_unit is not null and item_unit not in ('g', 'ml', 'piece') then
    raise exception using errcode = '22023', message = 'Invalid shopping unit';
  end if;

  select id into saved_id from public.shopping_items
  where created_by = actor_id and client_mutation_id = mutation_id;
  if saved_id is not null then return saved_id; end if;

  insert into public.shopping_lists (household_id, week_start, created_by)
  values (target_household, target_week_start, actor_id)
  on conflict (household_id, week_start) do update set updated_at = now()
  returning id into list_id;

  insert into public.shopping_items (
    shopping_list_id, label, required_amount, unit, source, created_by,
    client_mutation_id
  ) values (
    list_id, btrim(item_label), item_amount, item_unit, 'manual', actor_id,
    mutation_id
  ) returning id into saved_id;
  return saved_id;
end;
$$;

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

  insert into public.shopping_lists (household_id, week_start, created_by)
  values (target_household, target_week_start, actor_id)
  on conflict (household_id, week_start) do update set updated_at = now()
  returning id into list_id;

  with requirements as (
    select product_id, unit, sum(required_amount) as required_amount
    from (
      select slot.product_id,
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
      select item.product_id, item.unit, item.amount * slot.servings
      from public.meal_plan_slots slot
      join public.recipe_items item on item.recipe_id = slot.recipe_id
      where slot.household_id = target_household
        and slot.user_id = actor_id
        and slot.planned_for >= target_week_start
        and slot.planned_for < target_week_start + 7
        and slot.recipe_id is not null
    ) raw_requirements
    group by product_id, unit
  ), usable_inventory as (
    select product_id, unit, sum(remaining_amount) as usable_amount
    from public.inventory_batches
    where household_id = target_household and remaining_amount > 0
      and (use_by_date is null or use_by_date >= current_date)
    group by product_id, unit
  ), missing as (
    select requirement.product_id, product.name,
      greatest(0, requirement.required_amount - coalesce(inventory.usable_amount, 0)) as missing_amount,
      requirement.unit
    from requirements requirement
    join public.products product on product.id = requirement.product_id
    left join usable_inventory inventory
      on inventory.product_id = requirement.product_id and inventory.unit = requirement.unit
  )
  insert into public.shopping_items (
    shopping_list_id, product_id, label, required_amount, unit, source,
    source_product_id, created_by
  )
  select list_id, product_id, name, missing_amount, unit, 'plan', product_id, actor_id
  from missing where missing_amount > 0
  on conflict (shopping_list_id, source_product_id) where source = 'plan' and source_product_id is not null
  do update set label = excluded.label, required_amount = excluded.required_amount,
    unit = excluded.unit, product_id = excluded.product_id;

  delete from public.shopping_items item
  where item.shopping_list_id = list_id and item.source = 'plan'
    and not exists (
      select 1 from public.meal_plan_slots slot
      where slot.household_id = target_household
        and slot.user_id = actor_id
        and slot.planned_for >= target_week_start
        and slot.planned_for < target_week_start + 7
        and (slot.product_id = item.source_product_id or exists (
          select 1 from public.recipe_items recipe_item
          where recipe_item.recipe_id = slot.recipe_id
            and recipe_item.product_id = item.source_product_id
        ))
    );

  return list_id;
end;
$$;

create or replace function public.set_shopping_item_checked(
  target_item uuid,
  checked boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  update public.shopping_items item
  set checked_at = case when checked then now() else null end
  from public.shopping_lists list
  where item.id = target_item and list.id = item.shopping_list_id
    and public.is_household_member(list.household_id);
  if not found then
    raise exception using errcode = '42501', message = 'Shopping item access denied';
  end if;
end;
$$;

revoke all on function public.plan_product(uuid, uuid, date, text, numeric, uuid) from public;
revoke all on function public.add_manual_shopping_item(uuid, date, text, numeric, text, uuid) from public;
revoke all on function public.generate_shopping_from_plan(uuid, date) from public;
revoke all on function public.set_shopping_item_checked(uuid, boolean) from public;
grant execute on function public.plan_product(uuid, uuid, date, text, numeric, uuid) to authenticated;
grant execute on function public.add_manual_shopping_item(uuid, date, text, numeric, text, uuid) to authenticated;
grant execute on function public.generate_shopping_from_plan(uuid, date) to authenticated;
grant execute on function public.set_shopping_item_checked(uuid, boolean) to authenticated;

revoke insert, update, delete on public.meal_plan_slots from authenticated;
revoke insert, update, delete on public.shopping_lists from authenticated;
revoke insert, update, delete on public.shopping_items from authenticated;

commit;
