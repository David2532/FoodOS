begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.meal_plan_slots
  add column planned_amount numeric(12,3),
  add column planned_unit text,
  add column revision bigint not null default 1,
  add column updated_at timestamptz not null default now();

update public.meal_plan_slots as slot
set planned_amount = coalesce(product.package_amount * slot.servings, slot.servings),
    planned_unit = coalesce(product.package_unit, 'piece')
from public.products as product
where slot.product_id = product.id
  and slot.planned_amount is null;

alter table public.meal_plan_slots
  add constraint meal_plan_product_quantity_check check (
    (product_id is not null and planned_amount is not null and planned_amount > 0
      and planned_amount <= 1000000 and planned_unit in ('g', 'ml', 'piece'))
    or
    (recipe_id is not null and planned_amount is null and planned_unit is null)
  ),
  add constraint meal_plan_revision_positive_check check (revision > 0);

create trigger meal_plan_slots_updated
  before update on public.meal_plan_slots
  for each row execute function public.set_updated_at();

alter table public.shopping_lists
  add column calculation_revision bigint not null default 0,
  add column calculation_payload_sha256 text,
  add column last_generation_mutation_id uuid,
  add constraint shopping_calculation_revision_check check (calculation_revision >= 0),
  add constraint shopping_calculation_hash_check check (
    calculation_payload_sha256 is null
    or calculation_payload_sha256 ~ '^[a-f0-9]{64}$'
  );

alter table public.shopping_items
  add column calculation_revision bigint,
  add constraint shopping_item_calculation_revision_check check (
    calculation_revision is null or calculation_revision > 0
  );

alter table public.mutation_receipts
  drop constraint mutation_receipts_operation_check;
alter table public.mutation_receipts
  add constraint mutation_receipts_operation_check check (operation in (
    'add_inventory_batch', 'consume_inventory_batch',
    'plan_product', 'add_manual_shopping_item',
    'plan_product_v2', 'edit_meal_plan_item', 'delete_meal_plan_item',
    'generate_shopping_from_plan_v2'
  ));

-- A household-scoped product uses the user's confirmed physical package quantity for
-- planning. Existing rows are backfilled from the first confirmed inventory intake;
-- future scans update the product in the same atomic intake transaction.
with first_batch as (
  select distinct on (batch.product_id)
    batch.product_id,
    batch.initial_amount,
    batch.unit
  from public.inventory_batches as batch
  order by batch.product_id, batch.created_at, batch.id
)
update public.products as product
set package_amount = first_batch.initial_amount,
    package_unit = first_batch.unit
from first_batch
where product.id = first_batch.product_id
  and (product.package_amount is null or product.package_unit is null);

create or replace function public.add_inventory_batch(
  target_household uuid,
  product_payload jsonb,
  batch_payload jsonb,
  mutation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  request_payload jsonb;
  request_hash text;
  receipt_inserted boolean := false;
  existing_receipt public.mutation_receipts%rowtype;
  mutation_result jsonb;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if not public.is_household_member(target_household) then
    raise exception using errcode = '42501', message = 'Household access denied';
  end if;
  if mutation_id is null then
    raise exception using errcode = '22023', message = 'Mutation ID required';
  end if;

  request_payload := jsonb_build_object(
    'target_household', target_household,
    'product_payload', product_payload,
    'batch_payload', batch_payload
  );
  request_hash := encode(extensions.digest(request_payload::text, 'sha256'), 'hex');

  insert into public.mutation_receipts (user_id, mutation_id, operation, payload_sha256)
  values (actor_id, mutation_id, 'add_inventory_batch', request_hash)
  on conflict do nothing
  returning true into receipt_inserted;

  if not coalesce(receipt_inserted, false) then
    select * into existing_receipt
    from public.mutation_receipts
    where user_id = actor_id
      and public.mutation_receipts.mutation_id = add_inventory_batch.mutation_id;
    if existing_receipt.operation <> 'add_inventory_batch'
      or existing_receipt.payload_sha256 <> request_hash then
      raise exception using errcode = '23505', message = 'Mutation ID payload conflict';
    end if;
    if existing_receipt.result is null then
      raise exception using errcode = '40001', message = 'Mutation result not available';
    end if;
    return existing_receipt.result || jsonb_build_object('idempotent_replay', true);
  end if;

  perform inventory_private.assert_product_payload(product_payload);
  perform inventory_private.assert_batch_payload(batch_payload);

  if public.product_payload_has_critical_risk(actor_id, product_payload)
    and coalesce((batch_payload ->> 'personal_risk_confirmed')::boolean, false) is not true then
    raise exception using errcode = '22023', message = 'Personal risk confirmation required';
  end if;

  mutation_result := public.add_inventory_batch_legacy(
    target_household, product_payload, batch_payload, mutation_id
  );

  update public.products
  set package_amount = (batch_payload ->> 'amount')::numeric,
      package_unit = batch_payload ->> 'unit'
  where id = (mutation_result ->> 'product_id')::uuid
    and household_id = target_household
    -- A later partial remainder must never silently redefine packaging.
    and (package_amount is null or package_unit is null);

  update public.mutation_receipts
  set result = mutation_result, completed_at = now()
  where user_id = actor_id
    and public.mutation_receipts.mutation_id = add_inventory_batch.mutation_id;
  return mutation_result;
end;
$$;

-- Exact and possible GTIN matches both fail closed for stock subtraction. Text-only
-- candidates intentionally remain a review hint and cannot consume inventory here.
create or replace function public.batch_has_blocking_recall(target_batch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.inventory_batches as batch
    join public.products as product on product.id = batch.product_id
    join public.recall_events as event on product.gtin = any(event.gtins)
    join public.recall_sources as source
      on source.id = event.source_id and source.approved
    where batch.id = target_batch
      and event.status in ('active', 'corrected')
      and event.superseded_by is null
  );
$$;

create or replace function public.plan_product_v2(
  target_household uuid,
  target_product uuid,
  target_date date,
  target_meal_type text,
  target_amount numeric,
  target_unit text,
  mutation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  request_payload jsonb;
  request_hash text;
  receipt_inserted boolean := false;
  existing_receipt public.mutation_receipts%rowtype;
  saved_id uuid;
  mutation_result jsonb;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if not public.is_household_member(target_household) then
    raise exception using errcode = '42501', message = 'Household access denied';
  end if;
  if mutation_id is null then
    raise exception using errcode = '22023', message = 'Mutation ID required';
  end if;
  if target_date is null or target_date < date '2000-01-01' or target_date > date '2100-12-31'
    or target_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack')
    or target_amount is null or target_amount <= 0 or target_amount > 1000000
    or target_unit not in ('g', 'ml', 'piece') then
    raise exception using errcode = '22023', message = 'Invalid meal plan request';
  end if;
  if not exists (
    select 1 from public.products
    where id = target_product and household_id = target_household
  ) then
    raise exception using errcode = '42501', message = 'Product access denied';
  end if;

  request_payload := jsonb_build_object(
    'target_household', target_household,
    'target_product', target_product,
    'target_date', target_date,
    'target_meal_type', target_meal_type,
    'target_amount', target_amount,
    'target_unit', target_unit
  );
  request_hash := encode(extensions.digest(request_payload::text, 'sha256'), 'hex');

  insert into public.mutation_receipts (user_id, mutation_id, operation, payload_sha256)
  values (actor_id, mutation_id, 'plan_product_v2', request_hash)
  on conflict do nothing
  returning true into receipt_inserted;

  if not coalesce(receipt_inserted, false) then
    select * into existing_receipt
    from public.mutation_receipts
    where user_id = actor_id
      and public.mutation_receipts.mutation_id = plan_product_v2.mutation_id;
    if existing_receipt.operation <> 'plan_product_v2'
      or existing_receipt.payload_sha256 <> request_hash then
      raise exception using errcode = '23505', message = 'Mutation ID payload conflict';
    end if;
    if existing_receipt.result is null then
      raise exception using errcode = '40001', message = 'Mutation result not available';
    end if;
    return existing_receipt.result || jsonb_build_object('idempotent_replay', true);
  end if;

  insert into public.meal_plan_slots (
    household_id, user_id, planned_for, meal_type, product_id, servings,
    planned_amount, planned_unit, client_mutation_id
  ) values (
    target_household, actor_id, target_date, target_meal_type, target_product, 1,
    target_amount, target_unit, mutation_id
  ) returning id into saved_id;

  mutation_result := jsonb_build_object(
    'id', saved_id, 'revision', 1, 'idempotent_replay', false
  );
  update public.mutation_receipts
  set result = mutation_result, completed_at = now()
  where user_id = actor_id
    and public.mutation_receipts.mutation_id = plan_product_v2.mutation_id;
  return mutation_result;
end;
$$;

create or replace function public.edit_meal_plan_item(
  target_slot uuid,
  target_date date,
  target_meal_type text,
  target_amount numeric,
  target_unit text,
  base_revision bigint,
  mutation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_slot public.meal_plan_slots%rowtype;
  request_payload jsonb;
  request_hash text;
  receipt_inserted boolean := false;
  existing_receipt public.mutation_receipts%rowtype;
  mutation_result jsonb;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if mutation_id is null then
    raise exception using errcode = '22023', message = 'Mutation ID required';
  end if;
  if target_date is null or target_date < date '2000-01-01' or target_date > date '2100-12-31'
    or target_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack')
    or target_amount is null or target_amount <= 0 or target_amount > 1000000
    or target_unit not in ('g', 'ml', 'piece')
    or base_revision is null or base_revision <= 0 then
    raise exception using errcode = '22023', message = 'Invalid meal plan request';
  end if;

  request_payload := jsonb_build_object(
    'target_slot', target_slot,
    'target_date', target_date,
    'target_meal_type', target_meal_type,
    'target_amount', target_amount,
    'target_unit', target_unit,
    'base_revision', base_revision
  );
  request_hash := encode(extensions.digest(request_payload::text, 'sha256'), 'hex');

  insert into public.mutation_receipts (user_id, mutation_id, operation, payload_sha256)
  values (actor_id, mutation_id, 'edit_meal_plan_item', request_hash)
  on conflict do nothing
  returning true into receipt_inserted;

  if not coalesce(receipt_inserted, false) then
    select * into existing_receipt
    from public.mutation_receipts
    where user_id = actor_id
      and public.mutation_receipts.mutation_id = edit_meal_plan_item.mutation_id;
    if existing_receipt.operation <> 'edit_meal_plan_item'
      or existing_receipt.payload_sha256 <> request_hash then
      raise exception using errcode = '23505', message = 'Mutation ID payload conflict';
    end if;
    if existing_receipt.result is null then
      raise exception using errcode = '40001', message = 'Mutation result not available';
    end if;
    return existing_receipt.result || jsonb_build_object('idempotent_replay', true);
  end if;

  select * into current_slot
  from public.meal_plan_slots
  where id = target_slot
  for update;
  if current_slot.id is null or not public.is_household_member(current_slot.household_id) then
    raise exception using errcode = '42501', message = 'Meal plan access denied';
  end if;
  if current_slot.product_id is null then
    raise exception using errcode = '22023', message = 'Recipe slots require recipe editing';
  end if;
  if current_slot.revision <> base_revision then
    raise exception using errcode = '40001', message = 'Meal plan revision conflict';
  end if;

  update public.meal_plan_slots
  set planned_for = target_date,
      meal_type = target_meal_type,
      planned_amount = target_amount,
      planned_unit = target_unit,
      revision = revision + 1
  where id = target_slot;

  mutation_result := jsonb_build_object(
    'id', target_slot, 'revision', base_revision + 1, 'idempotent_replay', false
  );
  update public.mutation_receipts
  set result = mutation_result, completed_at = now()
  where user_id = actor_id
    and public.mutation_receipts.mutation_id = edit_meal_plan_item.mutation_id;
  return mutation_result;
end;
$$;

create or replace function public.delete_meal_plan_item(
  target_slot uuid,
  base_revision bigint,
  mutation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_slot public.meal_plan_slots%rowtype;
  request_payload jsonb;
  request_hash text;
  receipt_inserted boolean := false;
  existing_receipt public.mutation_receipts%rowtype;
  mutation_result jsonb;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if mutation_id is null or base_revision is null or base_revision <= 0 then
    raise exception using errcode = '22023', message = 'Invalid meal plan delete request';
  end if;

  request_payload := jsonb_build_object(
    'target_slot', target_slot,
    'base_revision', base_revision
  );
  request_hash := encode(extensions.digest(request_payload::text, 'sha256'), 'hex');

  insert into public.mutation_receipts (user_id, mutation_id, operation, payload_sha256)
  values (actor_id, mutation_id, 'delete_meal_plan_item', request_hash)
  on conflict do nothing
  returning true into receipt_inserted;

  if not coalesce(receipt_inserted, false) then
    select * into existing_receipt
    from public.mutation_receipts
    where user_id = actor_id
      and public.mutation_receipts.mutation_id = delete_meal_plan_item.mutation_id;
    if existing_receipt.operation <> 'delete_meal_plan_item'
      or existing_receipt.payload_sha256 <> request_hash then
      raise exception using errcode = '23505', message = 'Mutation ID payload conflict';
    end if;
    if existing_receipt.result is null then
      raise exception using errcode = '40001', message = 'Mutation result not available';
    end if;
    return existing_receipt.result || jsonb_build_object('idempotent_replay', true);
  end if;

  select * into current_slot
  from public.meal_plan_slots
  where id = target_slot
  for update;
  if current_slot.id is null or not public.is_household_member(current_slot.household_id) then
    raise exception using errcode = '42501', message = 'Meal plan access denied';
  end if;
  if current_slot.revision <> base_revision then
    raise exception using errcode = '40001', message = 'Meal plan revision conflict';
  end if;

  delete from public.meal_plan_slots where id = target_slot;
  mutation_result := jsonb_build_object(
    'id', target_slot, 'deleted_revision', base_revision, 'idempotent_replay', false
  );
  update public.mutation_receipts
  set result = mutation_result, completed_at = now()
  where user_id = actor_id
    and public.mutation_receipts.mutation_id = delete_meal_plan_item.mutation_id;
  return mutation_result;
end;
$$;

create or replace function public.generate_shopping_from_plan_v2(
  target_household uuid,
  target_week_start date,
  base_calculation_revision bigint,
  mutation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  list_record public.shopping_lists%rowtype;
  request_payload jsonb;
  request_hash text;
  calculation_payload jsonb;
  calculation_hash text;
  next_calculation_revision bigint;
  receipt_inserted boolean := false;
  existing_receipt public.mutation_receipts%rowtype;
  mutation_result jsonb;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if not public.is_household_member(target_household) then
    raise exception using errcode = '42501', message = 'Household access denied';
  end if;
  if mutation_id is null or base_calculation_revision is null
    or base_calculation_revision < 0 then
    raise exception using errcode = '22023', message = 'Invalid shopping generation request';
  end if;
  if target_week_start is null
    or extract(isodow from target_week_start) <> 1
    or target_week_start < date '2000-01-03'
    or target_week_start > date '2100-12-27' then
    raise exception using errcode = '22023', message = 'Week start must be a supported Monday';
  end if;

  request_payload := jsonb_build_object(
    'target_household', target_household,
    'target_week_start', target_week_start,
    'base_calculation_revision', base_calculation_revision
  );
  request_hash := encode(extensions.digest(request_payload::text, 'sha256'), 'hex');

  insert into public.mutation_receipts (user_id, mutation_id, operation, payload_sha256)
  values (actor_id, mutation_id, 'generate_shopping_from_plan_v2', request_hash)
  on conflict do nothing
  returning true into receipt_inserted;

  if not coalesce(receipt_inserted, false) then
    select * into existing_receipt
    from public.mutation_receipts
    where user_id = actor_id
      and public.mutation_receipts.mutation_id = generate_shopping_from_plan_v2.mutation_id;
    if existing_receipt.operation <> 'generate_shopping_from_plan_v2'
      or existing_receipt.payload_sha256 <> request_hash then
      raise exception using errcode = '23505', message = 'Mutation ID payload conflict';
    end if;
    if existing_receipt.result is null then
      raise exception using errcode = '40001', message = 'Mutation result not available';
    end if;
    return existing_receipt.result || jsonb_build_object('idempotent_replay', true);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    target_household::text || ':' || target_week_start::text,
    0
  ));

  insert into public.shopping_lists (household_id, week_start, created_by)
  values (target_household, target_week_start, actor_id)
  on conflict (household_id, week_start) do nothing;

  select * into list_record
  from public.shopping_lists
  where household_id = target_household and week_start = target_week_start
  for update;

  if list_record.calculation_revision <> base_calculation_revision then
    raise exception using errcode = '40001', message = 'Shopping calculation revision conflict';
  end if;
  next_calculation_revision := list_record.calculation_revision + 1;

  calculation_payload := jsonb_build_object(
    'week_start', target_week_start,
    'plan', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', slot.id,
        'revision', slot.revision,
        'planned_for', slot.planned_for,
        'product_id', slot.product_id,
        'recipe_id', slot.recipe_id,
        'amount', slot.planned_amount,
        'unit', slot.planned_unit,
        'servings', slot.servings
      ) order by slot.planned_for, slot.id)
      from public.meal_plan_slots as slot
      where slot.household_id = target_household
        and slot.planned_for >= target_week_start
        and slot.planned_for < target_week_start + 7
        and slot.status = 'planned'
    ), '[]'::jsonb),
    'inventory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', batch.id,
        'product_id', batch.product_id,
        'amount', batch.remaining_amount,
        'unit', batch.unit,
        'best_before', batch.best_before_date,
        'use_by', batch.use_by_date,
        'recall_blocked', public.batch_has_blocking_recall(batch.id)
      ) order by batch.id)
      from public.inventory_batches as batch
      where batch.household_id = target_household
        and batch.remaining_amount > 0
    ), '[]'::jsonb)
  );
  calculation_hash := encode(extensions.digest(calculation_payload::text, 'sha256'), 'hex');

  with requirements as (
    select product_id, planned_for, unit, sum(required_amount) as required_amount
    from (
      select slot.product_id, slot.planned_for,
        coalesce(slot.planned_unit, product.package_unit, 'piece') as unit,
        coalesce(slot.planned_amount, product.package_amount * slot.servings, slot.servings) as required_amount
      from public.meal_plan_slots as slot
      join public.products as product on product.id = slot.product_id
      where slot.household_id = target_household
        and slot.planned_for >= target_week_start
        and slot.planned_for < target_week_start + 7
        and slot.product_id is not null
        and slot.status = 'planned'
      union all
      select item.product_id, slot.planned_for, item.unit, item.amount * slot.servings
      from public.meal_plan_slots as slot
      join public.recipe_items as item on item.recipe_id = slot.recipe_id
      where slot.household_id = target_household
        and slot.planned_for >= target_week_start
        and slot.planned_for < target_week_start + 7
        and slot.recipe_id is not null
        and slot.status = 'planned'
    ) as raw_requirements
    group by product_id, planned_for, unit
  ), threshold_deficits as (
    select threshold.product_id, threshold.unit, threshold.planned_for,
      greatest(0,
        (select coalesce(sum(required.required_amount), 0)
         from requirements as required
         where required.product_id = threshold.product_id
           and required.unit = threshold.unit
           and required.planned_for >= threshold.planned_for)
        -
        (select coalesce(sum(batch.remaining_amount), 0)
         from public.inventory_batches as batch
         where batch.household_id = target_household
           and batch.product_id = threshold.product_id
           and batch.unit = threshold.unit
           and batch.remaining_amount > 0
           and (coalesce(batch.use_by_date, batch.best_before_date) is null
             or coalesce(batch.use_by_date, batch.best_before_date) >= threshold.planned_for)
           and not public.batch_has_blocking_recall(batch.id))
      ) as deficit
    from requirements as threshold
  ), missing as (
    select product_id, unit, max(deficit) as missing_amount
    from threshold_deficits
    group by product_id, unit
    having max(deficit) > 0
  ), upserted as (
    insert into public.shopping_items (
      shopping_list_id, product_id, label, required_amount, unit, source,
      source_product_id, created_by, calculation_revision
    )
    select list_record.id, missing.product_id, product.name, missing.missing_amount,
      missing.unit, 'plan', missing.product_id, actor_id, next_calculation_revision
    from missing
    join public.products as product on product.id = missing.product_id
    on conflict (shopping_list_id, source_product_id, unit)
      where source = 'plan' and source_product_id is not null and unit is not null
    do update set label = excluded.label,
      required_amount = excluded.required_amount,
      product_id = excluded.product_id,
      calculation_revision = excluded.calculation_revision
    returning source_product_id, unit
  )
  delete from public.shopping_items as item
  where item.shopping_list_id = list_record.id
    and item.source = 'plan'
    and not exists (
      select 1 from missing
      where missing.product_id = item.source_product_id
        and missing.unit = item.unit
    );

  update public.shopping_lists
  set calculation_revision = next_calculation_revision,
      calculation_payload_sha256 = calculation_hash,
      last_generation_mutation_id = mutation_id,
      updated_at = now()
  where id = list_record.id;

  mutation_result := jsonb_build_object(
    'list_id', list_record.id,
    'calculation_revision', next_calculation_revision,
    'calculation_payload_sha256', calculation_hash,
    'idempotent_replay', false
  );
  update public.mutation_receipts
  set result = mutation_result, completed_at = now()
  where user_id = actor_id
    and public.mutation_receipts.mutation_id = generate_shopping_from_plan_v2.mutation_id;
  return mutation_result;
end;
$$;

revoke all on function public.add_inventory_batch(uuid, jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.add_inventory_batch(uuid, jsonb, jsonb, uuid)
  to authenticated;

revoke all on function public.batch_has_blocking_recall(uuid)
  from public, anon, authenticated;

revoke all on function public.plan_product_v2(uuid, uuid, date, text, numeric, text, uuid)
  from public, anon, authenticated;
grant execute on function public.plan_product_v2(uuid, uuid, date, text, numeric, text, uuid)
  to authenticated;

revoke all on function public.edit_meal_plan_item(uuid, date, text, numeric, text, bigint, uuid)
  from public, anon, authenticated;
grant execute on function public.edit_meal_plan_item(uuid, date, text, numeric, text, bigint, uuid)
  to authenticated;

revoke all on function public.delete_meal_plan_item(uuid, bigint, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_meal_plan_item(uuid, bigint, uuid)
  to authenticated;

revoke all on function public.generate_shopping_from_plan_v2(uuid, date, bigint, uuid)
  from public, anon, authenticated;
grant execute on function public.generate_shopping_from_plan_v2(uuid, date, bigint, uuid)
  to authenticated;

-- Product identity and confirmed packaging are written atomically by the
-- hardened intake RPC. Direct product mutation would bypass that trust proof.
revoke insert, update, delete on table public.products from authenticated;

-- The legacy entry points cannot express mutation identity, optimistic base
-- revisions, or explicit quantity units. Keep them installed for migration
-- history compatibility, but expose only the complete v2 contract to clients.
revoke execute on function public.plan_product(uuid, uuid, date, text, numeric, uuid)
  from public, anon, authenticated;
revoke execute on function public.generate_shopping_from_plan(uuid, date)
  from public, anon, authenticated;

commit;
