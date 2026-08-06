-- Forward-only migration: commit_purchase_capture
-- One confirmed purchase is one payload-bound mutation. Every validated item is
-- delegated to the hardened single-batch RPC inside the same PostgreSQL statement,
-- so a failure rolls back the complete purchase and all nested receipts.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.mutation_receipts
  drop constraint mutation_receipts_operation_check;
alter table public.mutation_receipts
  add constraint mutation_receipts_operation_check check (operation in (
    'add_inventory_batch', 'consume_inventory_batch',
    'plan_product', 'add_manual_shopping_item',
    'plan_product_v2', 'edit_meal_plan_item', 'delete_meal_plan_item',
    'generate_shopping_from_plan_v2', 'commit_purchase_capture'
  ));

-- The legacy writer historically defaulted date provenance even when no physical
-- date was supplied. Keep the public boundary compatible for genuinely dateless
-- batches, reject an explicit false provenance claim, and normalize the legacy
-- default before the transaction becomes visible.
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

  request_payload := pg_catalog.jsonb_build_object(
    'target_household', target_household,
    'product_payload', product_payload,
    'batch_payload', batch_payload
  );
  request_hash := pg_catalog.encode(
    extensions.digest(request_payload::text, 'sha256'),
    'hex'
  );

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
    return existing_receipt.result
      || pg_catalog.jsonb_build_object('idempotent_replay', true);
  end if;

  perform inventory_private.assert_product_payload(product_payload);
  perform inventory_private.assert_batch_payload(batch_payload);
  if nullif(batch_payload ->> 'best_before_date', '') is null
    and nullif(batch_payload ->> 'use_by_date', '') is null
    and nullif(batch_payload ->> 'date_source', '') is not null then
    raise exception using errcode = '22023', message = 'Date source requires a confirmed date';
  end if;
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
    and (package_amount is null or package_unit is null);

  if nullif(batch_payload ->> 'best_before_date', '') is null
    and nullif(batch_payload ->> 'use_by_date', '') is null then
    update public.inventory_batches
    set date_source = null,
        date_confidence = null
    where id = (mutation_result ->> 'batch_id')::uuid
      and household_id = target_household;
  end if;

  update public.mutation_receipts
  set result = mutation_result, completed_at = pg_catalog.now()
  where user_id = actor_id
    and public.mutation_receipts.mutation_id = add_inventory_batch.mutation_id;
  return mutation_result;
end;
$$;

revoke all on function public.add_inventory_batch(uuid, jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.add_inventory_batch(uuid, jsonb, jsonb, uuid)
  to authenticated;

create function public.commit_purchase_capture(
  target_household uuid,
  capture_items jsonb,
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
  capture_item jsonb;
  item_mutation_id uuid;
  item_mutation_ids uuid[] := array[]::uuid[];
  item_result jsonb;
  saved_batch_id uuid;
  saved_product_id uuid;
  existing_product_id uuid;
  known_package_amount numeric;
  known_package_unit text;
  package_metadata_was_known boolean := false;
  capture_package_count numeric;
  capture_gtin text;
  effective_batch_payload jsonb;
  batch_ids jsonb := '[]'::jsonb;
  product_ids jsonb := '[]'::jsonb;
  capture_item_count integer;
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
  if capture_items is null or pg_catalog.jsonb_typeof(capture_items) <> 'array' then
    raise exception using errcode = '22023', message = 'Capture items must be an array';
  end if;
  if pg_catalog.octet_length(capture_items::text) > 8388608 then
    raise exception using errcode = '22023', message = 'Capture items payload too large';
  end if;

  capture_item_count := pg_catalog.jsonb_array_length(capture_items);
  if capture_item_count < 1 or capture_item_count > 100 then
    raise exception using errcode = '22023', message = 'Capture item count out of bounds';
  end if;

  request_payload := pg_catalog.jsonb_build_object(
    'target_household', target_household,
    'capture_items', capture_items
  );
  request_hash := pg_catalog.encode(
    extensions.digest(request_payload::text, 'sha256'),
    'hex'
  );

  -- Membership changes serialize on this state row first. Recheck and hold the
  -- active member row so a completed receipt is never disclosed after removal.
  perform 1
  from public.household_membership_state as state
  where state.household_id = target_household
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Household access denied';
  end if;

  perform 1
  from public.household_members as member
  where member.household_id = target_household
    and member.user_id = actor_id
    and member.removed_at is null
  for share;
  if not found then
    raise exception using errcode = '42501', message = 'Household access denied';
  end if;

  -- Idempotency is bound to the accepted historical request, not mutable current
  -- risk/profile/catalog state. A completed exact receipt therefore returns before
  -- payload and personal-risk validation; conflicts and incomplete receipts fail.
  select * into existing_receipt
  from public.mutation_receipts
  where user_id = actor_id
    and public.mutation_receipts.mutation_id = commit_purchase_capture.mutation_id
  for update;
  if found then
    if existing_receipt.operation <> 'commit_purchase_capture'
      or existing_receipt.payload_sha256 <> request_hash then
      raise exception using errcode = '23505', message = 'Mutation ID payload conflict';
    end if;
    if existing_receipt.result is null then
      raise exception using errcode = '40001', message = 'Mutation result not available';
    end if;
    return existing_receipt.result
      || pg_catalog.jsonb_build_object('idempotent_replay', true);
  end if;

  -- Only a new request is validated against mutable current product-risk state.
  -- Validation still completes before product locks and the first item write.
  for capture_item in
    select value
    from pg_catalog.jsonb_array_elements(capture_items) as item(value)
  loop
    if pg_catalog.jsonb_typeof(capture_item) <> 'object'
      or inventory_private.jsonb_has_only_keys(
        capture_item,
        array['item_mutation_id', 'product_payload', 'batch_payload']
      ) is not true
      or not capture_item ? 'item_mutation_id'
      or not capture_item ? 'product_payload'
      or not capture_item ? 'batch_payload' then
      raise exception using errcode = '22023', message = 'Invalid capture item shape';
    end if;
    if pg_catalog.jsonb_typeof(capture_item -> 'item_mutation_id') <> 'string' then
      raise exception using errcode = '22023', message = 'Invalid item mutation ID';
    end if;

    begin
      item_mutation_id := (capture_item ->> 'item_mutation_id')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'Invalid item mutation ID';
    end;
    if item_mutation_id is null then
      raise exception using errcode = '22023', message = 'Invalid item mutation ID';
    end if;
    if item_mutation_id = any(item_mutation_ids) then
      raise exception using errcode = '22023', message = 'Duplicate item mutation ID';
    end if;
    item_mutation_ids := pg_catalog.array_append(item_mutation_ids, item_mutation_id);

    perform inventory_private.assert_product_payload(capture_item -> 'product_payload');
    perform inventory_private.assert_batch_payload(capture_item -> 'batch_payload');
    if (capture_item -> 'batch_payload') ->> 'unit' is distinct from 'piece' then
      raise exception using errcode = '22023', message = 'Capture unit must be piece';
    end if;
    capture_package_count := ((capture_item -> 'batch_payload') ->> 'amount')::numeric;
    if pg_catalog.scale(capture_package_count) <> 0
      or capture_package_count < 1
      or capture_package_count > 999 then
      raise exception using errcode = '22023', message = 'Capture package count out of bounds';
    end if;
    if nullif((capture_item -> 'batch_payload') ->> 'best_before_date', '') is null
      and nullif((capture_item -> 'batch_payload') ->> 'use_by_date', '') is null
      and nullif((capture_item -> 'batch_payload') ->> 'date_source', '') is not null then
      raise exception using errcode = '22023', message = 'Date source requires a confirmed date';
    end if;
    if public.product_payload_has_critical_risk(actor_id, capture_item -> 'product_payload')
      and coalesce(
        ((capture_item -> 'batch_payload') ->> 'personal_risk_confirmed')::boolean,
        false
      ) is not true then
      raise exception using errcode = '22023', message = 'Personal risk confirmation required';
    end if;
  end loop;

  -- Canonical lifecycle/product lock order continues with unique GTIN locks, then
  -- each matching product row, then the nested inventory mutation.
  for capture_gtin in
    select distinct item.value -> 'product_payload' ->> 'barcode' as gtin
    from pg_catalog.jsonb_array_elements(capture_items) as item(value)
    order by gtin
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'commit_purchase_capture:' || target_household::text || ':' || capture_gtin,
        0
      )
    );
  end loop;

  insert into public.mutation_receipts (user_id, mutation_id, operation, payload_sha256)
  values (actor_id, mutation_id, 'commit_purchase_capture', request_hash)
  on conflict do nothing
  returning true into receipt_inserted;

  if not coalesce(receipt_inserted, false) then
    select * into existing_receipt
    from public.mutation_receipts
    where user_id = actor_id
      and public.mutation_receipts.mutation_id = commit_purchase_capture.mutation_id;
    if existing_receipt.operation <> 'commit_purchase_capture'
      or existing_receipt.payload_sha256 <> request_hash then
      raise exception using errcode = '23505', message = 'Mutation ID payload conflict';
    end if;
    if existing_receipt.result is null then
      raise exception using errcode = '40001', message = 'Mutation result not available';
    end if;
    return existing_receipt.result
      || pg_catalog.jsonb_build_object('idempotent_replay', true);
  end if;

  for capture_item in
    select value
    from pg_catalog.jsonb_array_elements(capture_items) as item(value)
  loop
    item_mutation_id := (capture_item ->> 'item_mutation_id')::uuid;
    existing_product_id := null;
    known_package_amount := null;
    known_package_unit := null;
    package_metadata_was_known := false;
    select product.id, product.package_amount, product.package_unit
    into existing_product_id, known_package_amount, known_package_unit
    from public.products as product
    where product.household_id = target_household
      and product.gtin = (capture_item -> 'product_payload') ->> 'barcode'
    for update;
    package_metadata_was_known := existing_product_id is not null
      and known_package_amount is not null
      and known_package_unit is not null;

    capture_package_count := ((capture_item -> 'batch_payload') ->> 'amount')::numeric;
    effective_batch_payload := capture_item -> 'batch_payload';
    if package_metadata_was_known then
      effective_batch_payload := pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
          effective_batch_payload,
          '{amount}',
          pg_catalog.to_jsonb(capture_package_count * known_package_amount)
        ),
        '{unit}',
        pg_catalog.to_jsonb(known_package_unit)
      );
      perform inventory_private.assert_batch_payload(effective_batch_payload);
    end if;

    item_result := public.add_inventory_batch(
      target_household,
      capture_item -> 'product_payload',
      effective_batch_payload,
      item_mutation_id
    );
    begin
      saved_batch_id := (item_result ->> 'batch_id')::uuid;
      saved_product_id := (item_result ->> 'product_id')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '40001', message = 'Inventory mutation result invalid';
    end;
    if saved_batch_id is null or saved_product_id is null then
      raise exception using errcode = '40001', message = 'Inventory mutation result invalid';
    end if;
    if package_metadata_was_known is false then
      update public.products
      set package_amount = 1,
          package_unit = 'piece'
      where id = saved_product_id
        and household_id = target_household;
    end if;
    if nullif((capture_item -> 'batch_payload') ->> 'best_before_date', '') is null
      and nullif((capture_item -> 'batch_payload') ->> 'use_by_date', '') is null then
      update public.inventory_batches
      set date_source = null,
          date_confidence = null
      where id = saved_batch_id
        and household_id = target_household;
    end if;
    batch_ids := batch_ids
      || pg_catalog.jsonb_build_array(saved_batch_id);
    product_ids := product_ids
      || pg_catalog.jsonb_build_array(saved_product_id);
  end loop;

  mutation_result := pg_catalog.jsonb_build_object(
    'batch_ids', batch_ids,
    'product_ids', product_ids,
    'item_count', capture_item_count,
    'idempotent_replay', false
  );
  update public.mutation_receipts
  set result = mutation_result, completed_at = pg_catalog.now()
  where user_id = actor_id
    and public.mutation_receipts.mutation_id = commit_purchase_capture.mutation_id;

  return mutation_result;
end;
$$;

revoke all on function public.commit_purchase_capture(uuid, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.commit_purchase_capture(uuid, jsonb, uuid)
  to authenticated;

commit;
