begin;

-- Security-definer functions bypass table RLS, so every entry point below performs its
-- own AAL2 and household-membership checks before touching private data.

create or replace function public.onboard_household(
  household_name text,
  display_name text default null,
  calorie_target integer default null,
  protein_target_g numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  normalized_household_name text := btrim(household_name);
  new_household_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if char_length(normalized_household_name) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'Invalid household name';
  end if;
  if calorie_target is not null and calorie_target not between 800 and 10000 then
    raise exception using errcode = '22023', message = 'Invalid calorie target';
  end if;
  if protein_target_g is not null and protein_target_g not between 0 and 1000 then
    raise exception using errcode = '22023', message = 'Invalid protein target';
  end if;

  insert into public.profiles (user_id, display_name, calorie_target, protein_target_g)
  values (actor_id, nullif(btrim(display_name), ''), calorie_target, protein_target_g)
  on conflict (user_id) do update set
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    calorie_target = coalesce(excluded.calorie_target, public.profiles.calorie_target),
    protein_target_g = coalesce(excluded.protein_target_g, public.profiles.protein_target_g);

  insert into public.households (name, created_by)
  values (normalized_household_name, actor_id)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, actor_id, 'owner');

  return new_household_id;
end;
$$;

revoke all on function public.onboard_household(text, text, integer, numeric) from public;
grant execute on function public.onboard_household(text, text, integer, numeric) to authenticated;

create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.onboard_household(household_name, null, null, null);
end;
$$;

create or replace function public.add_inventory_batch(
  target_household uuid,
  product_payload jsonb,
  batch_payload jsonb,
  mutation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  existing_batch_id uuid;
  saved_product_id uuid;
  saved_batch_id uuid;
  barcode text := nullif(btrim(product_payload ->> 'barcode'), '');
  product_name text := btrim(product_payload ->> 'name');
  amount numeric;
  selected_unit text;
  selected_location public.storage_location;
  selected_best_before date;
  selected_use_by date;
  selected_source text;
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

  select event.batch_id into existing_batch_id
  from public.inventory_events event
  where event.user_id = actor_id and event.client_mutation_id = mutation_id;
  if existing_batch_id is not null then
    return jsonb_build_object('batch_id', existing_batch_id, 'idempotent_replay', true);
  end if;

  if char_length(product_name) not between 1 and 240 then
    raise exception using errcode = '22023', message = 'Invalid product name';
  end if;
  if barcode is not null and barcode !~ '^[0-9]{8,14}$' then
    raise exception using errcode = '22023', message = 'Invalid barcode';
  end if;

  amount := (batch_payload ->> 'amount')::numeric;
  selected_unit := batch_payload ->> 'unit';
  selected_location := (batch_payload ->> 'location')::public.storage_location;
  selected_best_before := nullif(batch_payload ->> 'best_before_date', '')::date;
  selected_use_by := nullif(batch_payload ->> 'use_by_date', '')::date;
  selected_source := coalesce(nullif(batch_payload ->> 'date_source', ''), 'manual_confirmed');
  if amount <= 0 or selected_unit not in ('g', 'ml', 'piece') then
    raise exception using errcode = '22023', message = 'Invalid batch amount or unit';
  end if;
  if selected_best_before is not null and selected_use_by is not null then
    raise exception using errcode = '22023', message = 'Choose one date kind';
  end if;

  insert into public.products (
    household_id, gtin, name, brand, image_url, ingredients_text, source,
    source_updated_at, data_confidence, user_verified_at
  ) values (
    target_household, barcode, product_name, nullif(product_payload ->> 'brand', ''),
    nullif(product_payload ->> 'imageUrl', ''), nullif(product_payload ->> 'ingredientsText', ''),
    coalesce(nullif(product_payload ->> 'source', ''), 'manual'),
    nullif(product_payload ->> 'retrievedAt', '')::timestamptz,
    coalesce((product_payload ->> 'confidence')::numeric, 0.5), now()
  )
  on conflict (household_id, gtin) do update set
    name = excluded.name,
    brand = coalesce(excluded.brand, public.products.brand),
    image_url = coalesce(excluded.image_url, public.products.image_url),
    ingredients_text = coalesce(excluded.ingredients_text, public.products.ingredients_text),
    source = excluded.source,
    source_updated_at = excluded.source_updated_at,
    data_confidence = excluded.data_confidence,
    user_verified_at = now()
  returning id into saved_product_id;

  insert into public.product_nutrition (
    product_id, basis_amount, basis_unit, energy_kcal, protein_g, carbohydrates_g,
    sugars_g, fat_g, saturated_fat_g, fiber_g, salt_g, source, confidence
  ) values (
    saved_product_id, 100, case when selected_unit = 'ml' then 'ml' else 'g' end,
    nullif(product_payload #>> '{nutrition,kcal100g}', '')::numeric,
    nullif(product_payload #>> '{nutrition,protein100g}', '')::numeric,
    nullif(product_payload #>> '{nutrition,carbs100g}', '')::numeric,
    nullif(product_payload #>> '{nutrition,sugar100g}', '')::numeric,
    nullif(product_payload #>> '{nutrition,fat100g}', '')::numeric,
    nullif(product_payload #>> '{nutrition,saturatedFat100g}', '')::numeric,
    nullif(product_payload #>> '{nutrition,fiber100g}', '')::numeric,
    nullif(product_payload #>> '{nutrition,salt100g}', '')::numeric,
    coalesce(nullif(product_payload ->> 'source', ''), 'manual'),
    coalesce((product_payload ->> 'confidence')::numeric, 0.5)
  ) on conflict (product_id) do update set
    energy_kcal = excluded.energy_kcal,
    protein_g = excluded.protein_g,
    carbohydrates_g = excluded.carbohydrates_g,
    sugars_g = excluded.sugars_g,
    fat_g = excluded.fat_g,
    saturated_fat_g = excluded.saturated_fat_g,
    fiber_g = excluded.fiber_g,
    salt_g = excluded.salt_g,
    source = excluded.source,
    confidence = excluded.confidence,
    updated_at = now();

  insert into public.product_metadata (product_id, field_key, value_json, source, source_updated_at, confidence, user_verified_at)
  select saved_product_id, metadata.field_key, metadata.value_json,
    coalesce(nullif(product_payload ->> 'source', ''), 'manual'),
    nullif(product_payload ->> 'retrievedAt', '')::timestamptz,
    coalesce((product_payload ->> 'confidence')::numeric, 0.5), now()
  from (values
    ('categories', coalesce(product_payload -> 'categories', '[]'::jsonb)),
    ('countries', coalesce(product_payload -> 'countries', '[]'::jsonb)),
    ('labels', coalesce(product_payload -> 'labels', '[]'::jsonb)),
    ('structured_ingredients', coalesce(product_payload -> 'structuredIngredients', '[]'::jsonb)),
    ('allergens', coalesce(product_payload -> 'allergens', '[]'::jsonb)),
    ('traces', coalesce(product_payload -> 'traces', '[]'::jsonb)),
    ('additives', coalesce(product_payload -> 'additives', '[]'::jsonb)),
    ('catalog_details', jsonb_strip_nulls(jsonb_build_object(
      'quantity', product_payload ->> 'quantity',
      'serving_size', product_payload ->> 'servingSize',
      'nutri_score', product_payload ->> 'nutriScore',
      'nova_group', product_payload -> 'novaGroup',
      'source_url', product_payload ->> 'sourceUrl',
      'source_language', product_payload ->> 'sourceLanguage'
    )))
  ) as metadata(field_key, value_json)
  on conflict (product_id, field_key, source) do update set
    value_json = excluded.value_json,
    source_updated_at = excluded.source_updated_at,
    confidence = excluded.confidence,
    user_verified_at = excluded.user_verified_at;

  insert into public.inventory_batches (
    household_id, product_id, location, initial_amount, remaining_amount, unit,
    best_before_date, use_by_date, lot_number, serial_number, purchase_price_cents,
    purchased_at, date_source, date_confidence
  ) values (
    target_household, saved_product_id, selected_location, amount, amount, selected_unit,
    selected_best_before, selected_use_by, nullif(batch_payload ->> 'lot_number', ''),
    nullif(batch_payload ->> 'serial_number', ''),
    nullif(batch_payload ->> 'purchase_price_cents', '')::integer,
    coalesce(nullif(batch_payload ->> 'purchased_at', '')::timestamptz, now()),
    selected_source, 1
  ) returning id into saved_batch_id;

  insert into public.inventory_events (
    household_id, batch_id, user_id, event_type, amount_delta, client_mutation_id
  ) values (target_household, saved_batch_id, actor_id, 'purchase', amount, mutation_id);

  return jsonb_build_object(
    'batch_id', saved_batch_id,
    'product_id', saved_product_id,
    'remaining_amount', amount,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.add_inventory_batch(uuid, jsonb, jsonb, uuid) from public;
grant execute on function public.add_inventory_batch(uuid, jsonb, jsonb, uuid) to authenticated;

create or replace function public.consume_inventory_batch(
  target_batch uuid,
  consumed_amount numeric,
  mutation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  batch_record public.inventory_batches%rowtype;
  product_record public.products%rowtype;
  nutrition_record public.product_nutrition%rowtype;
  existing_event public.inventory_events%rowtype;
  new_remaining numeric;
  nutrition_snapshot jsonb;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if consumed_amount <= 0 or mutation_id is null then
    raise exception using errcode = '22023', message = 'Invalid consumption request';
  end if;

  select * into existing_event from public.inventory_events
  where user_id = actor_id and client_mutation_id = mutation_id;
  if found then
    select remaining_amount into new_remaining from public.inventory_batches where id = existing_event.batch_id;
    return jsonb_build_object('batch_id', existing_event.batch_id, 'remaining_amount', new_remaining, 'idempotent_replay', true);
  end if;

  select * into batch_record from public.inventory_batches where id = target_batch for update;
  if not found or not public.is_household_member(batch_record.household_id) then
    raise exception using errcode = '42501', message = 'Batch access denied';
  end if;
  if batch_record.unit = 'piece' then
    raise exception using errcode = '22023', message = 'Piece conversion requires a confirmed weight';
  end if;
  if batch_record.remaining_amount < consumed_amount then
    raise exception using errcode = '23514', message = 'Insufficient inventory';
  end if;

  select * into product_record from public.products where id = batch_record.product_id;
  select * into nutrition_record from public.product_nutrition where product_id = batch_record.product_id;
  new_remaining := batch_record.remaining_amount - consumed_amount;
  nutrition_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'basis_amount', consumed_amount,
    'basis_unit', batch_record.unit,
    'kcal', round(nutrition_record.energy_kcal * consumed_amount / nullif(nutrition_record.basis_amount, 0), 3),
    'protein_g', round(nutrition_record.protein_g * consumed_amount / nullif(nutrition_record.basis_amount, 0), 3),
    'carbohydrates_g', round(nutrition_record.carbohydrates_g * consumed_amount / nullif(nutrition_record.basis_amount, 0), 3),
    'fat_g', round(nutrition_record.fat_g * consumed_amount / nullif(nutrition_record.basis_amount, 0), 3)
  ));

  update public.inventory_batches set remaining_amount = new_remaining where id = target_batch;
  insert into public.inventory_events (
    household_id, batch_id, user_id, event_type, amount_delta, client_mutation_id
  ) values (
    batch_record.household_id, target_batch, actor_id, 'consume', -consumed_amount, mutation_id
  );
  insert into public.food_log_entries (
    household_id, user_id, product_id, batch_id, amount, unit,
    nutrition_snapshot, client_mutation_id
  ) values (
    batch_record.household_id, actor_id, product_record.id, target_batch, consumed_amount,
    batch_record.unit, nutrition_snapshot, mutation_id
  );

  return jsonb_build_object(
    'batch_id', target_batch,
    'remaining_amount', new_remaining,
    'nutrition', nutrition_snapshot,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.consume_inventory_batch(uuid, numeric, uuid) from public;
grant execute on function public.consume_inventory_batch(uuid, numeric, uuid) to authenticated;

commit;
