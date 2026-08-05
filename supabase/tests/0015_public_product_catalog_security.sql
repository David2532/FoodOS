begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

select has_table('public', 'product_catalog_import_runs', 'catalog import runs are persisted separately');
select has_table('public', 'product_catalog_products', 'global catalog products are persisted separately');
select has_table('public', 'product_catalog_import_chunks', 'bounded catalog seal manifests are persisted separately');
select has_function('public', 'is_valid_catalog_gtin', array['text'], 'catalog GTIN validation exists at the database boundary');
select has_function('public', 'activate_product_catalog_import', array['uuid'], 'catalog activation RPC exists');
select has_function('public', 'seal_product_catalog_import_batch', array['uuid'], 'bounded catalog seal RPC exists');
select has_function('public', 'search_global_catalog_products', array['text', 'integer'], 'global catalog search RPC exists');
select has_function('public', 'lookup_global_catalog_product', array['text'], 'global catalog GTIN lookup RPC exists');
select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('product_catalog_import_runs', 'product_catalog_products', 'product_catalog_import_chunks')
  )
  and (
    select count(*)
    from pg_class
    where oid in (
      'public.product_catalog_import_runs'::regclass,
      'public.product_catalog_products'::regclass,
      'public.product_catalog_import_chunks'::regclass
    )
      and relrowsecurity
  ) = 3,
  'raw catalog tables have RLS enabled and no client policy'
);
select ok(
  not has_table_privilege('anon', 'public.product_catalog_import_runs', 'select')
  and not has_table_privilege('authenticated', 'public.product_catalog_import_runs', 'select')
  and not has_table_privilege('anon', 'public.product_catalog_products', 'select')
  and not has_table_privilege('authenticated', 'public.product_catalog_products', 'select')
  and not has_table_privilege('anon', 'public.product_catalog_import_chunks', 'select')
  and not has_table_privilege('authenticated', 'public.product_catalog_import_chunks', 'select'),
  'anon and authenticated roles cannot read raw catalog tables'
);
select ok(
  has_table_privilege('service_role', 'public.product_catalog_import_runs', 'insert')
  and has_table_privilege('service_role', 'public.product_catalog_products', 'insert')
  and has_table_privilege('service_role', 'public.product_catalog_import_chunks', 'insert'),
  'the server-only service role can import catalog generations'
);
select ok(
  (
    select count(*)
    from pg_proc
    where oid in (
      'public.activate_product_catalog_import(uuid)'::regprocedure,
      'public.search_global_catalog_products(text,integer)'::regprocedure,
      'public.lookup_global_catalog_product(text)'::regprocedure,
      'public.seal_product_catalog_import_batch(uuid)'::regprocedure
    )
      and prosecdef
      and (
        (
          oid = 'public.seal_product_catalog_import_batch(uuid)'::regprocedure
          and coalesce(array_to_string(proconfig, ','), '') like '%search_path=public, extensions, pg_temp%'
        )
        or (
          oid <> 'public.seal_product_catalog_import_batch(uuid)'::regprocedure
          and coalesce(array_to_string(proconfig, ','), '') like '%search_path=public, pg_temp%'
        )
      )
  ) = 4,
  'catalog RPCs use SECURITY DEFINER with a fixed search path'
);
select ok(public.is_valid_catalog_gtin('4006381333931'), 'a valid GTIN passes the database boundary');
select ok(not public.is_valid_catalog_gtin('4006381333932'), 'an invalid GTIN is rejected at the database boundary');

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

insert into public.product_catalog_import_runs (
  source_provider, source_dataset_url, source_schema_version, source_retrieved_at,
  database_license, image_license, attempted_row_count, accepted_product_count,
  rejected_row_count, normalized_content_sha256
) values (
  'open-food-facts', 'https://example.test/off.jsonl.gz', 'fixture-v1', now(),
  'ODbL-1.0; DbCL-1.0', 'not-applicable', 1, 1, 0, repeat('a', 64)
) returning id as incomplete_import_run_id \gset

select throws_ok(
  format('select public.activate_product_catalog_import(%L::uuid)', :'incomplete_import_run_id'),
  '22023',
  'Catalog import is incomplete',
  'an incomplete staging import cannot become active'
);
select results_eq(
  $$ select count(*)::bigint from public.product_catalog_import_runs where status = 'active' $$,
  $$ values (0::bigint) $$,
  'a failed activation leaves no partial catalog active'
);

insert into public.product_catalog_import_runs (
  source_provider, source_dataset_url, source_schema_version, source_retrieved_at,
  database_license, image_license, normalized_content_sha256
) values (
  'open-food-facts', 'https://example.test/off.jsonl.gz', 'fixture-v1', now(),
  'ODbL-1.0; DbCL-1.0', 'not-applicable', repeat('b', 64)
) returning id as complete_import_run_id \gset

with generated_products as (
  select lpad(series::text, 7, '0') as prefix
  from generate_series(1, 25000) as series
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
  completeness, confidence, source_provider, source_url, source_schema_version,
  source_retrieved_at, normalized_content_sha256, field_provenance, database_license,
  image_license
)
select
  :'complete_import_run_id'::uuid, gtin, 'Globaler Testartikel ' || gtin,
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  '["en:germany"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  '{"energy_kcal_100g":100}'::jsonb, 0.9, 0.9, 'open-food-facts',
  'https://example.test/product/' || gtin, 'fixture-v1', now(), repeat('c', 64),
  '{"source":"fixture"}'::jsonb, 'ODbL-1.0; DbCL-1.0', 'not-applicable'
from valid_gtins;

with representative_products as (
  select id
  from public.product_catalog_products
  where import_run_id = :'complete_import_run_id'::uuid
  order by gtin
  limit 100
)
update public.product_catalog_products
set
  serving_size = '100 g',
  categories = '["en:breakfast-cereals"]'::jsonb,
  countries = '["en:germany"]'::jsonb,
  labels = '["en:organic"]'::jsonb,
  ingredients_text = 'Haferflocken',
  structured_ingredients = '[{"name":"Haferflocken","normalizedName":"en:oats","percentage":100}]'::jsonb,
  allergens = '["en:oats"]'::jsonb,
  traces = '["en:nuts"]'::jsonb,
  additives = '["en:e300"]'::jsonb,
  nutrition_per_100g = '{"energy_kcal_100g":100}'::jsonb,
  nova_group = 2,
  source_language = 'de'
where id in (select id from representative_products);

select is(
  (
    select sum(public.seal_product_catalog_import(:'complete_import_run_id'::uuid))
    from generate_series(1, 25)
  )::bigint,
  25000::bigint,
  'the database seals every persisted catalog product in bounded batches before activation'
);

update public.product_catalog_import_runs
set attempted_row_count = 25000,
    accepted_product_count = 25000,
    rejected_row_count = 0,
    normalized_content_sha256 = (
      select normalized_content_sha256
      from public.inspect_product_catalog_import(:'complete_import_run_id'::uuid)
    )
where id = :'complete_import_run_id'::uuid;

select throws_ok(
  format($$update public.product_catalog_products set normalized_content_sha256 = repeat('e', 64) where import_run_id = %L::uuid and gtin = '00000017'$$, :'complete_import_run_id'),
  '22023',
  'Catalog product is sealed',
  'a staging run cannot tamper with a sealed product hash'
);

select throws_ok(
  format($$delete from public.product_catalog_products where import_run_id = %L::uuid and gtin = '00000017'$$, :'complete_import_run_id'),
  '22023',
  'Catalog import run is sealed',
  'a staging run cannot delete a manifest-bound product'
);

select is(
  public.seal_product_catalog_import(:'complete_import_run_id'::uuid),
  0::bigint,
  'a completed bounded seal performs no further product mutation'
);

update public.product_catalog_import_runs
set normalized_content_sha256 = (
  select normalized_content_sha256
  from public.inspect_product_catalog_import(:'complete_import_run_id'::uuid)
)
where id = :'complete_import_run_id'::uuid;

select ok(
  public.activate_product_catalog_import(:'complete_import_run_id'::uuid) > 0,
  'a complete, hash-bound generation activates atomically'
);
select results_eq(
  $$ select count(*)::bigint from public.product_catalog_import_runs where status = 'active' $$,
  $$ values (1::bigint) $$,
  'exactly one catalog generation is active'
);
select results_eq(
  $$ select count(*)::bigint from public.product_catalog_products $$,
  $$ values (25000::bigint) $$,
  'the activation gate requires the intended minimum product count'
);

reset role;
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '33333333-3333-4333-8333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'catalog-user@example.test', '',
  '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into auth.sessions (id, user_id, created_at, updated_at, aal, not_after)
values
  ('aaaaaaaa-3333-4333-8333-111111111111', '33333333-3333-4333-8333-333333333333', now(), now(), 'aal1', now() + interval '1 day'),
  ('aaaaaaaa-3333-4333-8333-222222222222', '33333333-3333-4333-8333-333333333333', now(), now(), 'aal2', now() + interval '1 day');
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"aaaaaaaa-3333-4333-8333-111111111111"}',
  true
);
set local role authenticated;

select throws_ok(
  $$ select * from public.search_global_catalog_products('Globaler', 8) $$,
  '42501',
  'AAL2 required',
  'AAL1 cannot search the global catalog'
);
select throws_ok(
  $$ select * from public.lookup_global_catalog_product('00000017') $$,
  '42501',
  'AAL2 required',
  'AAL1 cannot look up a global catalog GTIN'
);
select throws_ok(
  $$ select * from public.product_catalog_products $$,
  '42501',
  'permission denied for table product_catalog_products',
  'AAL1 cannot bypass the global projection through the product table'
);
select throws_ok(
  $$ select * from public.product_catalog_import_runs $$,
  '42501',
  'permission denied for table product_catalog_import_runs',
  'AAL1 cannot inspect catalog import metadata directly'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal2","session_id":"aaaaaaaa-3333-4333-8333-222222222222"}',
  true
);
set local role authenticated;

select results_eq(
  $$ select name from public.search_global_catalog_products('Globaler', 1) $$,
  $$ select 'Globaler Testartikel 00000017'::text $$,
  'AAL2 search exposes only the active catalog projection'
);
select ok(
  (select source_retrieved_at is not null from public.search_global_catalog_products('Globaler', 1)),
  'search exposes the real source retrieval timestamp for freshness presentation'
);
select results_eq(
  $$ select (nutrition_per_100g ->> 'energy_kcal_100g')::numeric from public.search_global_catalog_products('Globaler', 1) $$,
  $$ values (100::numeric) $$,
  'AAL2 global search exposes only the bounded per-100 nutrition summary'
);
select results_eq(
  $$ select barcode from public.lookup_global_catalog_product('00000017') $$,
  $$ values ('00000017'::text) $$,
  'AAL2 exact GTIN lookup exposes the active catalog projection'
);
select results_eq(
  $$
    select jsonb_build_object(
      'categories', categories,
      'countries', countries,
      'labels', labels,
      'ingredients_text', ingredients_text,
      'structured_ingredients', structured_ingredients,
      'allergens', allergens,
      'traces', traces,
      'additives', additives,
      'nutrition_per_100g', nutrition_per_100g,
      'serving_size', serving_size,
      'nova_group', nova_group,
      'source_language', source_language,
      'has_source_retrieved_at', source_retrieved_at is not null
    )
    from public.lookup_global_catalog_product('00000017')
  $$,
  $$
    values (
      '{"categories":["en:breakfast-cereals"],"countries":["en:germany"],"labels":["en:organic"],"ingredients_text":"Haferflocken","structured_ingredients":[{"name":"Haferflocken","normalizedName":"en:oats","percentage":100}],"allergens":["en:oats"],"traces":["en:nuts"],"additives":["en:e300"],"nutrition_per_100g":{"energy_kcal_100g":100},"serving_size":"100 g","nova_group":2,"source_language":"de","has_source_retrieved_at":true}'::jsonb
    )
  $$,
  'exact GTIN lookup preserves the allowlisted catalog detail projection'
);
select throws_ok(
  $$ select public.activate_product_catalog_import('00000000-0000-4000-8000-000000000000'::uuid) $$,
  '42501',
  'permission denied for function activate_product_catalog_import',
  'an authenticated AAL2 user cannot activate an import generation'
);
select throws_ok(
  format('select * from public.inspect_product_catalog_import(%L::uuid)', :'complete_import_run_id'),
  '42501',
  'permission denied for function inspect_product_catalog_import',
  'an authenticated AAL2 user cannot inspect raw catalog integrity evidence'
);

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

insert into public.product_catalog_import_runs (
  source_provider, source_dataset_url, source_schema_version, source_retrieved_at,
  database_license, image_license, attempted_row_count, accepted_product_count,
  rejected_row_count, normalized_content_sha256
) values (
  'open-food-facts', 'https://example.test/off.jsonl.gz', 'fixture-v1', now(),
  'ODbL-1.0; DbCL-1.0', 'not-applicable', 1, 1, 0, repeat('d', 64)
) returning id as replacement_incomplete_import_run_id \gset

select throws_ok(
  format('select public.activate_product_catalog_import(%L::uuid)', :'replacement_incomplete_import_run_id'),
  '22023',
  'Catalog import is incomplete',
  'a later partial import cannot replace the active generation'
);
select results_eq(
  $$ select id from public.product_catalog_import_runs where status = 'active' $$,
  format($$ values (%L::uuid) $$, :'complete_import_run_id'),
  'a failed replacement leaves the prior active generation intact'
);

reset role;
select * from finish();
rollback;
