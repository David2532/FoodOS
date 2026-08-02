begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

select has_function(
  'public',
  'onboard_household',
  array['text', 'text', 'integer', 'numeric'],
  'onboarding RPC exists'
);
select has_function(
  'public',
  'add_inventory_batch',
  array['uuid', 'jsonb', 'jsonb', 'uuid'],
  'inventory intake RPC exists'
);
select has_function(
  'public',
  'consume_inventory_batch',
  array['uuid', 'numeric', 'uuid'],
  'consumption RPC exists'
);
select results_eq(
  $$
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public' and policyname = 'require_aal2'
  $$,
  $$ values (20::bigint) $$,
  'every private MVP table has the restrictive AAL2 policy'
);
select has_table('public', 'recall_sources', 'approved recall-source registry exists');
select has_table('public', 'recall_events', 'immutable recall provenance events exist');
select has_table('public', 'recall_acknowledgements', 'idempotent household recall acknowledgement exists');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '11111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'owner@example.test', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'intruder@example.test', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select throws_ok(
  $$ select public.onboard_household('AAL1 Haushalt', 'Owner', 2200, 150) $$,
  '42501',
  'AAL2 required',
  'AAL1 cannot create a household'
);
select results_eq(
  $$ select count(*)::bigint from public.profiles $$,
  $$ values (0::bigint) $$,
  'AAL1 cannot read private profile rows'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select public.onboard_household('Küche Nord', 'David', 2200, 150) as owner_household \gset

select results_eq(
  $$ select count(*)::bigint from public.households $$,
  $$ values (1::bigint) $$,
  'AAL2 owner can read the newly created household'
);
select results_eq(
  $$ select role::text from public.household_members $$,
  $$ values ('owner'::text) $$,
  'onboarding creates the owner membership atomically'
);
select results_eq(
  $$ select calorie_target from public.profiles $$,
  $$ values (2200) $$,
  'onboarding persists profile targets'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select results_eq(
  $$ select count(*)::bigint from public.households $$,
  $$ values (0::bigint) $$,
  'a second AAL2 user cannot read another household'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"3017624010701","name":"Testprodukt","source":"manual","confidence":1}',
    '{"amount":500,"unit":"g","location":"pantry","best_before_date":"2027-06-30","date_source":"manual_confirmed"}',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  '42501',
  'Household access denied',
  'a second user cannot add inventory to another household'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select public.add_inventory_batch(
  :'owner_household'::uuid,
  '{
    "barcode":"3017624010701",
    "name":"Testprodukt",
    "brand":"FoodOS Test",
    "source":"open_food_facts",
    "confidence":0.9,
    "retrievedAt":"2026-08-02T10:00:00Z",
    "nutrition":{"kcal100g":200,"protein100g":10,"carbs100g":20,"fat100g":8},
    "allergens":["en:milk"]
  }'::jsonb,
  '{
    "amount":500,
    "unit":"g",
    "location":"pantry",
    "best_before_date":"2027-06-30",
    "lot_number":"LOT-42",
    "date_source":"manual_confirmed"
  }'::jsonb,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
) as first_add_result \gset

select results_eq(
  $$ select count(*)::bigint from public.products $$,
  $$ values (1::bigint) $$,
  'inventory intake persists one normalized product'
);
select results_eq(
  $$ select remaining_amount from public.inventory_batches $$,
  $$ values (500::numeric) $$,
  'inventory intake persists the confirmed batch quantity'
);
select results_eq(
  $$ select count(*)::bigint from public.inventory_events where event_type = 'purchase' $$,
  $$ values (1::bigint) $$,
  'inventory intake writes exactly one purchase event'
);
select is(
  (
    public.add_inventory_batch(
      :'owner_household'::uuid,
      '{"barcode":"3017624010701","name":"ignored replay"}'::jsonb,
      '{"amount":999,"unit":"g","location":"pantry"}'::jsonb,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
    ) ->> 'idempotent_replay'
  )::boolean,
  true,
  'inventory intake reports an idempotent replay'
);
select results_eq(
  $$ select count(*)::bigint from public.inventory_events where event_type = 'purchase' $$,
  $$ values (1::bigint) $$,
  'inventory replay does not create a duplicate event'
);
select id::text as owner_batch from public.inventory_batches limit 1 \gset

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  format(
    'select public.consume_inventory_batch(%L::uuid, 150, %L::uuid)',
    :'owner_batch',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ),
  '42501',
  'Batch access denied',
  'a second user cannot consume another household batch'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select is(
  (
    public.consume_inventory_batch(
      :'owner_batch'::uuid,
      150,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
    ) ->> 'idempotent_replay'
  )::boolean,
  false,
  'first consumption is applied'
);
select results_eq(
  $$ select remaining_amount from public.inventory_batches $$,
  $$ values (350::numeric) $$,
  'consumption reduces inventory atomically'
);
select results_eq(
  $$ select (nutrition_snapshot ->> 'kcal')::numeric from public.food_log_entries $$,
  $$ values (300::numeric) $$,
  'consumption stores the calculated nutrition snapshot'
);
select results_eq(
  $$ select count(*)::bigint from public.inventory_events where event_type = 'consume' $$,
  $$ values (1::bigint) $$,
  'consumption writes one audit event'
);
select is(
  (
    public.consume_inventory_batch(
      :'owner_batch'::uuid,
      150,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
    ) ->> 'idempotent_replay'
  )::boolean,
  true,
  'consumption reports an idempotent replay'
);
select results_eq(
  $$ select remaining_amount from public.inventory_batches $$,
  $$ values (350::numeric) $$,
  'consumption replay leaves inventory unchanged'
);
select throws_ok(
  $$ update public.inventory_batches set remaining_amount = 1 $$,
  '42501',
  'permission denied for table inventory_batches',
  'clients cannot bypass the inventory transaction RPC'
);
select throws_ok(
  $$ delete from public.inventory_events $$,
  '42501',
  'permission denied for table inventory_events',
  'the inventory audit trail is append-only for clients'
);
select public.plan_product(
  :'owner_household'::uuid,
  (select id from public.products limit 1),
  current_date,
  'dinner',
  2,
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid
)::text as planned_id \gset
select results_eq(
  $$ select count(*)::bigint from public.meal_plan_slots $$,
  $$ values (1::bigint) $$,
  'a product can be persisted in the weekly plan'
);
select is(
  public.plan_product(
    :'owner_household'::uuid,
    (select id from public.products limit 1),
    current_date,
    'dinner',
    2,
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid
  )::text,
  :'planned_id',
  'weekly planning is idempotent'
);
select public.generate_shopping_from_plan(:'owner_household'::uuid, current_date) as shopping_list_id \gset
select results_eq(
  $$ select count(*)::bigint from public.shopping_items where source = 'plan' $$,
  $$ values (1::bigint) $$,
  'shopping generation persists one missing planned product'
);
select results_eq(
  $$ select required_amount from public.shopping_items where source = 'plan' $$,
  $$ values (2::numeric) $$,
  'shopping generation subtracts only inventory with compatible units'
);
select public.add_manual_shopping_item(
  :'owner_household'::uuid, current_date, 'Äpfel', 4, 'piece',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid
) as manual_item_id \gset
select public.add_manual_shopping_item(
  :'owner_household'::uuid, current_date, 'ignored replay', 9, 'piece',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid
) as manual_item_replay_id \gset
select results_eq(
  $$ select count(*)::bigint from public.shopping_items where source = 'manual' $$,
  $$ values (1::bigint) $$,
  'manual shopping additions are idempotent'
);
select public.set_shopping_item_checked(:'manual_item_id'::uuid, true);
select ok(
  (select checked_at is not null from public.shopping_items where id = :'manual_item_id'::uuid),
  'shopping completion is persisted'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select results_eq(
  $$ select count(*)::bigint from public.inventory_batches $$,
  $$ values (0::bigint) $$,
  'AAL1 loses direct access to inventory after downgrade'
);

reset role;
select * from finish();
rollback;
