-- Forward-only migration: discard_inventory_batch
-- A confirmed disposal decrements one physical batch and appends one discard event.
-- Payload-bound receipts make network retries exactly-once without creating a food log.

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
    'generate_shopping_from_plan_v2', 'commit_purchase_capture',
    'discard_inventory_batch'
  ));

create function public.discard_inventory_batch(
  target_batch uuid,
  discarded_amount numeric,
  mutation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_household uuid;
  batch_record public.inventory_batches%rowtype;
  request_payload jsonb;
  request_hash text;
  receipt_inserted boolean := false;
  existing_receipt public.mutation_receipts%rowtype;
  new_remaining numeric;
  mutation_result jsonb;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if target_batch is null or mutation_id is null or discarded_amount is null then
    raise exception using errcode = '22023', message = 'Invalid disposal request';
  end if;
  if discarded_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '22023', message = 'Invalid disposal request';
  end if;
  if discarded_amount <= 0
    or pg_catalog.scale(discarded_amount) > 3
    or discarded_amount > 999999999.999 then
    raise exception using errcode = '22023', message = 'Invalid disposal request';
  end if;

  -- Resolve the tenant without disclosing whether an inaccessible batch exists.
  -- Then follow the canonical lifecycle -> member -> entity lock order so member
  -- removal and a disposal cannot both commit from stale authorization state.
  select batch.household_id
  into target_household
  from public.inventory_batches as batch
  where batch.id = target_batch;
  if not found then
    raise exception using errcode = '42501', message = 'Batch access denied';
  end if;

  perform 1
  from public.household_membership_state as state
  where state.household_id = target_household
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Batch access denied';
  end if;

  perform 1
  from public.household_members as member
  where member.household_id = target_household
    and member.user_id = actor_id
    and member.removed_at is null
  for share;
  if not found then
    raise exception using errcode = '42501', message = 'Batch access denied';
  end if;

  select batch.*
  into batch_record
  from public.inventory_batches as batch
  where batch.id = target_batch
    and batch.household_id = target_household
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Batch access denied';
  end if;

  request_payload := pg_catalog.jsonb_build_object(
    'target_batch', target_batch,
    'discarded_amount', discarded_amount
  );
  request_hash := pg_catalog.encode(
    extensions.digest(request_payload::text, 'sha256'),
    'hex'
  );

  -- A completed exact request is historical truth and must replay even though the
  -- current remaining amount has already changed. Authorization is still rechecked.
  select *
  into existing_receipt
  from public.mutation_receipts
  where user_id = actor_id
    and public.mutation_receipts.mutation_id = discard_inventory_batch.mutation_id
  for update;
  if found then
    if existing_receipt.operation <> 'discard_inventory_batch'
      or existing_receipt.payload_sha256 <> request_hash then
      raise exception using errcode = '23505', message = 'Mutation ID payload conflict';
    end if;
    if existing_receipt.result is null then
      raise exception using errcode = '40001', message = 'Mutation result not available';
    end if;
    return existing_receipt.result
      || pg_catalog.jsonb_build_object('idempotent_replay', true);
  end if;

  if batch_record.unit = 'piece'
    and discarded_amount <> pg_catalog.trunc(discarded_amount) then
    raise exception using errcode = '22023', message = 'Piece disposal amount must be whole';
  end if;
  if discarded_amount > batch_record.remaining_amount then
    raise exception using errcode = '23514', message = 'Insufficient inventory';
  end if;

  insert into public.mutation_receipts (
    user_id, mutation_id, operation, payload_sha256
  ) values (
    actor_id, mutation_id, 'discard_inventory_batch', request_hash
  )
  on conflict do nothing
  returning true into receipt_inserted;

  -- This branch covers the same user reusing one mutation ID concurrently for a
  -- different batch; same-batch calls are already serialized by the row lock.
  if not coalesce(receipt_inserted, false) then
    select *
    into existing_receipt
    from public.mutation_receipts
    where user_id = actor_id
      and public.mutation_receipts.mutation_id = discard_inventory_batch.mutation_id
    for update;
    if existing_receipt.operation <> 'discard_inventory_batch'
      or existing_receipt.payload_sha256 <> request_hash then
      raise exception using errcode = '23505', message = 'Mutation ID payload conflict';
    end if;
    if existing_receipt.result is null then
      raise exception using errcode = '40001', message = 'Mutation result not available';
    end if;
    return existing_receipt.result
      || pg_catalog.jsonb_build_object('idempotent_replay', true);
  end if;

  new_remaining := batch_record.remaining_amount - discarded_amount;

  update public.inventory_batches
  set remaining_amount = new_remaining
  where id = target_batch;

  insert into public.inventory_events (
    household_id, batch_id, user_id, event_type, amount_delta, client_mutation_id
  ) values (
    target_household, target_batch, actor_id, 'discard', -discarded_amount, mutation_id
  );

  mutation_result := pg_catalog.jsonb_build_object(
    'batch_id', target_batch,
    'remaining_amount', new_remaining,
    'idempotent_replay', false
  );

  update public.mutation_receipts
  set result = mutation_result,
      completed_at = pg_catalog.now()
  where user_id = actor_id
    and public.mutation_receipts.mutation_id = discard_inventory_batch.mutation_id;

  return mutation_result;
end;
$$;

alter function public.discard_inventory_batch(uuid, numeric, uuid) owner to postgres;
revoke all on function public.discard_inventory_batch(uuid, numeric, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.discard_inventory_batch(uuid, numeric, uuid)
  to authenticated;

commit;
