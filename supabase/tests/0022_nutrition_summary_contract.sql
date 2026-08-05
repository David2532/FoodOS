begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

select has_function(
  'public',
  'get_my_nutrition_summary',
  array['date'],
  'the AAL2 nutrition summary RPC exists'
);
select ok(
  has_function_privilege('authenticated', 'public.get_my_nutrition_summary(date)', 'execute'),
  'authenticated sessions can execute the nutrition summary RPC'
);
select ok(
  not has_function_privilege('anon', 'public.get_my_nutrition_summary(date)', 'execute'),
  'anonymous sessions cannot execute the nutrition summary RPC'
);
select ok(
  not has_table_privilege('authenticated', 'public.product_nutrition', 'insert'),
  'authenticated clients cannot insert product nutrition directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.product_nutrition', 'update'),
  'authenticated clients cannot update product nutrition directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.product_nutrition', 'delete'),
  'authenticated clients cannot delete product nutrition directly'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    'a1000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'nutrition-owner@example.test', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'nutrition-outsider@example.test', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'nutrition-removed@example.test', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.profiles (user_id, display_name, timezone)
values
  ('a1000000-0000-4000-8000-000000000001', 'Owner', 'Europe/Berlin'),
  ('a1000000-0000-4000-8000-000000000002', 'Outsider', 'Europe/Berlin'),
  ('a1000000-0000-4000-8000-000000000003', 'Removed', 'Europe/Berlin');

insert into public.households (id, name, created_by)
values (
  'a2000000-0000-4000-8000-000000000001',
  'Nutrition Test Household',
  'a1000000-0000-4000-8000-000000000001'
);
insert into public.household_members (household_id, user_id, role)
values (
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'owner'
);

insert into public.products (id, household_id, gtin, name, source, data_confidence)
values (
  'a3000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  '4006381333931',
  'Nutrition Contract Fixture',
  'manual',
  1
);

insert into public.inventory_batches (
  id, household_id, product_id, initial_amount, remaining_amount, unit, location
) values (
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  1000, 1000, 'g', 'pantry'
);

insert into public.food_log_entries (
  household_id, user_id, product_id, batch_id, amount, unit,
  nutrition_snapshot, eaten_at, client_mutation_id
) values
  (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000001',
    100, 'g',
    '{"kcal":300,"protein_g":30,"carbohydrates_g":20,"fat_g":5}'::jsonb,
    (current_date::timestamp + time '12:00') at time zone 'Europe/Berlin',
    'a5000000-0000-4000-8000-000000000001'
  ),
  (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000001',
    100, 'g',
    '{"kcal":450,"protein_g":40,"carbohydrates_g":10}'::jsonb,
    (current_date::timestamp + time '13:00') at time zone 'Europe/Berlin',
    'a5000000-0000-4000-8000-000000000002'
  ),
  (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000003',
    'a3000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000001',
    100, 'g',
    '{"kcal":999,"protein_g":99,"carbohydrates_g":99,"fat_g":99}'::jsonb,
    (current_date::timestamp + time '14:00') at time zone 'Europe/Berlin',
    'a5000000-0000-4000-8000-000000000003'
  );

select (current_date - (extract(isodow from current_date)::integer - 1))::text as week_start \gset

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select throws_ok(
  format('select * from public.get_my_nutrition_summary(%L::date)', :'week_start'),
  '42501',
  'AAL2 required',
  'AAL1 cannot read personal nutrition summaries'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  format('select * from public.get_my_nutrition_summary((%L::date + 1))', :'week_start'),
  '22023',
  'Invalid week start',
  'the summary RPC rejects non-Monday boundaries'
);
select results_eq(
  format('select count(*)::bigint from public.get_my_nutrition_summary(%L::date)', :'week_start'),
  $$ values (7::bigint) $$,
  'the summary always returns exactly seven ordered day buckets'
);
select results_eq(
  format(
    'select entry_count, kcal, kcal_known_count, protein_g, protein_known_count, carbohydrates_g, carbohydrates_known_count, fat_g, fat_known_count from public.get_my_nutrition_summary(%L::date) where summary_date = current_date',
    :'week_start'
  ),
  $$ values (2::bigint, 750::numeric, 2::bigint, 70::numeric, 2::bigint, 30::numeric, 2::bigint, 5::numeric, 1::bigint) $$,
  'known daily values are exact and partial fat coverage remains explicit'
);
select results_eq(
  format(
    'select count(*)::bigint from public.get_my_nutrition_summary(%L::date) where entry_count = 0 and kcal is null and fat_g is null',
    :'week_start'
  ),
  $$ values (6::bigint) $$,
  'empty days stay unknown rather than becoming synthetic zeroes'
);
select results_eq(
  $$ select count(*)::bigint from public.food_log_entries $$,
  $$ values (2::bigint) $$,
  'an active member sees only their own personal food log rows'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select results_eq(
  format('select coalesce(sum(entry_count), 0)::numeric from public.get_my_nutrition_summary(%L::date)', :'week_start'),
  $$ values (0::numeric) $$,
  'an unrelated AAL2 user cannot enumerate another user nutrition history'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select results_eq(
  $$ select count(*)::bigint from public.food_log_entries $$,
  $$ values (0::bigint) $$,
  'a removed member cannot read even their former household food log rows'
);
select results_eq(
  format('select coalesce(sum(entry_count), 0)::numeric from public.get_my_nutrition_summary(%L::date)', :'week_start'),
  $$ values (0::numeric) $$,
  'a removed member receives no nutrition totals from the former household'
);

reset role;
update public.profiles
set timezone = 'Not/A-Timezone'
where user_id = 'a1000000-0000-4000-8000-000000000001';
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  format('select * from public.get_my_nutrition_summary(%L::date)', :'week_start'),
  '22023',
  'Unsupported profile timezone',
  'an invalid profile timezone fails closed instead of mis-bucketing private data'
);

reset role;
select * from finish();
rollback;
