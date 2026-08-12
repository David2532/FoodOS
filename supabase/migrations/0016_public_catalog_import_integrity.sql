begin;

-- Keep source exclusions and duplicate source rows observable. They are not failed
-- products: the former are deliberately outside the Germany-first catalog and the
-- latter collapse onto the generation's GTIN uniqueness boundary.
alter table public.product_catalog_import_runs
  add column if not exists filtered_row_count bigint not null default 0 check (filtered_row_count >= 0),
  add column if not exists duplicate_row_count bigint not null default 0 check (duplicate_row_count >= 0);

-- The database seals the persisted projection after all stream batches have arrived.
-- This makes the product hash an integrity assertion over the actual row, not merely
-- a client-supplied value. Import/runtime identifiers and retrieval time are excluded
-- so identical source facts are hash-stable across generations.
create or replace function public.product_catalog_row_hash(product public.product_catalog_products)
returns text
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select encode(
    extensions.digest(
      (
        to_jsonb(product)
        - array['id', 'import_run_id', 'normalized_content_sha256', 'source_retrieved_at', 'created_at', 'search_document']
      )::text,
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.seal_product_catalog_import(target_import_run_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_run public.product_catalog_import_runs%rowtype;
  sealed_count bigint;
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
  if target_run.status is distinct from 'staging' then
    raise exception using errcode = '22023', message = 'Catalog import run is not staging';
  end if;

  update public.product_catalog_products product
  set normalized_content_sha256 = public.product_catalog_row_hash(product)
  where product.import_run_id = target_import_run_id;
  get diagnostics sealed_count = row_count;
  return sealed_count;
end;
$$;

-- This is the server-side, reproducible view of the staging generation. It never
-- returns product data, only the aggregate evidence needed by the importer and
-- verifier. The content hash is derived from canonical per-product hashes ordered
-- by GTIN, rather than from stream order or an import-time retrieval timestamp.
create or replace function public.inspect_product_catalog_import(target_import_run_id uuid)
returns table (
  persisted_product_count bigint,
  invalid_gtin_count bigint,
  mismatched_product_hash_count bigint,
  nutrition_evidence_count bigint,
  ingredients_evidence_count bigint,
  allergen_evidence_count bigint,
  provenance_evidence_count bigint,
  normalized_content_sha256 text
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select
    count(*)::bigint,
    count(*) filter (where not public.is_valid_catalog_gtin(product.gtin))::bigint,
    count(*) filter (where product.normalized_content_sha256 <> public.product_catalog_row_hash(product))::bigint,
    count(*) filter (where product.nutrition_per_100g <> '{}'::jsonb)::bigint,
    count(*) filter (where nullif(btrim(product.ingredients_text), '') is not null)::bigint,
    count(*) filter (where jsonb_array_length(product.allergens) > 0)::bigint,
    count(*) filter (where product.field_provenance ? 'source')::bigint,
    encode(
      extensions.digest(
        coalesce(string_agg(product.normalized_content_sha256, E'\n' order by product.gtin), ''),
        'sha256'
      ),
      'hex'
    )
  from public.product_catalog_products product
  where product.import_run_id = target_import_run_id;
$$;

create or replace function public.activate_product_catalog_import(target_import_run_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_run public.product_catalog_import_runs%rowtype;
  integrity record;
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
  if target_run.status is distinct from 'staging' then
    raise exception using errcode = '22023', message = 'Catalog import run is not staging';
  end if;
  if target_run.normalized_content_sha256 is null then
    raise exception using errcode = '22023', message = 'Catalog import content hash required';
  end if;

  select * into integrity
  from public.inspect_product_catalog_import(target_import_run_id);

  if integrity.persisted_product_count < 25000
    or target_run.accepted_product_count <> integrity.persisted_product_count
    or target_run.attempted_row_count <> target_run.accepted_product_count
      + target_run.rejected_row_count
      + target_run.filtered_row_count
      + target_run.duplicate_row_count
    or integrity.invalid_gtin_count <> 0
    or integrity.mismatched_product_hash_count <> 0
    or integrity.nutrition_evidence_count < 100
    or integrity.ingredients_evidence_count < 100
    or integrity.allergen_evidence_count < 100
    or integrity.provenance_evidence_count < 100
    or target_run.normalized_content_sha256 <> integrity.normalized_content_sha256 then
    raise exception using errcode = '22023', message = 'Catalog import is incomplete';
  end if;

  update public.product_catalog_import_runs
  set status = 'superseded'
  where status = 'active';

  update public.product_catalog_import_runs
  set status = 'active', completed_at = now(), failure_code = null
  where id = target_run.id;

  return target_run.generation;
end;
$$;

revoke all on function public.inspect_product_catalog_import(uuid) from public, anon, authenticated;
revoke all on function public.activate_product_catalog_import(uuid) from public, anon, authenticated;
revoke all on function public.product_catalog_row_hash(public.product_catalog_products) from public, anon, authenticated;
revoke all on function public.seal_product_catalog_import(uuid) from public, anon, authenticated;
grant execute on function public.inspect_product_catalog_import(uuid) to service_role;
grant execute on function public.activate_product_catalog_import(uuid) to service_role;
grant execute on function public.product_catalog_row_hash(public.product_catalog_products) to service_role;
grant execute on function public.seal_product_catalog_import(uuid) to service_role;

commit;
