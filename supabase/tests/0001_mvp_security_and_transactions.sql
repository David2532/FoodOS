begin;

create extension if not exists pgtap with schema extensions;

select plan(48);

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
select has_function(
  'public',
  'consume_inventory_batch_v2',
  array['uuid', 'numeric', 'uuid', 'boolean', 'boolean'],
  'safety-aware consumption RPC exists'
);
select has_table('public', 'mutation_receipts', 'payload-bound mutation receipts exist');
select results_eq(
  $$
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public' and policyname = 'require_aal2'
  $$,
  $$ values (21::bigint) $$,
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
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"3017624010701","name":"changed payload"}',
    '{"amount":999,"unit":"g","location":"pantry"}',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  '23505',
  'Mutation ID payload conflict',
  'inventory intake rejects a reused mutation ID with a different payload'
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
  format(
    'select public.consume_inventory_batch(%L::uuid, 25, %L::uuid)',
    :'owner_batch', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ),
  '23505',
  'Mutation ID payload conflict',
  'consumption rejects a reused mutation ID with a different amount'
);

select (public.add_inventory_batch(
  :'owner_household'::uuid,
  '{"barcode":"4006381333931","name":"Verbrauchsdatum-Test","source":"manual","confidence":1}'::jsonb,
  jsonb_build_object(
    'amount', 200, 'unit', 'g', 'location', 'fridge',
    'use_by_date', (current_date - 1)::text, 'date_source', 'manual_confirmed'
  ),
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid
) ->> 'batch_id') as use_by_batch \gset
select throws_ok(
  format(
    'select public.consume_inventory_batch_v2(%L::uuid, 10, %L::uuid, false, false)',
    :'use_by_batch', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeef'
  ),
  '22023',
  'Use-by date exceeded',
  'a past use-by date blocks consumption without an override path'
);

select (public.add_inventory_batch(
  :'owner_household'::uuid,
  '{"barcode":"4006381333948","name":"MHD-Test","source":"manual","confidence":1}'::jsonb,
  jsonb_build_object(
    'amount', 200, 'unit', 'g', 'location', 'pantry',
    'best_before_date', (current_date - 1)::text, 'date_source', 'manual_confirmed'
  ),
  'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid
) ->> 'batch_id') as best_before_batch \gset
select throws_ok(
  format(
    'select public.consume_inventory_batch_v2(%L::uuid, 10, %L::uuid, false, false)',
    :'best_before_batch', 'ffffffff-ffff-4fff-8fff-fffffffffffe'
  ),
  '22023',
  'Best-before confirmation required',
  'a past best-before date requires explicit confirmation'
);
select is(
  (public.consume_inventory_batch_v2(
    :'best_before_batch'::uuid, 10,
    'ffffffff-ffff-4fff-8fff-fffffffffffe'::uuid, true, false
  ) ->> 'idempotent_replay')::boolean,
  false,
  'confirmed past-best-before consumption is applied once'
);

reset role;
insert into public.recall_sources (
  id, source_key, display_name, authority_url, approved, license_reviewed_at, last_success_at
) values (
  '12345678-1234-4234-8234-123456789012', 'pgtap-authority', 'pgTAP Behörde',
  'https://example.test/authority', true, now(), now()
);
insert into public.recall_events (
  source_id, source_record_id, payload_sha256, parser_version, status, title,
  product_name, gtins, lot_numbers, reason, source_url, published_at, retrieved_at, raw_payload
) values (
  '12345678-1234-4234-8234-123456789012', 'recall-42', repeat('a', 64), 'pgtap-1',
  'active', 'Test-Rückruf', 'Testprodukt', array['3017624010701'], array['lot 42'],
  'Nur synthetische Testdaten', 'https://example.test/authority/recall-42', now(), now(), '{"fixture":true}'::jsonb
);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  format(
    'select public.consume_inventory_batch_v2(%L::uuid, 10, %L::uuid, false, false)',
    :'owner_batch', '99999999-9999-4999-8999-999999999999'
  ),
  '22023',
  'Exact recall match blocks consumption',
  'an approved exact GTIN and lot recall blocks consumption'
);

insert into public.user_food_risk_profiles (user_id, canonical_key, kind, severity)
values ('11111111-1111-4111-8111-111111111111', 'milk', 'allergen', 'strict_avoid');
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"4006381333955","name":"Risikoprofil-Test","allergens":["en:milk"],"source":"manual","confidence":1}',
    '{"amount":100,"unit":"g","location":"pantry"}',
    '88888888-8888-4888-8888-888888888888'
  ),
  '22023',
  'Personal risk confirmation required',
  'a critical personal food-risk match requires confirmation before intake'
);
select is(
  (public.add_inventory_batch(
    :'owner_household'::uuid,
    '{"barcode":"4006381333955","name":"Risikoprofil-Test","allergens":["en:milk"],"source":"manual","confidence":1}'::jsonb,
    '{"amount":100,"unit":"g","location":"pantry","personal_risk_confirmed":true}'::jsonb,
    '88888888-8888-4888-8888-888888888888'::uuid
  ) ->> 'idempotent_replay')::boolean,
  false,
  'an explicitly confirmed critical personal-risk intake is applied once'
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

select public.add_inventory_batch(
  :'owner_household'::uuid,
  '{"barcode":"4006381333962","name":"Plan-Datums-Test","source":"manual","confidence":1}'::jsonb,
  jsonb_build_object(
    'amount', 30, 'unit', 'g', 'location', 'pantry',
    'use_by_date', (current_date - ((extract(isodow from current_date)::integer - 1)) + 1)::text,
    'date_source', 'manual_confirmed'
  ),
  '77777777-7777-4777-8777-777777777771'::uuid
) as allocation_early_result \gset
select public.add_inventory_batch(
  :'owner_household'::uuid,
  '{"barcode":"4006381333962","name":"Plan-Datums-Test","source":"manual","confidence":1}'::jsonb,
  jsonb_build_object(
    'amount', 60, 'unit', 'g', 'location', 'pantry',
    'use_by_date', (current_date - ((extract(isodow from current_date)::integer - 1)) + 6)::text,
    'date_source', 'manual_confirmed'
  ),
  '77777777-7777-4777-8777-777777777772'::uuid
) as allocation_late_result \gset
select (:'allocation_early_result'::jsonb ->> 'product_id') as allocation_product \gset

reset role;
update public.products
set package_amount = 100, package_unit = 'g'
where id = :'allocation_product'::uuid;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select public.plan_product(
  :'owner_household'::uuid,
  :'allocation_product'::uuid,
  current_date - (extract(isodow from current_date)::integer - 1) + 3,
  'dinner', 1,
  '77777777-7777-4777-8777-777777777773'::uuid
);
select public.generate_shopping_from_plan(
  :'owner_household'::uuid,
  current_date - (extract(isodow from current_date)::integer - 1)
);
select results_eq(
  format(
    'select required_amount from public.shopping_items where source = ''plan'' and source_product_id = %L::uuid',
    :'allocation_product'
  ),
  $$ values (40::numeric) $$,
  'shopping allocation excludes stock that expires before the planned use date'
);

select public.add_inventory_batch(
  :'owner_household'::uuid,
  '{"barcode":"4006381333962","name":"Plan-Datums-Test","source":"manual","confidence":1}'::jsonb,
  jsonb_build_object(
    'amount', 50, 'unit', 'g', 'location', 'pantry',
    'use_by_date', (current_date - ((extract(isodow from current_date)::integer - 1)) + 6)::text,
    'date_source', 'manual_confirmed'
  ),
  '77777777-7777-4777-8777-777777777774'::uuid
);
select public.generate_shopping_from_plan(
  :'owner_household'::uuid,
  current_date - (extract(isodow from current_date)::integer - 1)
);
select results_eq(
  format(
    'select count(*)::bigint from public.shopping_items where source = ''plan'' and source_product_id = %L::uuid',
    :'allocation_product'
  ),
  $$ values (0::bigint) $$,
  'regeneration removes a stale plan shortage once usable stock covers it'
);
select results_eq(
  $$ select count(*)::bigint from public.shopping_items where source = 'manual' $$,
  $$ values (1::bigint) $$,
  'plan regeneration retains confirmed manual shopping intent'
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
