begin;

-- Import progress is persisted independently from activation so a terminated
-- multi-gigabyte import can be resumed without creating another generation.
alter table public.product_catalog_import_runs
  add column if not exists candidate_row_count bigint not null default 0 check (candidate_row_count >= 0),
  add column if not exists ingestion_completed_at timestamptz,
  add column if not exists last_interrupted_at timestamptz,
  add column if not exists resume_count integer not null default 0 check (resume_count >= 0),
  add column if not exists purge_expected_product_count bigint check (purge_expected_product_count >= 0),
  add column if not exists purge_expected_chunk_count bigint check (purge_expected_chunk_count >= 0),
  add column if not exists purge_expected_sealed_product_count bigint check (purge_expected_sealed_product_count >= 0),
  add column if not exists purge_started_at timestamptz,
  add column if not exists last_progress_at timestamptz;

update public.product_catalog_import_runs
set last_progress_at = greatest(started_at, created_at)
where last_progress_at is null;

alter table public.product_catalog_import_runs
  alter column last_progress_at set default now(),
  alter column last_progress_at set not null;

-- The importer stops with generous headroom at 5.5 GiB. The database-side
-- statement guard is the hard fail-closed boundary at 6 GiB.
create or replace function public.product_catalog_import_capacity()
returns table (
  database_size_bytes bigint,
  soft_limit_bytes bigint,
  hard_limit_bytes bigint,
  can_write boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  current_size bigint := pg_database_size(current_database());
  soft_limit constant bigint := 5905580032;
  hard_limit constant bigint := 6442450944;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  return query select current_size, soft_limit, hard_limit, current_size < soft_limit;
end;
$$;

create or replace function public.guard_product_catalog_capacity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if pg_database_size(current_database()) >= 6442450944 then
    raise exception using errcode = '53100', message = 'FoodOS catalog hard storage limit reached';
  end if;
  return null;
end;
$$;

drop trigger if exists guard_product_catalog_capacity on public.product_catalog_products;
create trigger guard_product_catalog_capacity
before insert or update on public.product_catalog_products
for each statement execute function public.guard_product_catalog_capacity();

create or replace function public.checkpoint_product_catalog_ingestion(
  target_import_run_id uuid,
  target_attempted_row_count bigint,
  target_rejected_row_count bigint,
  target_filtered_row_count bigint,
  target_candidate_row_count bigint,
  target_source_revision text
)
returns table (persisted_product_count bigint, duplicate_row_count bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_run public.product_catalog_import_runs%rowtype;
  persisted_count bigint;
  duplicate_count bigint;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  select * into target_run
  from public.product_catalog_import_runs
  where id = target_import_run_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Catalog import run not found';
  end if;
  if target_run.status is distinct from 'staging'
    or target_run.seal_cursor_gtin is not null
    or target_run.ingestion_completed_at is not null then
    raise exception using errcode = '22023', message = 'Catalog ingestion cannot be checkpointed';
  end if;
  if least(
      target_attempted_row_count,
      target_rejected_row_count,
      target_filtered_row_count,
      target_candidate_row_count
    ) < 0
    or target_attempted_row_count is distinct from
      target_rejected_row_count + target_filtered_row_count + target_candidate_row_count then
    raise exception using errcode = '22023', message = 'Catalog ingestion counters are inconsistent';
  end if;
  if target_source_revision is null or char_length(target_source_revision) not between 1 and 128 then
    raise exception using errcode = '22023', message = 'Catalog source revision required';
  end if;

  select count(*) into persisted_count
  from public.product_catalog_products
  where import_run_id = target_import_run_id;

  duplicate_count := target_candidate_row_count - persisted_count;
  if duplicate_count < 0 then
    raise exception using errcode = '22023', message = 'Catalog persisted count exceeds candidates';
  end if;

  update public.product_catalog_import_runs
  set attempted_row_count = target_attempted_row_count,
      accepted_product_count = persisted_count,
      rejected_row_count = target_rejected_row_count,
      filtered_row_count = target_filtered_row_count,
      candidate_row_count = target_candidate_row_count,
      duplicate_row_count = duplicate_count,
      source_revision = target_source_revision,
      ingestion_completed_at = now(),
      last_progress_at = now(),
      failure_code = null
  where id = target_import_run_id;

  return query select persisted_count, duplicate_count;
end;
$$;

-- The row guard remains immutable for every normal path. Only the purge RPC can
-- open a transaction-local gate for the exact failed generation it has locked.
create or replace function public.guard_product_catalog_seal_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_run public.product_catalog_import_runs%rowtype;
  target_import_run_id uuid := coalesce(new.import_run_id, old.import_run_id);
  purge_run_id text := current_setting('foodos.catalog_purge_run_id', true);
begin
  select * into target_run
  from public.product_catalog_import_runs
  where id = target_import_run_id
  for key share;

  if not found then
    raise exception using errcode = 'P0002', message = 'Catalog import run not found';
  end if;

  if tg_op = 'DELETE'
    and auth.role() = 'service_role'
    and target_run.status = 'failed'
    and purge_run_id = target_run.id::text then
    return old;
  end if;

  if tg_op = 'INSERT' then
    if target_run.status is distinct from 'staging' or target_run.seal_cursor_gtin is not null then
      raise exception using errcode = '22023', message = 'Catalog import run is sealed';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if target_run.status is distinct from 'staging' or target_run.seal_cursor_gtin is not null then
      raise exception using errcode = '22023', message = 'Catalog import run is sealed';
    end if;
    return old;
  end if;

  if new.import_run_id is distinct from old.import_run_id
    or target_run.status is distinct from 'staging' then
    raise exception using errcode = '22023', message = 'Catalog import run is sealed';
  end if;

  if target_run.seal_cursor_gtin is null then
    return new;
  end if;

  if (to_jsonb(new) - array['normalized_content_sha256', 'search_document'])
      is not distinct from (to_jsonb(old) - array['normalized_content_sha256', 'search_document'])
    and new.normalized_content_sha256 = public.product_catalog_row_hash(old) then
    return new;
  end if;

  raise exception using errcode = '22023', message = 'Catalog product is sealed';
end;
$$;

create or replace function public.retire_stale_product_catalog_import(
  target_import_run_id uuid,
  expected_generation bigint,
  expected_attempted_row_count bigint,
  expected_product_count bigint,
  expected_chunk_count bigint,
  expected_sealed_product_count bigint
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_run public.product_catalog_import_runs%rowtype;
  product_count bigint;
  chunk_count bigint;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  select * into target_run
  from public.product_catalog_import_runs
  where id = target_import_run_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Catalog import run not found';
  end if;

  select count(*) into product_count
  from public.product_catalog_products
  where import_run_id = target_run.id;
  select count(*) into chunk_count
  from public.product_catalog_import_chunks
  where import_run_id = target_run.id;

  if target_run.status is distinct from 'staging'
    or target_run.generation is distinct from expected_generation
    or target_run.attempted_row_count is distinct from expected_attempted_row_count
    or product_count is distinct from expected_product_count
    or chunk_count is distinct from expected_chunk_count
    or target_run.sealed_product_count is distinct from expected_sealed_product_count
    or target_run.source_provider is distinct from 'open-food-facts'
    or target_run.source_dataset_url is distinct from 'https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz'
    or target_run.source_schema_version is distinct from 'off-jsonl-v3.6-compatible'
    or target_run.last_progress_at > now() - interval '30 minutes'
    or exists (
      select 1 from public.product_catalog_import_runs active_run
      where active_run.id = target_run.id and active_run.status = 'active'
    ) then
    raise exception using errcode = '22023', message = 'Catalog import run is not an exact stale cleanup candidate';
  end if;

  update public.product_catalog_import_runs
  set status = 'failed',
      failed_at = now(),
      failure_code = 'catalog-import-stale-retired'
  where id = target_run.id;

  return target_run.generation;
end;
$$;

create or replace function public.purge_failed_product_catalog_import(
  target_import_run_id uuid,
  expected_generation bigint,
  expected_product_count bigint,
  expected_chunk_count bigint,
  expected_sealed_product_count bigint
)
returns table (
  deleted_generation bigint,
  deleted_product_count bigint,
  deleted_chunk_count bigint,
  remaining_product_count bigint,
  remaining_chunk_count bigint,
  is_complete boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_run public.product_catalog_import_runs%rowtype;
  product_count bigint;
  chunk_count bigint;
  removed_product_count bigint;
  removed_chunk_count bigint;
  remaining_products bigint;
  remaining_chunks bigint;
  fixed_delete_batch_size constant integer := 5000;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  select * into target_run
  from public.product_catalog_import_runs
  where id = target_import_run_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Catalog import run not found';
  end if;

  select count(*) into product_count
  from public.product_catalog_products
  where import_run_id = target_run.id;
  select count(*) into chunk_count
  from public.product_catalog_import_chunks
  where import_run_id = target_run.id;

  if target_run.status is distinct from 'failed'
    or target_run.generation is distinct from expected_generation
    or target_run.sealed_product_count is distinct from expected_sealed_product_count
    or target_run.source_provider is distinct from 'open-food-facts'
    or target_run.source_dataset_url is distinct from 'https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz'
    or target_run.source_schema_version is distinct from 'off-jsonl-v3.6-compatible'
    or exists (
      select 1 from public.product_catalog_import_runs active_run
      where active_run.id = target_run.id and active_run.status = 'active'
    ) then
    raise exception using errcode = '22023', message = 'Catalog import run is not an exact failed cleanup candidate';
  end if;

  if target_run.failure_code = 'catalog-import-stale-retired' then
    if product_count is distinct from expected_product_count
      or chunk_count is distinct from expected_chunk_count
      or target_run.purge_started_at is not null then
      raise exception using errcode = '22023', message = 'Catalog import run is not an exact failed cleanup candidate';
    end if;

    update public.product_catalog_import_runs
    set failure_code = 'catalog-import-purge-in-progress',
        purge_expected_product_count = expected_product_count,
        purge_expected_chunk_count = expected_chunk_count,
        purge_expected_sealed_product_count = expected_sealed_product_count,
        purge_started_at = now()
    where id = target_run.id;
  elsif target_run.failure_code = 'catalog-import-purge-in-progress' then
    if target_run.purge_expected_product_count is distinct from expected_product_count
      or target_run.purge_expected_chunk_count is distinct from expected_chunk_count
      or target_run.purge_expected_sealed_product_count is distinct from expected_sealed_product_count
      or product_count > expected_product_count
      or chunk_count > expected_chunk_count
      or target_run.purge_started_at is null then
      raise exception using errcode = '22023', message = 'Catalog import run is not an exact failed cleanup candidate';
    end if;
  else
    raise exception using errcode = '22023', message = 'Catalog import run is not an exact failed cleanup candidate';
  end if;

  perform set_config('foodos.catalog_purge_run_id', target_run.id::text, true);
  delete from public.product_catalog_import_chunks where import_run_id = target_run.id;
  get diagnostics removed_chunk_count = row_count;

  delete from public.product_catalog_products product
  where product.id in (
    select candidate.id
    from public.product_catalog_products candidate
    where candidate.import_run_id = target_run.id
    order by candidate.id
    limit fixed_delete_batch_size
  );
  get diagnostics removed_product_count = row_count;

  select count(*) into remaining_products
  from public.product_catalog_products
  where import_run_id = target_run.id;
  select count(*) into remaining_chunks
  from public.product_catalog_import_chunks
  where import_run_id = target_run.id;

  if remaining_products = 0 and remaining_chunks = 0 then
    delete from public.product_catalog_import_runs where id = target_run.id;
  end if;

  return query select
    target_run.generation,
    removed_product_count,
    removed_chunk_count,
    remaining_products,
    remaining_chunks,
    remaining_products = 0 and remaining_chunks = 0;
end;
$$;

revoke all on function public.product_catalog_import_capacity() from public, anon, authenticated;
revoke all on function public.guard_product_catalog_capacity() from public, anon, authenticated;
revoke all on function public.checkpoint_product_catalog_ingestion(uuid, bigint, bigint, bigint, bigint, text) from public, anon, authenticated;
revoke all on function public.guard_product_catalog_seal_state() from public, anon, authenticated;
revoke all on function public.retire_stale_product_catalog_import(uuid, bigint, bigint, bigint, bigint, bigint) from public, anon, authenticated;
revoke all on function public.purge_failed_product_catalog_import(uuid, bigint, bigint, bigint, bigint) from public, anon, authenticated;

grant execute on function public.product_catalog_import_capacity() to service_role;
grant execute on function public.checkpoint_product_catalog_ingestion(uuid, bigint, bigint, bigint, bigint, text) to service_role;
grant execute on function public.retire_stale_product_catalog_import(uuid, bigint, bigint, bigint, bigint, bigint) to service_role;
grant execute on function public.purge_failed_product_catalog_import(uuid, bigint, bigint, bigint, bigint) to service_role;

commit;
