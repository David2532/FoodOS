begin;

-- A complete Open Food Facts generation can contain millions of products. The
-- former sealing RPC updated and re-hashed every row in one transaction, which
-- can exceed PostgREST's statement timeout. A fixed-size, GTIN-ordered manifest
-- keeps each transaction bounded while retaining a reproducible integrity root.
alter table public.product_catalog_import_runs
  add column if not exists seal_cursor_gtin text,
  add column if not exists sealed_product_count bigint not null default 0 check (sealed_product_count >= 0),
  add column if not exists sealed_chunk_count integer not null default 0 check (sealed_chunk_count >= 0),
  add column if not exists sealing_completed_at timestamptz;

create table if not exists public.product_catalog_import_chunks (
  import_run_id uuid not null references public.product_catalog_import_runs(id) on delete restrict,
  chunk_index integer not null check (chunk_index > 0),
  first_gtin text not null check (public.is_valid_catalog_gtin(first_gtin)),
  last_gtin text not null check (public.is_valid_catalog_gtin(last_gtin)),
  product_count bigint not null check (product_count > 0),
  normalized_content_sha256 text not null check (normalized_content_sha256 ~ '^[0-9a-f]{64}$'),
  nutrition_evidence_count bigint not null check (nutrition_evidence_count >= 0),
  ingredients_evidence_count bigint not null check (ingredients_evidence_count >= 0),
  allergen_evidence_count bigint not null check (allergen_evidence_count >= 0),
  provenance_evidence_count bigint not null check (provenance_evidence_count >= 0),
  created_at timestamptz not null default now(),
  primary key (import_run_id, chunk_index),
  unique (import_run_id, first_gtin),
  check (first_gtin <= last_gtin)
);

alter table public.product_catalog_import_chunks enable row level security;
revoke all on table public.product_catalog_import_chunks from public, anon, authenticated;
grant select, insert on table public.product_catalog_import_chunks to service_role;

-- Once a sealing run has begun, products may only receive their authoritative
-- database hash. Inserts, deletions and fact changes wait on the importer run
-- lock and then fail, making the chunk manifest immutable in practice.
create or replace function public.guard_product_catalog_seal_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_run public.product_catalog_import_runs%rowtype;
  target_import_run_id uuid := coalesce(new.import_run_id, old.import_run_id);
begin
  select * into target_run
  from public.product_catalog_import_runs
  where id = target_import_run_id
  for key share;

  if not found then
    raise exception using errcode = 'P0002', message = 'Catalog import run not found';
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

  if (to_jsonb(new) - 'normalized_content_sha256') is not distinct from (to_jsonb(old) - 'normalized_content_sha256')
    and new.normalized_content_sha256 = public.product_catalog_row_hash(old) then
    return new;
  end if;

  raise exception using errcode = '22023', message = 'Catalog product is sealed';
end;
$$;

drop trigger if exists guard_product_catalog_seal_state on public.product_catalog_products;
create trigger guard_product_catalog_seal_state
before insert or update or delete on public.product_catalog_products
for each row execute function public.guard_product_catalog_seal_state();

-- The size is deliberately internal and fixed. Therefore identical GTIN-ordered
-- product facts produce the same chunk boundaries and root across generations.
create or replace function public.seal_product_catalog_import_batch(target_import_run_id uuid)
returns table (
  sealed_product_count bigint,
  is_complete boolean
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  target_run public.product_catalog_import_runs%rowtype;
  existing_chunk_count bigint;
  existing_product_count bigint;
  batch_count bigint;
  batch_first_gtin text;
  batch_last_gtin text;
  batch_hash text;
  batch_nutrition_evidence_count bigint;
  batch_ingredients_evidence_count bigint;
  batch_allergen_evidence_count bigint;
  batch_provenance_evidence_count bigint;
  completed boolean;
  fixed_batch_size constant integer := 1000;
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

  select count(*), coalesce(sum(chunk.product_count), 0)
  into existing_chunk_count, existing_product_count
  from public.product_catalog_import_chunks chunk
  where chunk.import_run_id = target_run.id;

  if existing_chunk_count <> target_run.sealed_chunk_count
    or existing_product_count <> target_run.sealed_product_count
    or (target_run.sealed_product_count > 0 and target_run.seal_cursor_gtin is null) then
    raise exception using errcode = '22023', message = 'Catalog import seal state is inconsistent';
  end if;

  with selected_products as (
    select product.id
    from public.product_catalog_products product
    where product.import_run_id = target_run.id
      and (target_run.seal_cursor_gtin is null or product.gtin > target_run.seal_cursor_gtin)
    order by product.gtin
    limit fixed_batch_size
  ), sealed_products as (
    update public.product_catalog_products product
    set normalized_content_sha256 = public.product_catalog_row_hash(product)
    from selected_products selected
    where product.id = selected.id
    returning
      product.gtin,
      product.normalized_content_sha256,
      product.nutrition_per_100g,
      product.ingredients_text,
      product.allergens,
      product.field_provenance
  )
  select
    count(*),
    min(gtin),
    max(gtin),
    encode(
      extensions.digest(
        coalesce(string_agg(normalized_content_sha256, E'\n' order by gtin), ''),
        'sha256'
      ),
      'hex'
    ),
    count(*) filter (where nutrition_per_100g <> '{}'::jsonb),
    count(*) filter (where nullif(btrim(ingredients_text), '') is not null),
    count(*) filter (where jsonb_array_length(allergens) > 0),
    count(*) filter (where field_provenance ? 'source')
  into
    batch_count,
    batch_first_gtin,
    batch_last_gtin,
    batch_hash,
    batch_nutrition_evidence_count,
    batch_ingredients_evidence_count,
    batch_allergen_evidence_count,
    batch_provenance_evidence_count
  from sealed_products;

  if batch_count = 0 then
    update public.product_catalog_import_runs
    set sealing_completed_at = coalesce(sealing_completed_at, now())
    where id = target_run.id;
    return query select 0::bigint, true;
    return;
  end if;

  select not exists (
    select 1
    from public.product_catalog_products product
    where product.import_run_id = target_run.id
      and product.gtin > batch_last_gtin
  ) into completed;

  insert into public.product_catalog_import_chunks (
    import_run_id,
    chunk_index,
    first_gtin,
    last_gtin,
    product_count,
    normalized_content_sha256,
    nutrition_evidence_count,
    ingredients_evidence_count,
    allergen_evidence_count,
    provenance_evidence_count
  ) values (
    target_run.id,
    target_run.sealed_chunk_count + 1,
    batch_first_gtin,
    batch_last_gtin,
    batch_count,
    batch_hash,
    batch_nutrition_evidence_count,
    batch_ingredients_evidence_count,
    batch_allergen_evidence_count,
    batch_provenance_evidence_count
  );

  update public.product_catalog_import_runs
  set
    seal_cursor_gtin = batch_last_gtin,
    sealed_product_count = target_run.sealed_product_count + batch_count,
    sealed_chunk_count = target_run.sealed_chunk_count + 1,
    sealing_completed_at = case when completed then now() else null end
  where id = target_run.id;

  return query select batch_count, completed;
end;
$$;

-- Kept as a compatibility wrapper for an interrupted importer. It intentionally
-- performs at most one bounded batch; new callers use the explicit batch result.
create or replace function public.seal_product_catalog_import(target_import_run_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  batch_result record;
begin
  select * into batch_result
  from public.seal_product_catalog_import_batch(target_import_run_id);
  return batch_result.sealed_product_count;
end;
$$;

-- Inspect only the immutable, small manifest. The product facts were canonicalized
-- in each bounded batch and are guarded from mutation once sealing begins, so this
-- avoids a second multi-million-row hash and string aggregation at activation time.
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
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  target_run public.product_catalog_import_runs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  select * into target_run
  from public.product_catalog_import_runs
  where id = target_import_run_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Catalog import run not found';
  end if;

  return query
  select
    coalesce(sum(chunk.product_count), 0)::bigint,
    0::bigint,
    case
      when target_run.sealing_completed_at is null
        or target_run.sealed_chunk_count <> count(*)
        or target_run.sealed_product_count <> coalesce(sum(chunk.product_count), 0)
        or (count(*) > 0 and (min(chunk.chunk_index) <> 1 or max(chunk.chunk_index) <> target_run.sealed_chunk_count))
        then 1::bigint
      else 0::bigint
    end,
    coalesce(sum(chunk.nutrition_evidence_count), 0)::bigint,
    coalesce(sum(chunk.ingredients_evidence_count), 0)::bigint,
    coalesce(sum(chunk.allergen_evidence_count), 0)::bigint,
    coalesce(sum(chunk.provenance_evidence_count), 0)::bigint,
    encode(
      extensions.digest(
        coalesce(string_agg(chunk.normalized_content_sha256, E'\n' order by chunk.chunk_index), ''),
        'sha256'
      ),
      'hex'
    )
  from public.product_catalog_import_chunks chunk
  where chunk.import_run_id = target_run.id;
end;
$$;

revoke all on function public.guard_product_catalog_seal_state() from public, anon, authenticated;
revoke all on function public.seal_product_catalog_import_batch(uuid) from public, anon, authenticated;
revoke all on function public.seal_product_catalog_import(uuid) from public, anon, authenticated;
revoke all on function public.inspect_product_catalog_import(uuid) from public, anon, authenticated;
grant execute on function public.seal_product_catalog_import_batch(uuid) to service_role;
grant execute on function public.seal_product_catalog_import(uuid) to service_role;
grant execute on function public.inspect_product_catalog_import(uuid) to service_role;

commit;
