begin;

-- The shared Open Food Facts catalog deliberately has no household reference. It is
-- staged per import generation so a failed import cannot replace the last known-good
-- catalog. Raw provider records never enter these tables: the importer owns a fixed
-- allowlist and writes only its normalized projection.
create function public.is_valid_catalog_gtin(candidate text)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  candidate_length integer := char_length(candidate);
  checksum_total integer := 0;
  digit integer;
begin
  if candidate !~ '^[0-9]{8,14}$' then
    return false;
  end if;

  for position_from_right in 1..candidate_length - 1 loop
    digit := substring(candidate from candidate_length - position_from_right for 1)::integer;
    checksum_total := checksum_total + digit * case when position_from_right % 2 = 1 then 3 else 1 end;
  end loop;

  return (10 - checksum_total % 10) % 10 = right(candidate, 1)::integer;
end;
$$;

create type public.product_catalog_import_status as enum (
  'staging',
  'active',
  'failed',
  'superseded'
);

create table public.product_catalog_import_runs (
  id uuid primary key default gen_random_uuid(),
  generation bigint generated always as identity unique,
  source_provider text not null check (source_provider = 'open-food-facts'),
  source_dataset_url text not null check (char_length(source_dataset_url) between 1 and 2048),
  source_schema_version text not null check (char_length(source_schema_version) between 1 and 128),
  source_revision text,
  source_retrieved_at timestamptz not null,
  database_license text not null check (char_length(database_license) between 1 and 128),
  image_license text not null check (char_length(image_license) between 1 and 128),
  country_filter text[] not null default array['de']::text[] check (cardinality(country_filter) > 0),
  status public.product_catalog_import_status not null default 'staging',
  attempted_row_count bigint not null default 0 check (attempted_row_count >= 0),
  accepted_product_count bigint not null default 0 check (accepted_product_count >= 0),
  rejected_row_count bigint not null default 0 check (rejected_row_count >= 0),
  normalized_content_sha256 text check (normalized_content_sha256 ~ '^[0-9a-f]{64}$'),
  failure_code text check (failure_code is null or char_length(failure_code) between 1 and 128),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'staging' and completed_at is null and failed_at is null)
    or (status = 'active' and completed_at is not null and failed_at is null)
    or (status = 'failed' and failed_at is not null)
    or (status = 'superseded' and completed_at is not null)
  )
);

create unique index product_catalog_import_runs_one_active_idx
  on public.product_catalog_import_runs (status)
  where status = 'active';

create table public.product_catalog_products (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.product_catalog_import_runs(id) on delete restrict,
  gtin text not null check (public.is_valid_catalog_gtin(gtin)),
  name_de text,
  name text,
  brand text,
  generic_name text,
  package_quantity text,
  serving_size text,
  image_url text,
  ingredients_text text,
  structured_ingredients jsonb not null default '[]'::jsonb,
  allergens jsonb not null default '[]'::jsonb,
  traces jsonb not null default '[]'::jsonb,
  additives jsonb not null default '[]'::jsonb,
  categories jsonb not null default '[]'::jsonb,
  labels jsonb not null default '[]'::jsonb,
  countries jsonb not null default '[]'::jsonb,
  packaging jsonb not null default '[]'::jsonb,
  stores jsonb not null default '[]'::jsonb,
  origins jsonb not null default '[]'::jsonb,
  nutrition_per_100g jsonb not null default '{}'::jsonb,
  nutri_score text check (nutri_score is null or nutri_score in ('a', 'b', 'c', 'd', 'e')),
  nova_group smallint check (nova_group between 1 and 4),
  environmental_score text,
  completeness numeric(4, 3) check (completeness is null or completeness between 0 and 1),
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  source_provider text not null check (source_provider = 'open-food-facts'),
  source_url text not null check (char_length(source_url) between 1 and 2048),
  source_language text,
  source_schema_version text not null check (char_length(source_schema_version) between 1 and 128),
  source_revision text,
  source_updated_at timestamptz,
  source_retrieved_at timestamptz not null,
  normalized_content_sha256 text not null check (normalized_content_sha256 ~ '^[0-9a-f]{64}$'),
  field_provenance jsonb not null default '{}'::jsonb,
  database_license text not null check (char_length(database_license) between 1 and 128),
  image_license text not null check (char_length(image_license) between 1 and 128),
  created_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector(
      'german'::regconfig,
      coalesce(name_de, '') || ' ' || coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(generic_name, '') || ' ' || gtin
    )
  ) stored,
  check (name_de is not null or name is not null),
  check (
    jsonb_typeof(structured_ingredients) = 'array'
    and jsonb_typeof(allergens) = 'array'
    and jsonb_typeof(traces) = 'array'
    and jsonb_typeof(additives) = 'array'
    and jsonb_typeof(categories) = 'array'
    and jsonb_typeof(labels) = 'array'
    and jsonb_typeof(countries) = 'array'
    and jsonb_typeof(packaging) = 'array'
    and jsonb_typeof(stores) = 'array'
    and jsonb_typeof(origins) = 'array'
    and jsonb_typeof(nutrition_per_100g) = 'object'
    and jsonb_typeof(field_provenance) = 'object'
  ),
  unique (import_run_id, gtin)
);

create index product_catalog_products_active_lookup_idx
  on public.product_catalog_products (import_run_id, gtin);
create index product_catalog_products_search_document_idx
  on public.product_catalog_products using gin (search_document);

alter table public.product_catalog_import_runs enable row level security;
alter table public.product_catalog_products enable row level security;

-- No client policy is intentional. Authenticated users can only consume the small,
-- AAL2-protected read projections below. The importer uses the server-only service key.
revoke all on table public.product_catalog_import_runs from public, anon, authenticated;
revoke all on table public.product_catalog_products from public, anon, authenticated;
grant select, insert, update, delete on table public.product_catalog_import_runs to service_role;
grant select, insert, update, delete on table public.product_catalog_products to service_role;

create function public.activate_product_catalog_import(target_import_run_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_run public.product_catalog_import_runs%rowtype;
  persisted_product_count bigint;
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

  select count(*) into persisted_product_count
  from public.product_catalog_products
  where import_run_id = target_run.id;

  if persisted_product_count < 25000
    or target_run.accepted_product_count <> persisted_product_count
    or target_run.attempted_row_count <> target_run.accepted_product_count + target_run.rejected_row_count then
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

create function public.search_global_catalog_products(search_text text, result_limit integer default 8)
returns table (
  barcode text,
  name text,
  brand text,
  image_url text,
  quantity text,
  nutri_score text,
  confidence numeric,
  source_url text,
  source_updated_at timestamptz,
  source_retrieved_at timestamptz,
  database_license text,
  image_license text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if search_text is null or char_length(btrim(search_text)) < 2 or char_length(search_text) > 80 then
    raise exception using errcode = '22023', message = 'Search text must contain 2 to 80 characters';
  end if;

  return query
  select
    product.gtin,
    coalesce(product.name_de, product.name),
    product.brand,
    product.image_url,
    product.package_quantity,
    product.nutri_score,
    product.confidence,
    product.source_url,
    product.source_updated_at,
    product.source_retrieved_at,
    product.database_license,
    product.image_license
  from public.product_catalog_products product
  join public.product_catalog_import_runs import_run on import_run.id = product.import_run_id
  where import_run.status = 'active'
    and product.search_document @@ websearch_to_tsquery('german'::regconfig, btrim(search_text))
  order by
    ts_rank_cd(product.search_document, websearch_to_tsquery('german'::regconfig, btrim(search_text))) desc,
    product.completeness desc,
    product.name_de nulls last,
    product.name
  limit least(greatest(coalesce(result_limit, 8), 1), 20);
end;
$$;

create function public.lookup_global_catalog_product(target_gtin text)
returns table (
  barcode text,
  name text,
  brand text,
  image_url text,
  quantity text,
  nutri_score text,
  nova_group smallint,
  serving_size text,
  categories jsonb,
  countries jsonb,
  labels jsonb,
  ingredients_text text,
  structured_ingredients jsonb,
  allergens jsonb,
  traces jsonb,
  additives jsonb,
  nutrition_per_100g jsonb,
  confidence numeric,
  source_url text,
  source_language text,
  source_updated_at timestamptz,
  source_retrieved_at timestamptz,
  database_license text,
  image_license text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_gtin text := btrim(target_gtin);
begin
  if auth.uid() is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if normalized_gtin is null or not public.is_valid_catalog_gtin(normalized_gtin) then
    raise exception using errcode = '22023', message = 'GTIN must contain 8 to 14 digits';
  end if;

  return query
  select
    product.gtin,
    coalesce(product.name_de, product.name),
    product.brand,
    product.image_url,
    product.package_quantity,
    product.nutri_score,
    product.nova_group,
    product.serving_size,
    product.categories,
    product.countries,
    product.labels,
    product.ingredients_text,
    product.structured_ingredients,
    product.allergens,
    product.traces,
    product.additives,
    product.nutrition_per_100g,
    product.confidence,
    product.source_url,
    product.source_language,
    product.source_updated_at,
    product.source_retrieved_at,
    product.database_license,
    product.image_license
  from public.product_catalog_products product
  join public.product_catalog_import_runs import_run on import_run.id = product.import_run_id
  where import_run.status = 'active'
    and product.gtin = normalized_gtin;
end;
$$;

revoke all on function public.activate_product_catalog_import(uuid) from public, anon, authenticated;
revoke all on function public.search_global_catalog_products(text, integer) from public, anon;
revoke all on function public.lookup_global_catalog_product(text) from public, anon;
grant execute on function public.activate_product_catalog_import(uuid) to service_role;
grant execute on function public.search_global_catalog_products(text, integer) to authenticated;
grant execute on function public.lookup_global_catalog_product(text) to authenticated;

commit;
