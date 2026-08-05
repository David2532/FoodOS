begin;

-- A purge already validates and freezes the original product/chunk totals before
-- it starts. Persist committed deletions so subsequent bounded calls do not scan
-- the entire failed generation twice merely to rediscover their progress.
alter table public.product_catalog_import_runs
  add column if not exists purge_deleted_product_count bigint not null default 0,
  add column if not exists purge_deleted_chunk_count bigint not null default 0;

alter table public.product_catalog_import_runs
  add constraint product_catalog_import_runs_purge_deleted_product_count_check
    check (
      purge_deleted_product_count >= 0
      and (
        (purge_expected_product_count is null and purge_deleted_product_count = 0)
        or purge_deleted_product_count <= purge_expected_product_count
      )
    ),
  add constraint product_catalog_import_runs_purge_deleted_chunk_count_check
    check (
      purge_deleted_chunk_count >= 0
      and (
        (purge_expected_chunk_count is null and purge_deleted_chunk_count = 0)
        or purge_deleted_chunk_count <= purge_expected_chunk_count
      )
    );

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
  removed_product_count bigint := 0;
  removed_chunk_count bigint := 0;
  deleted_products_before bigint;
  deleted_chunks_before bigint;
  deleted_products_after bigint;
  deleted_chunks_after bigint;
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
    select count(*) into product_count
    from public.product_catalog_products
    where import_run_id = target_run.id;
    select count(*) into chunk_count
    from public.product_catalog_import_chunks
    where import_run_id = target_run.id;

    if product_count is distinct from expected_product_count
      or chunk_count is distinct from expected_chunk_count
      or target_run.purge_started_at is not null
      or target_run.purge_deleted_product_count <> 0
      or target_run.purge_deleted_chunk_count <> 0 then
      raise exception using errcode = '22023', message = 'Catalog import run is not an exact failed cleanup candidate';
    end if;

    update public.product_catalog_import_runs
    set failure_code = 'catalog-import-purge-in-progress',
        purge_expected_product_count = expected_product_count,
        purge_expected_chunk_count = expected_chunk_count,
        purge_expected_sealed_product_count = expected_sealed_product_count,
        purge_deleted_product_count = 0,
        purge_deleted_chunk_count = 0,
        purge_started_at = now(),
        last_progress_at = now()
    where id = target_run.id;

    deleted_products_before := 0;
    deleted_chunks_before := 0;
  elsif target_run.failure_code = 'catalog-import-purge-in-progress' then
    if target_run.purge_expected_product_count is distinct from expected_product_count
      or target_run.purge_expected_chunk_count is distinct from expected_chunk_count
      or target_run.purge_expected_sealed_product_count is distinct from expected_sealed_product_count
      or target_run.purge_deleted_product_count > expected_product_count
      or target_run.purge_deleted_chunk_count > expected_chunk_count
      or target_run.purge_started_at is null then
      raise exception using errcode = '22023', message = 'Catalog import run is not an exact failed cleanup candidate';
    end if;

    deleted_products_before := target_run.purge_deleted_product_count;
    deleted_chunks_before := target_run.purge_deleted_chunk_count;
  else
    raise exception using errcode = '22023', message = 'Catalog import run is not an exact failed cleanup candidate';
  end if;

  perform set_config('foodos.catalog_purge_run_id', target_run.id::text, true);

  if deleted_chunks_before < expected_chunk_count then
    delete from public.product_catalog_import_chunks
    where import_run_id = target_run.id;
    get diagnostics removed_chunk_count = row_count;
  end if;

  if deleted_products_before < expected_product_count then
    delete from public.product_catalog_products product
    where product.id in (
      select candidate.id
      from public.product_catalog_products candidate
      where candidate.import_run_id = target_run.id
      order by candidate.id
      limit fixed_delete_batch_size
    );
    get diagnostics removed_product_count = row_count;
  end if;

  if removed_product_count > expected_product_count - deleted_products_before
    or removed_chunk_count > expected_chunk_count - deleted_chunks_before
    or (deleted_products_before < expected_product_count and removed_product_count = 0)
    or (deleted_chunks_before < expected_chunk_count and removed_chunk_count = 0) then
    raise exception using errcode = '22023', message = 'Catalog purge progress drift detected';
  end if;

  deleted_products_after := deleted_products_before + removed_product_count;
  deleted_chunks_after := deleted_chunks_before + removed_chunk_count;
  remaining_products := expected_product_count - deleted_products_after;
  remaining_chunks := expected_chunk_count - deleted_chunks_after;

  update public.product_catalog_import_runs
  set purge_deleted_product_count = deleted_products_after,
      purge_deleted_chunk_count = deleted_chunks_after,
      last_progress_at = now()
  where id = target_run.id;

  if remaining_products = 0 and remaining_chunks = 0 then
    if exists (
      select 1 from public.product_catalog_products where import_run_id = target_run.id
    ) or exists (
      select 1 from public.product_catalog_import_chunks where import_run_id = target_run.id
    ) then
      raise exception using errcode = '22023', message = 'Catalog purge progress drift detected';
    end if;

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

revoke all on function public.purge_failed_product_catalog_import(uuid, bigint, bigint, bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.purge_failed_product_catalog_import(uuid, bigint, bigint, bigint, bigint)
  to service_role;

commit;
