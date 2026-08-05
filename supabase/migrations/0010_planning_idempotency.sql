begin;

alter table public.mutation_receipts drop constraint mutation_receipts_operation_check;
alter table public.mutation_receipts add constraint mutation_receipts_operation_check
  check (operation in (
    'add_inventory_batch', 'consume_inventory_batch',
    'plan_product', 'add_manual_shopping_item'
  ));

alter function public.plan_product(uuid, uuid, date, text, numeric, uuid)
  rename to plan_product_legacy;
revoke all on function public.plan_product_legacy(uuid, uuid, date, text, numeric, uuid)
  from public, anon, authenticated;

create function public.plan_product(
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
  request_payload jsonb;
  request_hash text;
  receipt_inserted boolean := false;
  existing_receipt public.mutation_receipts%rowtype;
  saved_id uuid;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if mutation_id is null then
    raise exception using errcode = '22023', message = 'Mutation ID required';
  end if;

  request_payload := jsonb_build_object(
    'target_household', target_household,
    'target_product', target_product,
    'target_date', target_date,
    'target_meal_type', target_meal_type,
    'target_servings', target_servings
  );
  request_hash := encode(extensions.digest(request_payload::text, 'sha256'), 'hex');

  insert into public.mutation_receipts (user_id, mutation_id, operation, payload_sha256)
  values (actor_id, mutation_id, 'plan_product', request_hash)
  on conflict do nothing
  returning true into receipt_inserted;

  if not coalesce(receipt_inserted, false) then
    select * into existing_receipt
    from public.mutation_receipts
    where user_id = actor_id and mutation_receipts.mutation_id = plan_product.mutation_id;
    if existing_receipt.operation <> 'plan_product'
      or existing_receipt.payload_sha256 <> request_hash then
      raise exception using errcode = '23505', message = 'Mutation ID payload conflict';
    end if;
    if existing_receipt.result is null then
      raise exception using errcode = '40001', message = 'Mutation result not available';
    end if;
    return (existing_receipt.result ->> 'id')::uuid;
  end if;

  saved_id := public.plan_product_legacy(
    target_household, target_product, target_date, target_meal_type,
    target_servings, mutation_id
  );
  update public.mutation_receipts
  set result = jsonb_build_object('id', saved_id), completed_at = now()
  where user_id = actor_id and mutation_receipts.mutation_id = plan_product.mutation_id;
  return saved_id;
end;
$$;

alter function public.add_manual_shopping_item(uuid, date, text, numeric, text, uuid)
  rename to add_manual_shopping_item_legacy;
revoke all on function public.add_manual_shopping_item_legacy(uuid, date, text, numeric, text, uuid)
  from public, anon, authenticated;

create function public.add_manual_shopping_item(
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
  request_payload jsonb;
  request_hash text;
  receipt_inserted boolean := false;
  existing_receipt public.mutation_receipts%rowtype;
  saved_id uuid;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if mutation_id is null then
    raise exception using errcode = '22023', message = 'Mutation ID required';
  end if;

  request_payload := jsonb_build_object(
    'target_household', target_household,
    'target_week_start', target_week_start,
    'item_label', btrim(item_label),
    'item_amount', item_amount,
    'item_unit', item_unit
  );
  request_hash := encode(extensions.digest(request_payload::text, 'sha256'), 'hex');

  insert into public.mutation_receipts (user_id, mutation_id, operation, payload_sha256)
  values (actor_id, mutation_id, 'add_manual_shopping_item', request_hash)
  on conflict do nothing
  returning true into receipt_inserted;

  if not coalesce(receipt_inserted, false) then
    select * into existing_receipt
    from public.mutation_receipts
    where user_id = actor_id and mutation_receipts.mutation_id = add_manual_shopping_item.mutation_id;
    if existing_receipt.operation <> 'add_manual_shopping_item'
      or existing_receipt.payload_sha256 <> request_hash then
      raise exception using errcode = '23505', message = 'Mutation ID payload conflict';
    end if;
    if existing_receipt.result is null then
      raise exception using errcode = '40001', message = 'Mutation result not available';
    end if;
    return (existing_receipt.result ->> 'id')::uuid;
  end if;

  saved_id := public.add_manual_shopping_item_legacy(
    target_household, target_week_start, item_label, item_amount, item_unit, mutation_id
  );
  update public.mutation_receipts
  set result = jsonb_build_object('id', saved_id), completed_at = now()
  where user_id = actor_id and mutation_receipts.mutation_id = add_manual_shopping_item.mutation_id;
  return saved_id;
end;
$$;

revoke all on function public.plan_product(uuid, uuid, date, text, numeric, uuid) from public;
grant execute on function public.plan_product(uuid, uuid, date, text, numeric, uuid) to authenticated;
revoke all on function public.add_manual_shopping_item(uuid, date, text, numeric, text, uuid) from public;
grant execute on function public.add_manual_shopping_item(uuid, date, text, numeric, text, uuid) to authenticated;

commit;
