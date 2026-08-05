begin;

create extension if not exists pgtap with schema extensions;

select plan(38);

select has_function('public', 'plan_product_v2', array['uuid', 'uuid', 'date', 'text', 'numeric', 'text', 'uuid'], 'explicit-quantity planning RPC exists');
select has_function('public', 'edit_meal_plan_item', array['uuid', 'date', 'text', 'numeric', 'text', 'bigint', 'uuid'], 'revision-safe plan edit RPC exists');
select has_function('public', 'delete_meal_plan_item', array['uuid', 'bigint', 'uuid'], 'revision-safe plan delete RPC exists');
select has_function('public', 'generate_shopping_from_plan_v2', array['uuid', 'date', 'bigint', 'uuid'], 'revision-safe shopping generation RPC exists');
select ok(has_function_privilege('authenticated', 'public.plan_product_v2(uuid,uuid,date,text,numeric,text,uuid)', 'execute'), 'authenticated sessions can call v2 planning');
select ok(not has_function_privilege('anon', 'public.plan_product_v2(uuid,uuid,date,text,numeric,text,uuid)', 'execute'), 'anonymous sessions cannot call v2 planning');
select ok(not has_function_privilege('authenticated', 'public.plan_product(uuid,uuid,date,text,numeric,uuid)', 'execute'), 'legacy planning cannot bypass the v2 contract');
select ok(not has_function_privilege('authenticated', 'public.generate_shopping_from_plan(uuid,date)', 'execute'), 'legacy generation cannot bypass the v2 contract');
select ok(not has_table_privilege('authenticated', 'public.meal_plan_slots', 'insert'), 'clients cannot write plan rows directly');
select ok(not has_table_privilege('authenticated', 'public.shopping_items', 'update'), 'clients cannot mutate generated shopping rows directly');
select ok(not has_table_privilege('authenticated', 'public.products', 'update'), 'clients cannot rewrite confirmed package quantities directly');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('b1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'plan-owner@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('b1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'plan-member@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('b1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'plan-outsider@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into auth.sessions (id, user_id, created_at, updated_at, aal, not_after)
values
  ('b1100000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', now(), now(), 'aal1', now() + interval '1 day'),
  ('b1100000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', now(), now(), 'aal2', now() + interval '1 day'),
  ('b1100000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000002', now(), now(), 'aal2', now() + interval '1 day'),
  ('b1100000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000003', now(), now(), 'aal2', now() + interval '1 day');

insert into public.households (id, name, created_by)
values ('b2000000-0000-4000-8000-000000000001', 'Planning Test Household', 'b1000000-0000-4000-8000-000000000001');
insert into public.household_members (household_id, user_id, role)
values
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'owner'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'member');

select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"b1100000-0000-4000-8000-000000000001"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.plan_product_v2('b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', date '2026-08-03', 'dinner', 1, 'g', 'b5000000-0000-4000-8000-000000000001') $$,
  '42501', 'AAL2 required', 'AAL1 cannot plan household food'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"b1100000-0000-4000-8000-000000000002"}', true);
set local role authenticated;
select public.add_inventory_batch(
  'b2000000-0000-4000-8000-000000000001',
  '{"barcode":"4012345678901","name":"Haushalts-Hafer","source":"manual","confidence":1,"retrievedAt":"2026-08-05T12:00:00Z"}',
  '{"amount":300,"unit":"g","location":"pantry"}',
  'b5000000-0000-4000-8000-000000000002'
) as first_intake \gset
select results_eq(
  format('select package_amount, package_unit from public.products where id = %L::uuid', :'first_intake'::jsonb ->> 'product_id'),
  $$ values (300::numeric, 'g'::text) $$,
  'the first confirmed physical intake persists package quantity and unit'
);
select public.add_inventory_batch(
  'b2000000-0000-4000-8000-000000000001',
  '{"barcode":"4012345678901","name":"Haushalts-Hafer","source":"manual","confidence":1,"retrievedAt":"2026-08-05T12:00:00Z"}',
  '{"amount":50,"unit":"g","location":"pantry"}',
  'b5000000-0000-4000-8000-000000000003'
) as second_intake \gset
select results_eq(
  format('select package_amount, package_unit from public.products where id = %L::uuid', :'first_intake'::jsonb ->> 'product_id'),
  $$ values (300::numeric, 'g'::text) $$,
  'a later partial intake does not redefine physical packaging'
);

select public.plan_product_v2(
  'b2000000-0000-4000-8000-000000000001', (:'first_intake'::jsonb ->> 'product_id')::uuid,
  date '2026-08-03', 'breakfast', 600, 'g', 'b5000000-0000-4000-8000-000000000004'
) as owner_plan \gset
select is(
  (public.plan_product_v2(
    'b2000000-0000-4000-8000-000000000001', (:'first_intake'::jsonb ->> 'product_id')::uuid,
    date '2026-08-03', 'breakfast', 600, 'g', 'b5000000-0000-4000-8000-000000000004'
  ) ->> 'idempotent_replay')::boolean,
  true,
  'an identical planning replay is idempotent'
);
select throws_ok(
  format(
    'select public.plan_product_v2(%L::uuid, %L::uuid, date ''2026-08-03'', ''breakfast'', 601, ''g'', %L::uuid)',
    'b2000000-0000-4000-8000-000000000001', :'first_intake'::jsonb ->> 'product_id', 'b5000000-0000-4000-8000-000000000004'
  ),
  '23505', 'Mutation ID payload conflict', 'planning rejects mutation-ID reuse with a different payload'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"b1100000-0000-4000-8000-000000000003"}', true);
set local role authenticated;
select public.plan_product_v2(
  'b2000000-0000-4000-8000-000000000001', (:'first_intake'::jsonb ->> 'product_id')::uuid,
  date '2026-08-04', 'breakfast', 400, 'g', 'b5000000-0000-4000-8000-000000000005'
) as member_plan \gset
select results_eq(
  format(
    'select count(*)::bigint from public.meal_plan_slots where household_id = %L::uuid and product_id = %L::uuid',
    'b2000000-0000-4000-8000-000000000001', :'first_intake'::jsonb ->> 'product_id'
  ),
  $$ values (2::bigint) $$,
  'the shared plan contains requirements from every household member'
);

reset role;
-- The second physical package is consumed before weekly generation; it exists
-- only to prove that a later intake cannot rewrite package metadata.
update public.inventory_batches
set remaining_amount = 0
where id = (:'second_intake'::jsonb ->> 'batch_id')::uuid;
insert into public.products (id, household_id, gtin, name, package_amount, package_unit, source, data_confidence)
values
  ('b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', '4012345678902', 'Possible Recall Product', 100, 'g', 'manual', 1),
  ('b3000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001', '4012345678903', 'Exact Recall Product', 100, 'g', 'manual', 1);
insert into public.inventory_batches (id, household_id, product_id, initial_amount, remaining_amount, unit, location, lot_number)
values
  ('b4000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000002', 100, 100, 'g', 'pantry', null),
  ('b4000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000003', 100, 100, 'g', 'pantry', 'EXACT-1');
insert into public.recall_sources (id, source_key, display_name, authority_url, approved, license_reviewed_at, last_success_at)
values ('b6000000-0000-4000-8000-000000000001', 'planning-fixture', 'Planning fixture authority', 'https://example.test/authority', true, now(), now());
insert into public.recall_events (
  id, source_id, source_record_id, payload_sha256, parser_version, status, title,
  product_name, gtins, lot_numbers, source_url, published_at, retrieved_at, raw_payload
) values
  ('b6100000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'possible', repeat('a', 64), 'fixture-v1', 'active', 'Possible recall', 'Possible Recall Product', array['4012345678902'], '{}', 'https://example.test/possible', now(), now(), '{}'::jsonb),
  ('b6100000-0000-4000-8000-000000000002', 'b6000000-0000-4000-8000-000000000001', 'exact', repeat('b', 64), 'fixture-v1', 'active', 'Exact recall', 'Exact Recall Product', array['4012345678903'], array['EXACT-1'], 'https://example.test/exact', now(), now(), '{}'::jsonb);
insert into public.recipes (id, household_id, name, created_by)
values ('b7000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Constraint fixture', 'b1000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"b1100000-0000-4000-8000-000000000002"}', true);
set local role authenticated;
select public.plan_product_v2('b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000002', date '2026-08-05', 'lunch', 100, 'g', 'b5000000-0000-4000-8000-000000000006');
select public.plan_product_v2('b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000003', date '2026-08-06', 'lunch', 100, 'g', 'b5000000-0000-4000-8000-000000000007');
select public.add_manual_shopping_item('b2000000-0000-4000-8000-000000000001', date '2026-08-03', 'Manuell behalten', 2, 'piece', 'b5000000-0000-4000-8000-000000000008') as manual_item \gset
select public.set_shopping_item_checked(:'manual_item'::uuid, true);
select public.generate_shopping_from_plan_v2('b2000000-0000-4000-8000-000000000001', date '2026-08-03', 0, 'b5000000-0000-4000-8000-000000000009') as generation_one \gset

select results_eq(
  format('select required_amount from public.shopping_items where source = ''plan'' and source_product_id = %L::uuid', :'first_intake'::jsonb ->> 'product_id'),
  $$ values (700::numeric) $$,
  'household requirement 1000 minus usable inventory 300 yields 700'
);
select results_eq(
  $$ select required_amount from public.shopping_items where source = 'plan' and source_product_id = 'b3000000-0000-4000-8000-000000000002' $$,
  $$ values (100::numeric) $$,
  'possible-recall inventory is never subtracted'
);
select results_eq(
  $$ select required_amount from public.shopping_items where source = 'plan' and source_product_id = 'b3000000-0000-4000-8000-000000000003' $$,
  $$ values (100::numeric) $$,
  'exact-recall inventory is never subtracted'
);
select ok((select checked_at is not null from public.shopping_items where id = :'manual_item'::uuid), 'generation preserves a checked manual item');

select public.set_shopping_item_checked(
  (select id from public.shopping_items where source = 'plan' and source_product_id = (:'first_intake'::jsonb ->> 'product_id')::uuid),
  true
);
select is(
  (public.edit_meal_plan_item(
    (:'owner_plan'::jsonb ->> 'id')::uuid, date '2026-08-03', 'breakfast', 100, 'g', 1,
    'b5000000-0000-4000-8000-00000000000a'
  ) ->> 'revision')::bigint,
  2::bigint,
  'an edit advances the optimistic plan revision'
);
select throws_ok(
  format(
    'select public.edit_meal_plan_item(%L::uuid, date ''2026-08-03'', ''breakfast'', 90, ''g'', 1, %L::uuid)',
    :'owner_plan'::jsonb ->> 'id', 'b5000000-0000-4000-8000-00000000000b'
  ),
  '40001', 'Meal plan revision conflict', 'a stale plan base revision is rejected'
);
select public.generate_shopping_from_plan_v2('b2000000-0000-4000-8000-000000000001', date '2026-08-03', 1, 'b5000000-0000-4000-8000-00000000000c') as generation_two \gset
select results_eq(
  format('select required_amount from public.shopping_items where source = ''plan'' and source_product_id = %L::uuid', :'first_intake'::jsonb ->> 'product_id'),
  $$ values (200::numeric) $$,
  'editing the household total to 500 recalculates the deficit to 200'
);
select ok(
  (select checked_at is not null from public.shopping_items where source = 'plan' and source_product_id = (:'first_intake'::jsonb ->> 'product_id')::uuid),
  'regeneration preserves the checked state of a generated item'
);
select results_eq(
  $$ select count(*)::bigint from public.shopping_items where source = 'manual' and label = 'Manuell behalten' and checked_at is not null $$,
  $$ values (1::bigint) $$,
  'regeneration preserves manual shopping intent and checked state'
);
select throws_ok(
  $$ select public.generate_shopping_from_plan_v2('b2000000-0000-4000-8000-000000000001', date '2026-08-03', 1, 'b5000000-0000-4000-8000-00000000000d') $$,
  '40001', 'Shopping calculation revision conflict', 'a stale shopping calculation base is rejected'
);
select throws_ok(
  $$ select public.generate_shopping_from_plan_v2('b2000000-0000-4000-8000-000000000001', date '2026-08-03', 2, 'b5000000-0000-4000-8000-000000000009') $$,
  '23505', 'Mutation ID payload conflict', 'generation rejects a reused mutation ID with a different base payload'
);
select throws_ok(
  $$ select public.generate_shopping_from_plan_v2('b2000000-0000-4000-8000-000000000001', date '2026-08-04', 2, 'b5000000-0000-4000-8000-00000000000e') $$,
  '22023', 'Week start must be a supported Monday', 'generation rejects a non-Monday week boundary'
);
select throws_ok(
  $$ select public.generate_shopping_from_plan_v2('b2000000-0000-4000-8000-000000000001', date '2101-01-03', 2, 'b5000000-0000-4000-8000-00000000000f') $$,
  '22023', 'Week start must be a supported Monday', 'generation rejects a Monday outside the supported range'
);

select public.plan_product_v2('b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000002', date '2026-08-07', 'snack', 10, 'g', 'b5000000-0000-4000-8000-000000000010') as delete_plan \gset
select is(
  (public.delete_meal_plan_item((:'delete_plan'::jsonb ->> 'id')::uuid, 1, 'b5000000-0000-4000-8000-000000000011') ->> 'deleted_revision')::bigint,
  1::bigint,
  'delete requires and returns the current revision'
);
select is(
  (public.delete_meal_plan_item((:'delete_plan'::jsonb ->> 'id')::uuid, 1, 'b5000000-0000-4000-8000-000000000011') ->> 'idempotent_replay')::boolean,
  true,
  'delete replay is idempotent even after the row is gone'
);
select public.edit_meal_plan_item(
  (:'member_plan'::jsonb ->> 'id')::uuid, date '2026-08-04', 'breakfast', 100, 'g', 1,
  'b5000000-0000-4000-8000-000000000013'
);
select public.generate_shopping_from_plan_v2(
  'b2000000-0000-4000-8000-000000000001', date '2026-08-03', 2,
  'b5000000-0000-4000-8000-000000000014'
);
select results_eq(
  format(
    'select count(*)::bigint from public.shopping_items where source = ''plan'' and source_product_id = %L::uuid',
    :'first_intake'::jsonb ->> 'product_id'
  ),
  $$ values (0::bigint) $$,
  'an obsolete checked generated item is removed instead of lingering as misleading history'
);
select results_eq(
  $$ select count(*)::bigint from public.shopping_items where source = 'manual' and label = 'Manuell behalten' and checked_at is not null $$,
  $$ values (1::bigint) $$,
  'clearing an obsolete generated need still preserves checked manual intent'
);
select throws_ok(
  $$ insert into public.meal_plan_slots (household_id, user_id, planned_for, meal_type, product_id, planned_amount, planned_unit) values ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', date '2026-08-03', 'dinner', 'b3000000-0000-4000-8000-000000000002', 1, 'g') $$,
  '42501', 'permission denied for table meal_plan_slots', 'authenticated clients cannot bypass planning RPCs with direct writes'
);

reset role;
select throws_ok(
  $$ insert into public.meal_plan_slots (household_id, user_id, planned_for, meal_type, recipe_id, product_id, servings, planned_amount, planned_unit) values ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', date '2026-08-03', 'dinner', 'b7000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000002', 1, 1, 'g') $$,
  '23514', null, 'a slot cannot point to a recipe and product at the same time'
);
select throws_ok(
  $$ insert into public.meal_plan_slots (household_id, user_id, planned_for, meal_type, product_id, servings, planned_amount, planned_unit) values ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', date '2026-08-03', 'dinner', 'b3000000-0000-4000-8000-000000000002', 1, 0, 'g') $$,
  '23514', null, 'a product slot must contain a positive explicit quantity'
);

select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","session_id":"b1100000-0000-4000-8000-000000000004"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.generate_shopping_from_plan_v2('b2000000-0000-4000-8000-000000000001', date '2026-08-03', 2, 'b5000000-0000-4000-8000-000000000012') $$,
  '42501', 'Household access denied', 'an unrelated AAL2 user cannot generate another household list'
);

reset role;
select * from finish();
rollback;
