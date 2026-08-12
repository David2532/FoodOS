begin;

create table public.mutation_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id uuid not null,
  operation text not null check (operation in ('add_inventory_batch', 'consume_inventory_batch')),
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, mutation_id)
);

alter table public.mutation_receipts enable row level security;

create policy require_aal2 on public.mutation_receipts as restrictive
  for all to authenticated using (public.has_aal2()) with check (public.has_aal2());
create policy mutation_receipts_own on public.mutation_receipts
  for select to authenticated using (user_id = auth.uid());

grant select on public.mutation_receipts to authenticated;
revoke all on public.mutation_receipts from anon;

create or replace function public.canonical_food_key(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(
    regexp_replace(lower(coalesce(value, '')), '^[a-z]{2}[:_-]', ''),
    '[^a-z0-9äöüß]+', ' ', 'g'
  ));
$$;

create or replace function public.product_payload_has_critical_risk(actor_id uuid, product_payload jsonb)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with candidate_keys as (
    select public.canonical_food_key(value) as key
    from jsonb_array_elements_text(coalesce(product_payload -> 'allergens', '[]'::jsonb)) value
    union
    select public.canonical_food_key(value) as key
    from jsonb_array_elements_text(coalesce(product_payload -> 'additives', '[]'::jsonb)) value
    union
    select public.canonical_food_key(coalesce(value ->> 'normalizedName', value ->> 'name')) as key
    from jsonb_array_elements(coalesce(product_payload -> 'structuredIngredients', '[]'::jsonb)) value
  )
  select exists (
    select 1
    from public.user_food_risk_profiles risk
    join candidate_keys candidate on candidate.key = public.canonical_food_key(risk.canonical_key)
    where risk.user_id = actor_id
      and risk.severity in ('avoid', 'strict_avoid')
      and char_length(candidate.key) >= 2
  );
$$;

create or replace function public.product_has_critical_risk(actor_id uuid, target_product uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with candidate_keys as (
    select public.canonical_food_key(value) as key
    from public.product_metadata metadata
    cross join lateral jsonb_array_elements_text(metadata.value_json) value
    where metadata.product_id = target_product
      and metadata.field_key in ('allergens', 'additives')
    union
    select public.canonical_food_key(coalesce(value ->> 'normalizedName', value ->> 'name')) as key
    from public.product_metadata metadata
    cross join lateral jsonb_array_elements(metadata.value_json) value
    where metadata.product_id = target_product
      and metadata.field_key = 'structured_ingredients'
  )
  select exists (
    select 1
    from public.user_food_risk_profiles risk
    join candidate_keys candidate on candidate.key = public.canonical_food_key(risk.canonical_key)
    where risk.user_id = actor_id
      and risk.severity in ('avoid', 'strict_avoid')
      and char_length(candidate.key) >= 2
  );
$$;

create or replace function public.batch_has_exact_recall(target_batch uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.inventory_batches batch
    join public.products product on product.id = batch.product_id
    join public.recall_events event on product.gtin = any(event.gtins)
    join public.recall_sources source on source.id = event.source_id and source.approved
    where batch.id = target_batch
      and event.status in ('active', 'corrected')
      and batch.lot_number is not null
      and exists (
        select 1
        from unnest(event.lot_numbers) lot
        where public.canonical_food_key(lot) = public.canonical_food_key(batch.lot_number)
      )
  );
$$;

revoke all on function public.canonical_food_key(text) from public, anon, authenticated;
revoke all on function public.product_payload_has_critical_risk(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.product_has_critical_risk(uuid, uuid) from public, anon, authenticated;
revoke all on function public.batch_has_exact_recall(uuid) from public, anon, authenticated;

alter function public.add_inventory_batch(uuid, jsonb, jsonb, uuid)
  rename to add_inventory_batch_legacy;
revoke all on function public.add_inventory_batch_legacy(uuid, jsonb, jsonb, uuid)
  from public, anon, authenticated;

create function public.add_inventory_batch(
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

revoke all on function public.add_inventory_batch(uuid, jsonb, jsonb, uuid) from public;
grant execute on function public.add_inventory_batch(uuid, jsonb, jsonb, uuid) to authenticated;

alter function public.consume_inventory_batch(uuid, numeric, uuid)
  rename to consume_inventory_batch_legacy;
revoke all on function public.consume_inventory_batch_legacy(uuid, numeric, uuid)
  from public, anon, authenticated;

create function public.consume_inventory_batch_v2(
  target_batch uuid,
  consumed_amount numeric,
  mutation_id uuid,
  confirm_past_best_before boolean default false,
  confirm_personal_risk boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  batch_record public.inventory_batches%rowtype;
  request_payload jsonb;
  request_hash text;
  receipt_inserted boolean := false;
  existing_receipt public.mutation_receipts%rowtype;
  mutation_result jsonb;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if consumed_amount <= 0 or mutation_id is null then
    raise exception using errcode = '22023', message = 'Invalid consumption request';
  end if;

  select * into batch_record
  from public.inventory_batches
  where id = target_batch
  for update;
  if not found or not public.is_household_member(batch_record.household_id) then
    raise exception using errcode = '42501', message = 'Batch access denied';
  end if;

  request_payload := jsonb_build_object(
    'target_batch', target_batch,
    'consumed_amount', consumed_amount,
    'confirm_past_best_before', confirm_past_best_before,
    'confirm_personal_risk', confirm_personal_risk
  );
  request_hash := encode(extensions.digest(request_payload::text, 'sha256'), 'hex');

  insert into public.mutation_receipts (user_id, mutation_id, operation, payload_sha256)
  values (actor_id, mutation_id, 'consume_inventory_batch', request_hash)
  on conflict do nothing
  returning true into receipt_inserted;

  if not coalesce(receipt_inserted, false) then
    select * into existing_receipt
    from public.mutation_receipts
    where user_id = actor_id and mutation_receipts.mutation_id = consume_inventory_batch_v2.mutation_id;
    if existing_receipt.operation <> 'consume_inventory_batch'
      or existing_receipt.payload_sha256 <> request_hash then
      raise exception using errcode = '23505', message = 'Mutation ID payload conflict';
    end if;
    if existing_receipt.result is null then
      raise exception using errcode = '40001', message = 'Mutation result not available';
    end if;
    return existing_receipt.result || jsonb_build_object('idempotent_replay', true);
  end if;

  if batch_record.use_by_date is not null and batch_record.use_by_date < current_date then
    raise exception using errcode = '22023', message = 'Use-by date exceeded';
  end if;
  if public.batch_has_exact_recall(target_batch) then
    raise exception using errcode = '22023', message = 'Exact recall match blocks consumption';
  end if;
  if batch_record.best_before_date is not null
    and batch_record.best_before_date < current_date
    and confirm_past_best_before is not true then
    raise exception using errcode = '22023', message = 'Best-before confirmation required';
  end if;
  if public.product_has_critical_risk(actor_id, batch_record.product_id)
    and confirm_personal_risk is not true then
    raise exception using errcode = '22023', message = 'Personal risk confirmation required';
  end if;

  mutation_result := public.consume_inventory_batch_legacy(target_batch, consumed_amount, mutation_id);
  update public.mutation_receipts
  set result = mutation_result, completed_at = now()
  where user_id = actor_id and mutation_receipts.mutation_id = consume_inventory_batch_v2.mutation_id;
  return mutation_result;
end;
$$;

create function public.consume_inventory_batch(
  target_batch uuid,
  consumed_amount numeric,
  mutation_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.consume_inventory_batch_v2(target_batch, consumed_amount, mutation_id, false, false);
$$;

revoke all on function public.consume_inventory_batch_v2(uuid, numeric, uuid, boolean, boolean) from public;
grant execute on function public.consume_inventory_batch_v2(uuid, numeric, uuid, boolean, boolean) to authenticated;
revoke all on function public.consume_inventory_batch(uuid, numeric, uuid) from public;
grant execute on function public.consume_inventory_batch(uuid, numeric, uuid) to authenticated;

commit;
