-- Forward-only migration: harden_inventory_batch_trust_boundary
-- Direct AAL2 callers can invoke the inventory RPC without passing through the web
-- contract. Keep the public signature stable, but validate its complete allowlisted
-- payload before the existing transactional implementation is reached.

begin;

create schema if not exists inventory_private;
revoke all on schema inventory_private from public, anon, authenticated;

create function inventory_private.jsonb_has_only_keys(candidate jsonb, allowed_keys text[])
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  candidate_key text;
begin
  if pg_catalog.jsonb_typeof(candidate) <> 'object' then
    return false;
  end if;

  for candidate_key in select pg_catalog.jsonb_object_keys(candidate)
  loop
    if not candidate_key = any (allowed_keys) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create function inventory_private.jsonb_has_bounded_text(
  candidate jsonb,
  field_name text,
  minimum_length integer,
  maximum_length integer
)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  field_value text;
begin
  if not candidate ? field_name
    or pg_catalog.jsonb_typeof(candidate -> field_name) <> 'string' then
    return false;
  end if;
  field_value := candidate ->> field_name;
  return pg_catalog.char_length(field_value) between minimum_length and maximum_length;
end;
$$;

create function inventory_private.jsonb_is_bounded_text_array(
  candidate jsonb,
  maximum_items integer,
  maximum_text_length integer
)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  element jsonb;
  element_text text;
begin
  if pg_catalog.jsonb_typeof(candidate) <> 'array'
    or pg_catalog.jsonb_array_length(candidate) > maximum_items then
    return false;
  end if;

  for element in select value from pg_catalog.jsonb_array_elements(candidate) as item(value)
  loop
    if pg_catalog.jsonb_typeof(element) <> 'string' then
      return false;
    end if;
    element_text := element #>> '{}';
    if pg_catalog.char_length(element_text) > maximum_text_length then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create function inventory_private.is_bounded_http_url(candidate text)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select pg_catalog.char_length(candidate) between 1 and 2048
    and candidate ~ '^https?://[^[:space:][:cntrl:]]+$';
$$;

create function inventory_private.is_bounded_iso_timestamp(
  candidate text,
  lower_bound timestamp with time zone,
  upper_bound timestamp with time zone
)
returns boolean
language plpgsql
stable
strict
set search_path = pg_catalog
as $$
declare
  parsed timestamp with time zone;
begin
  if candidate !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    return false;
  end if;
  begin
    parsed := candidate::timestamp with time zone;
  exception when others then
    return false;
  end;
  return parsed between lower_bound and upper_bound;
end;
$$;

create function inventory_private.is_bounded_iso_date(
  candidate text,
  lower_bound date,
  upper_bound date
)
returns boolean
language plpgsql
stable
strict
set search_path = pg_catalog
as $$
declare
  parsed date;
begin
  if candidate !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;
  begin
    parsed := candidate::date;
  exception when others then
    return false;
  end;
  return parsed between lower_bound and upper_bound;
end;
$$;

create function inventory_private.assert_product_payload(product_payload jsonb)
returns void
language plpgsql
set search_path = pg_catalog
as $$
declare
  product_source text;
  structured_ingredient jsonb;
  assessment jsonb;
  nutrient_key text;
  nutrient_value jsonb;
  parsed_number numeric;
  numeric_limit numeric;
begin
  if product_payload is null
    or pg_catalog.jsonb_typeof(product_payload) <> 'object'
    or pg_catalog.octet_length(product_payload::text) > 1048576
    or inventory_private.jsonb_has_only_keys(product_payload, array[
      'barcode', 'name', 'brand', 'imageUrl', 'quantity', 'categories', 'countries',
      'ingredientsText', 'structuredIngredients', 'allergens', 'traces', 'additives',
      'labels', 'nutriScore', 'novaGroup', 'servingSize', 'nutrition', 'assessments',
      'source', 'sourceUrl', 'sourceLanguage', 'sourceUpdatedAt', 'databaseLicense',
      'imageLicense', 'retrievedAt', 'confidence'
    ]) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload shape';
  end if;

  if inventory_private.jsonb_has_bounded_text(product_payload, 'barcode', 8, 14) is not true
    or pg_catalog.char_length(product_payload ->> 'barcode') not in (8, 12, 13, 14)
    or not public.is_valid_catalog_gtin(product_payload ->> 'barcode') then
    raise exception using errcode = '22023', message = 'Invalid product payload GTIN';
  end if;
  if inventory_private.jsonb_has_bounded_text(product_payload, 'name', 1, 240) is not true
    or pg_catalog.char_length(pg_catalog.btrim(product_payload ->> 'name')) = 0 then
    raise exception using errcode = '22023', message = 'Invalid product payload text';
  end if;
  if inventory_private.jsonb_has_bounded_text(product_payload, 'source', 1, 32) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload source';
  end if;
  product_source := product_payload ->> 'source';
  if product_source not in ('manual', 'open-food-facts', 'global-catalog', 'cache') then
    raise exception using errcode = '22023', message = 'Invalid product payload source';
  end if;

  if pg_catalog.jsonb_typeof(product_payload -> 'confidence') is distinct from 'number' then
    raise exception using errcode = '22023', message = 'Invalid product payload numeric bounds';
  end if;
  parsed_number := (product_payload ->> 'confidence')::numeric;
  if parsed_number < 0 or parsed_number > 1 then
    raise exception using errcode = '22023', message = 'Invalid product payload numeric bounds';
  end if;

  if inventory_private.jsonb_has_bounded_text(product_payload, 'retrievedAt', 20, 40) is not true
    or inventory_private.is_bounded_iso_timestamp(
      product_payload ->> 'retrievedAt',
      '2000-01-01T00:00:00Z'::timestamp with time zone,
      current_timestamp + interval '1 day'
    ) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload provenance timestamp';
  end if;

  if product_payload ? 'brand'
    and inventory_private.jsonb_has_bounded_text(product_payload, 'brand', 0, 240) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload text';
  end if;
  if product_payload ? 'quantity'
    and inventory_private.jsonb_has_bounded_text(product_payload, 'quantity', 0, 120) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload text';
  end if;
  if product_payload ? 'ingredientsText'
    and inventory_private.jsonb_has_bounded_text(product_payload, 'ingredientsText', 0, 20000) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload text';
  end if;
  if product_payload ? 'nutriScore'
    and inventory_private.jsonb_has_bounded_text(product_payload, 'nutriScore', 0, 16) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload text';
  end if;
  if product_payload ? 'servingSize'
    and inventory_private.jsonb_has_bounded_text(product_payload, 'servingSize', 0, 120) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload text';
  end if;
  if product_payload ? 'sourceLanguage'
    and inventory_private.jsonb_has_bounded_text(product_payload, 'sourceLanguage', 0, 16) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload text';
  end if;
  if product_payload ? 'databaseLicense'
    and inventory_private.jsonb_has_bounded_text(product_payload, 'databaseLicense', 0, 160) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload text';
  end if;
  if product_payload ? 'imageLicense'
    and inventory_private.jsonb_has_bounded_text(product_payload, 'imageLicense', 0, 160) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload text';
  end if;

  if product_payload ? 'imageUrl'
    and (
      inventory_private.jsonb_has_bounded_text(product_payload, 'imageUrl', 1, 2048) is not true
      or inventory_private.is_bounded_http_url(product_payload ->> 'imageUrl') is not true
    ) then
    raise exception using errcode = '22023', message = 'Invalid product payload URL';
  end if;
  if product_payload ? 'sourceUrl'
    and (
      inventory_private.jsonb_has_bounded_text(product_payload, 'sourceUrl', 1, 2048) is not true
      or inventory_private.is_bounded_http_url(product_payload ->> 'sourceUrl') is not true
    ) then
    raise exception using errcode = '22023', message = 'Invalid product payload URL';
  end if;
  if product_payload ? 'sourceUpdatedAt'
    and (
      inventory_private.jsonb_has_bounded_text(product_payload, 'sourceUpdatedAt', 20, 40) is not true
      or inventory_private.is_bounded_iso_timestamp(
        product_payload ->> 'sourceUpdatedAt',
        '2000-01-01T00:00:00Z'::timestamp with time zone,
        current_timestamp + interval '1 day'
      ) is not true
    ) then
    raise exception using errcode = '22023', message = 'Invalid product payload provenance timestamp';
  end if;

  if product_payload ? 'novaGroup' then
    if pg_catalog.jsonb_typeof(product_payload -> 'novaGroup') <> 'number' then
      raise exception using errcode = '22023', message = 'Invalid product payload numeric bounds';
    end if;
    parsed_number := (product_payload ->> 'novaGroup')::numeric;
    if parsed_number <> pg_catalog.trunc(parsed_number) or parsed_number < 1 or parsed_number > 4 then
      raise exception using errcode = '22023', message = 'Invalid product payload numeric bounds';
    end if;
  end if;

  if product_payload ? 'categories'
    and inventory_private.jsonb_is_bounded_text_array(product_payload -> 'categories', 40, 160) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload JSON bounds';
  end if;
  if product_payload ? 'countries'
    and inventory_private.jsonb_is_bounded_text_array(product_payload -> 'countries', 40, 120) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload JSON bounds';
  end if;
  if product_payload ? 'labels'
    and inventory_private.jsonb_is_bounded_text_array(product_payload -> 'labels', 40, 120) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload JSON bounds';
  end if;
  if product_payload ? 'allergens'
    and inventory_private.jsonb_is_bounded_text_array(product_payload -> 'allergens', 100, 160) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload JSON bounds';
  end if;
  if product_payload ? 'traces'
    and inventory_private.jsonb_is_bounded_text_array(product_payload -> 'traces', 100, 160) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload JSON bounds';
  end if;
  if product_payload ? 'additives'
    and inventory_private.jsonb_is_bounded_text_array(product_payload -> 'additives', 100, 80) is not true then
    raise exception using errcode = '22023', message = 'Invalid product payload JSON bounds';
  end if;

  if product_payload ? 'structuredIngredients' then
    if pg_catalog.jsonb_typeof(product_payload -> 'structuredIngredients') is distinct from 'array'
      or pg_catalog.jsonb_array_length(product_payload -> 'structuredIngredients') > 500 then
      raise exception using errcode = '22023', message = 'Invalid product payload JSON bounds';
    end if;
    for structured_ingredient in
      select value from pg_catalog.jsonb_array_elements(product_payload -> 'structuredIngredients') as item(value)
    loop
      if inventory_private.jsonb_has_only_keys(
        structured_ingredient, array['name', 'normalizedName', 'percentage']
      ) is not true
        or inventory_private.jsonb_has_bounded_text(structured_ingredient, 'name', 1, 500) is not true then
        raise exception using errcode = '22023', message = 'Invalid product payload structured ingredient';
      end if;
      if structured_ingredient ? 'normalizedName'
        and inventory_private.jsonb_has_bounded_text(structured_ingredient, 'normalizedName', 0, 240) is not true then
        raise exception using errcode = '22023', message = 'Invalid product payload structured ingredient';
      end if;
      if structured_ingredient ? 'percentage' then
        if pg_catalog.jsonb_typeof(structured_ingredient -> 'percentage') <> 'number' then
          raise exception using errcode = '22023', message = 'Invalid product payload structured ingredient';
        end if;
        parsed_number := (structured_ingredient ->> 'percentage')::numeric;
        if parsed_number < 0 or parsed_number > 100 then
          raise exception using errcode = '22023', message = 'Invalid product payload structured ingredient';
        end if;
      end if;
    end loop;
  end if;

  if product_payload ? 'nutrition' then
    if inventory_private.jsonb_has_only_keys(product_payload -> 'nutrition', array[
      'kcal100g', 'protein100g', 'carbs100g', 'fat100g', 'sugar100g',
      'saturatedFat100g', 'fiber100g', 'salt100g'
    ]) is not true then
      raise exception using errcode = '22023', message = 'Invalid product payload nutrition';
    end if;
    for nutrient_key, nutrient_value in
      select key, value from pg_catalog.jsonb_each(product_payload -> 'nutrition')
    loop
      if pg_catalog.jsonb_typeof(nutrient_value) <> 'number' then
        raise exception using errcode = '22023', message = 'Invalid product payload nutrition';
      end if;
      parsed_number := (nutrient_value #>> '{}')::numeric;
      numeric_limit := case when nutrient_key = 'kcal100g' then 1200 else 100 end;
      if parsed_number < 0 or parsed_number > numeric_limit then
        raise exception using errcode = '22023', message = 'Invalid product payload nutrition';
      end if;
    end loop;
  end if;

  if product_payload ? 'assessments' then
    if pg_catalog.jsonb_typeof(product_payload -> 'assessments') is distinct from 'array'
      or pg_catalog.jsonb_array_length(product_payload -> 'assessments') > 200 then
      raise exception using errcode = '22023', message = 'Invalid product payload assessments';
    end if;
    for assessment in
      select value from pg_catalog.jsonb_array_elements(product_payload -> 'assessments') as item(value)
    loop
      if inventory_private.jsonb_has_only_keys(assessment, array[
        'name', 'originalName', 'eNumber', 'level', 'reason', 'sourceLabel', 'confidence'
      ]) is not true
        or inventory_private.jsonb_has_bounded_text(assessment, 'name', 1, 240) is not true
        or inventory_private.jsonb_has_bounded_text(assessment, 'level', 1, 16) is not true
        or inventory_private.jsonb_has_bounded_text(assessment, 'reason', 1, 1000) is not true
        or (assessment ->> 'level') not in ('avoid', 'watch', 'info', 'ok', 'unknown') then
        raise exception using errcode = '22023', message = 'Invalid product payload assessments';
      end if;
      if assessment ? 'originalName'
        and inventory_private.jsonb_has_bounded_text(assessment, 'originalName', 0, 500) is not true then
        raise exception using errcode = '22023', message = 'Invalid product payload assessments';
      end if;
      if assessment ? 'eNumber'
        and inventory_private.jsonb_has_bounded_text(assessment, 'eNumber', 0, 32) is not true then
        raise exception using errcode = '22023', message = 'Invalid product payload assessments';
      end if;
      if assessment ? 'sourceLabel'
        and inventory_private.jsonb_has_bounded_text(assessment, 'sourceLabel', 0, 240) is not true then
        raise exception using errcode = '22023', message = 'Invalid product payload assessments';
      end if;
      if pg_catalog.jsonb_typeof(assessment -> 'confidence') is distinct from 'number' then
        raise exception using errcode = '22023', message = 'Invalid product payload assessments';
      end if;
      parsed_number := (assessment ->> 'confidence')::numeric;
      if parsed_number < 0 or parsed_number > 1 then
        raise exception using errcode = '22023', message = 'Invalid product payload assessments';
      end if;
    end loop;
  end if;
end;
$$;

create function inventory_private.assert_batch_payload(batch_payload jsonb)
returns void
language plpgsql
set search_path = pg_catalog
as $$
declare
  parsed_number numeric;
  has_best_before boolean;
  has_use_by boolean;
  selected_date_source text;
begin
  if batch_payload is null
    or pg_catalog.jsonb_typeof(batch_payload) <> 'object'
    or pg_catalog.octet_length(batch_payload::text) > 16384
    or inventory_private.jsonb_has_only_keys(batch_payload, array[
      'amount', 'unit', 'location', 'best_before_date', 'use_by_date', 'lot_number',
      'serial_number', 'purchase_price_cents', 'purchased_at', 'date_source',
      'personal_risk_confirmed'
    ]) is not true then
    raise exception using errcode = '22023', message = 'Invalid batch payload shape';
  end if;

  if pg_catalog.jsonb_typeof(batch_payload -> 'amount') is distinct from 'number' then
    raise exception using errcode = '22023', message = 'Invalid batch payload numeric bounds';
  end if;
  parsed_number := (batch_payload ->> 'amount')::numeric;
  if parsed_number <= 0 or parsed_number > 1000000 or pg_catalog.scale(parsed_number) > 3 then
    raise exception using errcode = '22023', message = 'Invalid batch payload numeric bounds';
  end if;
  if inventory_private.jsonb_has_bounded_text(batch_payload, 'unit', 1, 16) is not true
    or (batch_payload ->> 'unit') not in ('g', 'ml', 'piece') then
    raise exception using errcode = '22023', message = 'Invalid batch payload unit';
  end if;
  if inventory_private.jsonb_has_bounded_text(batch_payload, 'location', 1, 16) is not true
    or (batch_payload ->> 'location') not in ('fridge', 'freezer', 'pantry', 'drinks', 'other') then
    raise exception using errcode = '22023', message = 'Invalid batch payload location';
  end if;

  if batch_payload ? 'lot_number'
    and batch_payload -> 'lot_number' <> 'null'::jsonb
    and inventory_private.jsonb_has_bounded_text(batch_payload, 'lot_number', 0, 120) is not true then
    raise exception using errcode = '22023', message = 'Invalid batch payload text';
  end if;
  if batch_payload ? 'serial_number'
    and batch_payload -> 'serial_number' <> 'null'::jsonb
    and inventory_private.jsonb_has_bounded_text(batch_payload, 'serial_number', 0, 120) is not true then
    raise exception using errcode = '22023', message = 'Invalid batch payload text';
  end if;

  if batch_payload ? 'purchase_price_cents'
    and batch_payload -> 'purchase_price_cents' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(batch_payload -> 'purchase_price_cents') <> 'number' then
      raise exception using errcode = '22023', message = 'Invalid batch payload numeric bounds';
    end if;
    parsed_number := (batch_payload ->> 'purchase_price_cents')::numeric;
    if parsed_number <> pg_catalog.trunc(parsed_number) or parsed_number < 0 or parsed_number > 100000000 then
      raise exception using errcode = '22023', message = 'Invalid batch payload numeric bounds';
    end if;
  end if;
  if batch_payload ? 'personal_risk_confirmed'
    and pg_catalog.jsonb_typeof(batch_payload -> 'personal_risk_confirmed') <> 'boolean' then
    raise exception using errcode = '22023', message = 'Invalid batch payload confirmation';
  end if;

  has_best_before := batch_payload ? 'best_before_date'
    and batch_payload -> 'best_before_date' <> 'null'::jsonb
    and nullif(batch_payload ->> 'best_before_date', '') is not null;
  has_use_by := batch_payload ? 'use_by_date'
    and batch_payload -> 'use_by_date' <> 'null'::jsonb
    and nullif(batch_payload ->> 'use_by_date', '') is not null;

  if has_best_before and (
    pg_catalog.jsonb_typeof(batch_payload -> 'best_before_date') <> 'string'
    or inventory_private.is_bounded_iso_date(
      batch_payload ->> 'best_before_date', '2000-01-01'::date, '2100-12-31'::date
    ) is not true
  ) then
    raise exception using errcode = '22023', message = 'Invalid batch payload date bounds';
  end if;
  if has_use_by and (
    pg_catalog.jsonb_typeof(batch_payload -> 'use_by_date') <> 'string'
    or inventory_private.is_bounded_iso_date(
      batch_payload ->> 'use_by_date', '2000-01-01'::date, '2100-12-31'::date
    ) is not true
  ) then
    raise exception using errcode = '22023', message = 'Invalid batch payload date bounds';
  end if;
  if has_best_before and has_use_by then
    raise exception using errcode = '22023', message = 'Invalid batch payload date combination';
  end if;

  selected_date_source := case
    when batch_payload ? 'date_source' and batch_payload -> 'date_source' <> 'null'::jsonb
      then batch_payload ->> 'date_source'
    else null
  end;
  if selected_date_source is not null and (
    pg_catalog.jsonb_typeof(batch_payload -> 'date_source') <> 'string'
    or selected_date_source not in ('manual_confirmed', 'gs1_confirmed')
  ) then
    raise exception using errcode = '22023', message = 'Invalid batch payload date source';
  end if;
  if (has_best_before or has_use_by) and selected_date_source is null then
    raise exception using errcode = '22023', message = 'Invalid batch payload date combination';
  end if;

  if batch_payload ? 'purchased_at'
    and batch_payload -> 'purchased_at' <> 'null'::jsonb
    and (
      pg_catalog.jsonb_typeof(batch_payload -> 'purchased_at') <> 'string'
      or inventory_private.is_bounded_iso_timestamp(
        batch_payload ->> 'purchased_at',
        '2000-01-01T00:00:00Z'::timestamp with time zone,
        current_timestamp + interval '1 day'
      ) is not true
    ) then
    raise exception using errcode = '22023', message = 'Invalid batch payload purchase timestamp';
  end if;
end;
$$;

revoke all on all functions in schema inventory_private from public, anon, authenticated;
alter default privileges in schema inventory_private revoke execute on functions from public;

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
    where user_id = actor_id and mutation_receipts.mutation_id = add_inventory_batch.mutation_id;
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
  update public.mutation_receipts
  set result = mutation_result, completed_at = now()
  where user_id = actor_id and mutation_receipts.mutation_id = add_inventory_batch.mutation_id;
  return mutation_result;
end;
$$;

revoke all on function public.add_inventory_batch(uuid, jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.add_inventory_batch(uuid, jsonb, jsonb, uuid)
  to authenticated;

commit;
