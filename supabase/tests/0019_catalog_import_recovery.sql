begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

select has_function('public', 'product_catalog_import_capacity', array[]::text[], 'catalog capacity RPC exists');
select has_function(
  'public',
  'checkpoint_product_catalog_ingestion',
  array['uuid', 'bigint', 'bigint', 'bigint', 'bigint', 'text'],
  'catalog ingestion checkpoint RPC exists'
);
select has_function(
  'public',
  'retire_stale_product_catalog_import',
  array['uuid', 'bigint', 'bigint', 'bigint', 'bigint', 'bigint'],
  'stale catalog retirement RPC exists'
);
select has_function(
  'public',
  'purge_failed_product_catalog_import',
  array['uuid', 'bigint', 'bigint', 'bigint', 'bigint'],
  'exact failed catalog purge RPC exists'
);
select ok(
  not has_function_privilege('anon', 'public.product_catalog_import_capacity()'::regprocedure, 'execute')
  and not has_function_privilege('authenticated', 'public.product_catalog_import_capacity()'::regprocedure, 'execute')
  and not has_function_privilege('authenticated', 'public.retire_stale_product_catalog_import(uuid,bigint,bigint,bigint,bigint,bigint)'::regprocedure, 'execute')
  and not has_function_privilege('authenticated', 'public.purge_failed_product_catalog_import(uuid,bigint,bigint,bigint,bigint)'::regprocedure, 'execute'),
  'catalog recovery operations are unavailable to clients'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select ok(
  (select database_size_bytes > 0
      and soft_limit_bytes = 5905580032
      and hard_limit_bytes = 6442450944
      and soft_limit_bytes < hard_limit_bytes
   from public.product_catalog_import_capacity()),
  'capacity RPC exposes the fixed 5.5 GiB soft and 6 GiB hard boundaries'
);

reset role;
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '91919191-9191-4191-8191-919191919191',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'catalog-recovery@example.test', '',
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

insert into public.product_catalog_import_runs (
  source_provider, source_dataset_url, source_schema_version, source_retrieved_at,
  database_license, image_license, attempted_row_count, candidate_row_count,
  last_progress_at
) values (
  'open-food-facts',
  'https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz',
  'off-jsonl-v3.6-compatible',
  now() - interval '2 hours',
  'ODbL-1.0; DbCL-1.0',
  'CC-BY-SA-4.0',
  1000,
  1,
  now() - interval '1 hour'
) returning id as stale_run_id, generation as stale_generation \gset

with generated_products as (
  select lpad(series::text, 7, '0') as prefix
  from generate_series(1, 5001) as series
), valid_gtins as (
  select prefix || mod(10 - mod((
    select sum(
      substring(prefix from position for 1)::integer
      * case when position % 2 = 1 then 3 else 1 end
    )
    from generate_series(1, 7) as position
  ), 10), 10)::text as gtin
  from generated_products
)
insert into public.product_catalog_products (
  import_run_id, gtin, name_de, structured_ingredients, allergens, traces, additives,
  categories, labels, countries, packaging, stores, origins, nutrition_per_100g,
  confidence, source_provider, source_url, source_schema_version, source_retrieved_at,
  normalized_content_sha256, field_provenance, database_license, image_license
) select
  :'stale_run_id'::uuid, gtin, 'Stale fixture ' || gtin, '[]'::jsonb, '[]'::jsonb,
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '["en:germany"]'::jsonb,
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{"energy_kcal_100g":100}'::jsonb,
  0.9, 'open-food-facts', 'https://world.openfoodfacts.org/product/' || gtin,
  'off-jsonl-v3.6-compatible', now(), repeat('a', 64), '{"source":"fixture"}'::jsonb,
  'ODbL-1.0; DbCL-1.0', 'not-applicable'
from valid_gtins;

insert into public.product_catalog_import_chunks (
  import_run_id, chunk_index, first_gtin, last_gtin, product_count,
  normalized_content_sha256, nutrition_evidence_count, ingredients_evidence_count,
  allergen_evidence_count, provenance_evidence_count
) select
  :'stale_run_id'::uuid, 1, min(gtin), max(gtin), count(*), repeat('b', 64), 5001, 0, 0, 5001
from public.product_catalog_products
where import_run_id = :'stale_run_id'::uuid;

update public.product_catalog_import_runs
set seal_cursor_gtin = (
      select max(gtin) from public.product_catalog_products where import_run_id = :'stale_run_id'::uuid
    ),
    sealed_product_count = 5001,
    sealed_chunk_count = 1
where id = :'stale_run_id'::uuid;

select throws_ok(
  format(
    'select public.retire_stale_product_catalog_import(%L::uuid, %s, 1000, 5000, 1, 5001)',
    :'stale_run_id', :'stale_generation'
  ),
  '22023',
  'Catalog import run is not an exact stale cleanup candidate',
  'retirement fails closed when the expected product count differs'
);
select results_eq(
  format(
    'select public.retire_stale_product_catalog_import(%L::uuid, %s, 1000, 5001, 1, 5001)',
    :'stale_run_id', :'stale_generation'
  ),
  format('values (%s::bigint)', :'stale_generation'),
  'an exact stale generation can be retired'
);
select results_eq(
  format('select status::text from public.product_catalog_import_runs where id = %L::uuid', :'stale_run_id'),
  $$ values ('failed'::text) $$,
  'retirement records a failed state before deletion'
);
select results_eq(
  format('select failure_code from public.product_catalog_import_runs where id = %L::uuid', :'stale_run_id'),
  $$ values ('catalog-import-stale-retired'::text) $$,
  'retirement records the controlled failure code'
);
select throws_ok(
  format('delete from public.product_catalog_products where import_run_id = %L::uuid', :'stale_run_id'),
  '22023',
  'Catalog import run is sealed',
  'service role cannot bypass the sealed-product guard directly'
);
select throws_ok(
  format(
    'select * from public.purge_failed_product_catalog_import(%L::uuid, %s, 5001, 2, 5001)',
    :'stale_run_id', :'stale_generation'
  ),
  '22023',
  'Catalog import run is not an exact failed cleanup candidate',
  'purge fails closed when the expected chunk count differs'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"91919191-9191-4191-8191-919191919191","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select throws_ok(
  format(
    'select public.retire_stale_product_catalog_import(%L::uuid, %s, 1000, 5001, 1, 5001)',
    :'stale_run_id', :'stale_generation'
  ),
  '42501',
  'permission denied for function retire_stale_product_catalog_import',
  'authenticated users cannot retire catalog generations'
);
select throws_ok(
  format(
    'select * from public.purge_failed_product_catalog_import(%L::uuid, %s, 5001, 1, 5001)',
    :'stale_run_id', :'stale_generation'
  ),
  '42501',
  'permission denied for function purge_failed_product_catalog_import',
  'authenticated users cannot purge catalog generations'
);

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select results_eq(
  format(
    'select deleted_generation, deleted_product_count, deleted_chunk_count, remaining_product_count, remaining_chunk_count, is_complete from public.purge_failed_product_catalog_import(%L::uuid, %s, 5001, 1, 5001)',
    :'stale_run_id', :'stale_generation'
  ),
  format('values (%s::bigint, 5000::bigint, 1::bigint, 1::bigint, 0::bigint, false)', :'stale_generation'),
  'the bounded purge removes no more than 5,000 products and reports remaining work'
);
select results_eq(
  format(
    'select deleted_generation, deleted_product_count, deleted_chunk_count, remaining_product_count, remaining_chunk_count, is_complete from public.purge_failed_product_catalog_import(%L::uuid, %s, 5001, 1, 5001)',
    :'stale_run_id', :'stale_generation'
  ),
  format('values (%s::bigint, 1::bigint, 0::bigint, 0::bigint, 0::bigint, true)', :'stale_generation'),
  'the same exact purge resumes and removes the run only after all rows are gone'
);
select results_eq(
  format('select count(*)::bigint from public.product_catalog_import_runs where id = %L::uuid', :'stale_run_id'),
  $$ values (0::bigint) $$,
  'the exact retired run is gone'
);
select results_eq(
  format('select count(*)::bigint from public.product_catalog_products where import_run_id = %L::uuid', :'stale_run_id'),
  $$ values (0::bigint) $$,
  'only products from the exact retired run are gone'
);
select results_eq(
  format('select count(*)::bigint from public.product_catalog_import_chunks where import_run_id = %L::uuid', :'stale_run_id'),
  $$ values (0::bigint) $$,
  'only manifests from the exact retired run are gone'
);

reset role;
select results_eq(
  $$ select count(*)::bigint from auth.users where id = '91919191-9191-4191-8191-919191919191'::uuid $$,
  $$ values (1::bigint) $$,
  'catalog cleanup does not alter user data'
);
select results_eq(
  $$ select count(*)::bigint from public.product_catalog_import_runs where status = 'active' $$,
  $$ values (0::bigint) $$,
  'catalog cleanup does not invent an active generation'
);

select * from finish();
rollback;
