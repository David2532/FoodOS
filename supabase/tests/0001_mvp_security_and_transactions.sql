begin;

create extension if not exists pgtap with schema extensions;

select plan(102);

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
select has_table('public', 'privacy_choice_events', 'append-only privacy choice ledger exists');
select has_function(
  'public',
  'record_privacy_choices',
  array['text', 'boolean', 'boolean', 'boolean', 'boolean', 'boolean', 'boolean', 'boolean', 'boolean', 'uuid'],
  'versioned privacy choice RPC exists'
);
select has_function(
  'public',
  'search_cached_products',
  array['text', 'integer'],
  'AAL2 household product search RPC exists'
);
select results_eq(
  $$
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public' and policyname = 'require_aal2'
  $$,
  $$ values (22::bigint) $$,
  'every private MVP table has the restrictive AAL2 policy'
);
select has_table('public', 'recall_sources', 'approved recall-source registry exists');
select has_table('public', 'recall_events', 'immutable recall provenance events exist');
select has_table('public', 'recall_acknowledgements', 'idempotent household recall acknowledgement exists');
select has_function(
  'public',
  'ingest_recall_event',
  array['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text[]', 'text[]', 'text', 'text', 'timestamp with time zone', 'timestamp with time zone', 'timestamp with time zone', 'jsonb'],
  'official recall ingestion RPC exists'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select throws_ok(
  $$
    select public.ingest_recall_event(
      'de-lebensmittelwarnung-rss', 'fixture-recall', repeat('b', 64), 'fixture-1',
      'Fixture recall', 'Fixture product', null, array['4006381333931'], array['LOT-A'],
      'Fixture reason',
      'https://www.lebensmittelwarnung.de/___lebensmittelwarnung.de/Meldungen/fixture.html',
      now(), null, now(), '{"fixture":1}'::jsonb
    )
  $$,
  '42501',
  'Recall source approval incomplete',
  'the official adapter remains closed until source and license review are approved'
);

reset role;
update public.recall_sources
set approved = true, license_reviewed_at = now()
where source_key = 'de-lebensmittelwarnung-rss';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select is(
  (public.ingest_recall_event(
    'de-lebensmittelwarnung-rss', 'fixture-recall', repeat('b', 64), 'fixture-1',
    'Fixture recall', 'Fixture product', null, array['4006381333931'], array['LOT-A'],
    'Fixture reason',
    'https://www.lebensmittelwarnung.de/___lebensmittelwarnung.de/Meldungen/fixture.html',
    now(), null, now(), '{"fixture":1}'::jsonb
  ) ->> 'idempotent_replay')::boolean,
  false,
  'first approved official recall payload is ingested'
);
select is(
  (public.ingest_recall_event(
    'de-lebensmittelwarnung-rss', 'fixture-recall', repeat('b', 64), 'fixture-1',
    'Fixture recall', 'Fixture product', null, array['4006381333931'], array['LOT-A'],
    'Fixture reason',
    'https://www.lebensmittelwarnung.de/___lebensmittelwarnung.de/Meldungen/fixture.html',
    now(), null, now(), '{"fixture":1}'::jsonb
  ) ->> 'idempotent_replay')::boolean,
  true,
  'identical official recall payload is replayed idempotently'
);
select is(
  (public.ingest_recall_event(
    'de-lebensmittelwarnung-rss', 'fixture-recall', repeat('c', 64), 'fixture-1',
    'Corrected fixture recall', 'Fixture product', null, array['4006381333931'], array['LOT-B'],
    'Corrected fixture reason',
    'https://www.lebensmittelwarnung.de/___lebensmittelwarnung.de/Meldungen/fixture.html',
    now(), now(), now(), '{"fixture":2}'::jsonb
  ) ->> 'corrected')::boolean,
  true,
  'changed authority payload creates a correction event'
);
reset role;
select results_eq(
  $$ select count(*)::bigint from public.recall_events where source_record_id = 'fixture-recall' and superseded_by is null $$,
  $$ values (1::bigint) $$,
  'only one current version remains after a correction'
);
select results_eq(
  $$ select status from public.recall_events where source_record_id = 'fixture-recall' and superseded_by is not null $$,
  $$ values ('corrected'::text) $$,
  'the prior immutable recall version is marked corrected'
);
select ok(
  (select last_success_at is not null and last_error_code is null from public.recall_sources where source_key = 'de-lebensmittelwarnung-rss'),
  'successful ingestion updates source freshness without hiding errors as success'
);

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
select throws_ok(
  $$ select public.record_privacy_choices('2026-08-04.de-1', true, true, false, false, false, false, false, false, '13131313-1313-4313-8313-131313131313'::uuid) $$,
  '42501',
  'AAL2 required',
  'AAL1 cannot create a privacy proof event'
);
select results_eq(
  $$ select count(*)::bigint from public.privacy_choice_events $$,
  $$ values (0::bigint) $$,
  'AAL1 cannot read privacy proof rows'
);
select results_eq(
  $$ select count(*)::bigint from public.profiles $$,
  $$ values (0::bigint) $$,
  'AAL1 cannot read private profile rows'
);
select throws_ok(
  $$ select * from public.search_cached_products('Milch', 8) $$,
  '42501',
  'AAL2 required',
  'AAL1 cannot search the private household product cache'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$ select public.record_privacy_choices('stale-notice', true, true, false, false, false, false, false, false, '13131313-1313-4313-8313-131313131314'::uuid) $$,
  '22023',
  'Privacy notice version is not current',
  'a stale notice cannot create current proof'
);
select throws_ok(
  $$ select public.record_privacy_choices('2026-08-04.de-1', false, true, false, false, false, false, false, false, '13131313-1313-4313-8313-131313131315'::uuid) $$,
  '22023',
  'Minimum age confirmation required',
  'the Germany 16+ gate is enforced in the trust boundary'
);
select throws_ok(
  $$ select public.record_privacy_choices('2026-08-04.de-1', true, false, false, false, false, false, false, false, '13131313-1313-4313-8313-131313131316'::uuid) $$,
  '22023',
  'Notice acknowledgement required',
  'notice acknowledgement cannot be omitted'
);
select public.record_privacy_choices(
  '2026-08-04.de-1', true, true, false, false, false, false, false, false,
  '13131313-1313-4313-8313-131313131317'::uuid
)::text as privacy_event_id \gset
select results_eq(
  $$ select count(*)::bigint from public.privacy_choice_events $$,
  $$ values (1::bigint) $$,
  'necessary-only creates one versioned privacy event'
);
select results_eq(
  $$
    select not sensitive_profile and not analytics and not marketing
      and not image_cloud_processing and not off_contribution and not advertising
    from public.privacy_choice_events order by event_sequence desc limit 1
  $$,
  $$ values (true) $$,
  'necessary-only leaves every optional purpose disabled'
);
select is(
  public.record_privacy_choices(
    '2026-08-04.de-1', true, true, false, false, false, false, false, false,
    '13131313-1313-4313-8313-131313131317'::uuid
  )::text,
  :'privacy_event_id',
  'an identical privacy mutation replay is idempotent'
);
select throws_ok(
  $$ select public.record_privacy_choices('2026-08-04.de-1', true, true, false, true, false, false, false, false, '13131313-1313-4313-8313-131313131317'::uuid) $$,
  '23505',
  'Privacy mutation ID payload conflict',
  'a reused privacy mutation ID cannot change its payload'
);
select public.record_privacy_choices(
  '2026-08-04.de-1', true, true, true, true, false, false, false, false,
  '13131313-1313-4313-8313-131313131318'::uuid
);
select results_eq(
  $$ select count(*)::bigint from public.privacy_choice_events $$,
  $$ values (2::bigint) $$,
  'a changed optional choice appends rather than overwrites'
);
select results_eq(
  $$ select sensitive_profile and analytics and not marketing and not advertising from public.privacy_choice_events order by event_sequence desc limit 1 $$,
  $$ values (true) $$,
  'optional purposes remain independently recorded'
);
select public.record_privacy_choices(
  '2026-08-04.de-1', true, true, false, false, false, false, false, false,
  '13131313-1313-4313-8313-131313131319'::uuid
);
select results_eq(
  $$ select count(*)::bigint from public.privacy_choice_events $$,
  $$ values (3::bigint) $$,
  'withdrawal appends a third audit event'
);
select results_eq(
  $$
    select not sensitive_profile and not analytics and not marketing
      and not image_cloud_processing and not off_contribution and not advertising
    from public.privacy_choice_events order by event_sequence desc limit 1
  $$,
  $$ values (true) $$,
  'the current event proves complete optional withdrawal'
);
select throws_ok(
  $$ update public.privacy_choice_events set analytics = true $$,
  '42501',
  'permission denied for table privacy_choice_events',
  'clients cannot rewrite privacy history'
);
select throws_ok(
  $$ delete from public.privacy_choice_events $$,
  '42501',
  'permission denied for table privacy_choice_events',
  'clients cannot delete privacy history directly'
);
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
select results_eq(
  $$ select count(*)::bigint from public.privacy_choice_events $$,
  $$ values (0::bigint) $$,
  'a second AAL2 user cannot read another user privacy history'
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
    "source":"open-food-facts",
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
  $$ select barcode, name from public.search_cached_products('Testprodukt', 8) $$,
  $$ values ('3017624010701'::text, 'Testprodukt'::text) $$,
  'AAL2 product search returns a matching household product'
);
select results_eq(
  $$ select (nutrition_per_100g ->> 'energy_kcal_100g')::numeric from public.search_cached_products('Testprodukt', 8) $$,
  $$ values (200::numeric) $$,
  'AAL2 household search exposes only the bounded per-100 nutrition summary'
);
select results_eq(
  $$ select count(*)::bigint from public.search_cached_products('Schokolade', 8) $$,
  $$ values (0::bigint) $$,
  'product search does not invent an unmatched household product'
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
        "source":"open-food-facts",
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

select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, null::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household', '{"amount":1,"unit":"piece","location":"pantry"}',
    '10000000-0000-4000-8000-000000000001'
  ),
  '22023',
  'Invalid product payload shape',
  'Q-SCAN-RPC-DB-001: a direct AAL2 caller cannot submit a null product payload'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"3017624010702","name":"Checksum","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry"}',
    '10000000-0000-4000-8000-000000000002'
  ),
  '22023',
  'Invalid product payload GTIN',
  'Q-SCAN-RPC-DB-002: a direct AAL2 caller cannot bypass the GTIN checksum'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Source","source":"scraped","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry"}',
    '10000000-0000-4000-8000-000000000003'
  ),
  '22023',
  'Invalid product payload source',
  'Q-SCAN-RPC-DB-003: a direct AAL2 caller cannot invent product provenance'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"URL","source":"manual","imageUrl":"javascript:alert(1)","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry"}',
    '10000000-0000-4000-8000-000000000004'
  ),
  '22023',
  'Invalid product payload URL',
  'Q-SCAN-RPC-DB-004: a direct AAL2 caller cannot store a non-HTTP product URL'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, jsonb_set(%L::jsonb, ''{brand}'', to_jsonb(repeat(''x'', 241))), %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Text","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry"}',
    '10000000-0000-4000-8000-000000000005'
  ),
  '22023',
  'Invalid product payload text',
  'Q-SCAN-RPC-DB-005: product text bounds hold at the direct RPC boundary'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"JSON","source":"manual","allergens":{"0":"milk"},"confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry"}',
    '10000000-0000-4000-8000-000000000006'
  ),
  '22023',
  'Invalid product payload JSON bounds',
  'Q-SCAN-RPC-DB-006: malformed metadata JSON is rejected before risk evaluation'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Nutrition","source":"manual","nutrition":{"kcal100g":1201},"confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry"}',
    '10000000-0000-4000-8000-000000000007'
  ),
  '22023',
  'Invalid product payload nutrition',
  'Q-SCAN-RPC-DB-007: implausible nutrition is rejected before numeric persistence'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Mass assignment","source":"manual","admin":true,"confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry"}',
    '10000000-0000-4000-8000-000000000008'
  ),
  '22023',
  'Invalid product payload shape',
  'Q-SCAN-RPC-DB-008: unknown product keys cannot cross the RPC allowlist'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Future provenance","source":"manual","confidence":1,"retrievedAt":"2100-01-01T00:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry"}',
    '10000000-0000-4000-8000-000000000009'
  ),
  '22023',
  'Invalid product payload provenance timestamp',
  'Q-SCAN-RPC-DB-009: provenance timestamps are bounded against the server clock'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, null::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Batch null","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '10000000-0000-4000-8000-000000000010'
  ),
  '22023',
  'Invalid batch payload shape',
  'Q-SCAN-RPC-DB-010: a direct AAL2 caller cannot submit a null batch payload'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Dates","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry","best_before_date":"2027-06-30","use_by_date":"2027-06-30","date_source":"manual_confirmed"}',
    '10000000-0000-4000-8000-000000000011'
  ),
  '22023',
  'Invalid batch payload date combination',
  'Q-SCAN-RPC-DB-011: MHD and use-by cannot be asserted for one batch together'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Date source","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry","best_before_date":"2027-06-30"}',
    '10000000-0000-4000-8000-000000000012'
  ),
  '22023',
  'Invalid batch payload date combination',
  'Q-SCAN-RPC-DB-012: a confirmed date requires explicit provenance'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Date bounds","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry","best_before_date":"1999-12-31","date_source":"manual_confirmed"}',
    '10000000-0000-4000-8000-000000000013'
  ),
  '22023',
  'Invalid batch payload date bounds',
  'Q-SCAN-RPC-DB-013: physical-package dates stay inside the supported range'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Date provenance","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry","best_before_date":"2027-06-30","date_source":"provider_guessed"}',
    '10000000-0000-4000-8000-000000000014'
  ),
  '22023',
  'Invalid batch payload date source',
  'Q-SCAN-RPC-DB-014: a direct caller cannot invent date provenance'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Price","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry","purchase_price_cents":100000001}',
    '10000000-0000-4000-8000-000000000015'
  ),
  '22023',
  'Invalid batch payload numeric bounds',
  'Q-SCAN-RPC-DB-015: purchase price bounds hold before the integer cast'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Amount","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1.0001,"unit":"piece","location":"pantry"}',
    '10000000-0000-4000-8000-000000000016'
  ),
  '22023',
  'Invalid batch payload numeric bounds',
  'Q-SCAN-RPC-DB-016: amount precision cannot be silently rounded by the table type'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Batch keys","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry","household_id":"00000000-0000-4000-8000-000000000000"}',
    '10000000-0000-4000-8000-000000000017'
  ),
  '22023',
  'Invalid batch payload shape',
  'Q-SCAN-RPC-DB-017: unknown batch keys cannot cross the RPC allowlist'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Confidence","source":"manual","retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"amount":1,"unit":"piece","location":"pantry"}',
    '10000000-0000-4000-8000-000000000018'
  ),
  '22023',
  'Invalid product payload numeric bounds',
  'Q-SCAN-RPC-DB-018: missing product confidence fails closed'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Assessment confidence","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z","assessments":[{"name":"Hinweis","level":"info","reason":"Fixture"}]}',
    '{"amount":1,"unit":"piece","location":"pantry"}',
    '10000000-0000-4000-8000-000000000019'
  ),
  '22023',
  'Invalid product payload assessments',
  'Q-SCAN-RPC-DB-019: missing assessment confidence fails closed'
);
select throws_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{"barcode":"96385074","name":"Missing amount","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
    '{"unit":"piece","location":"pantry"}',
    '10000000-0000-4000-8000-000000000020'
  ),
  '22023',
  'Invalid batch payload numeric bounds',
  'Q-SCAN-RPC-DB-020: missing batch amount fails closed'
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
  '{"barcode":"4006381333931","name":"Verbrauchsdatum-Test","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}'::jsonb,
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
  '{"barcode":"4006381333948","name":"MHD-Test","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}'::jsonb,
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
    '{"barcode":"4006381333955","name":"Risikoprofil-Test","allergens":["en:milk"],"source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}',
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
    '{"barcode":"4006381333955","name":"Risikoprofil-Test","allergens":["en:milk"],"source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}'::jsonb,
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
select (public.plan_product_v2(
  :'owner_household'::uuid,
  (select id from public.products limit 1),
  current_date,
  'dinner',
  2,
  'piece',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid
) ->> 'id') as planned_id \gset
select results_eq(
  $$ select count(*)::bigint from public.meal_plan_slots $$,
  $$ values (1::bigint) $$,
  'a product can be persisted in the weekly plan'
);
select is(
  public.plan_product_v2(
    :'owner_household'::uuid,
    (select id from public.products limit 1),
    current_date,
    'dinner',
    2,
    'piece',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid
  ) ->> 'id',
  :'planned_id',
  'weekly planning is idempotent'
);
select throws_ok(
  format(
    'select public.plan_product_v2(%L::uuid, %L::uuid, current_date, ''dinner'', 3, ''piece'', %L::uuid)',
    :'owner_household', (select id::text from public.products order by created_at limit 1),
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  ),
  '23505',
  'Mutation ID payload conflict',
  'weekly planning rejects a reused mutation ID with a different payload'
);
select (public.generate_shopping_from_plan_v2(
  :'owner_household'::uuid,
  current_date - (extract(isodow from current_date)::integer - 1),
  0,
  'ecececec-ecec-4ece-8ece-ecececececec'::uuid
) ->> 'list_id') as shopping_list_id \gset
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
  :'owner_household'::uuid, current_date, 'Äpfel', 4, 'piece',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid
) as manual_item_replay_id \gset
select results_eq(
  $$ select count(*)::bigint from public.shopping_items where source = 'manual' $$,
  $$ values (1::bigint) $$,
  'manual shopping additions are idempotent'
);
select throws_ok(
  format(
    'select public.add_manual_shopping_item(%L::uuid, current_date, ''Birnen'', 9, ''piece'', %L::uuid)',
    :'owner_household', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ),
  '23505',
  'Mutation ID payload conflict',
  'manual shopping rejects a reused mutation ID with a different payload'
);
select public.set_shopping_item_checked(:'manual_item_id'::uuid, true);
select ok(
  (select checked_at is not null from public.shopping_items where id = :'manual_item_id'::uuid),
  'shopping completion is persisted'
);

select public.add_inventory_batch(
  :'owner_household'::uuid,
  '{"barcode":"4006381333962","name":"Plan-Datums-Test","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}'::jsonb,
  jsonb_build_object(
    'amount', 30, 'unit', 'g', 'location', 'pantry',
    'use_by_date', (current_date - ((extract(isodow from current_date)::integer - 1)) + 1)::text,
    'date_source', 'manual_confirmed'
  ),
  '77777777-7777-4777-8777-777777777771'::uuid
) as allocation_early_result \gset
select public.add_inventory_batch(
  :'owner_household'::uuid,
  '{"barcode":"4006381333962","name":"Plan-Datums-Test","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}'::jsonb,
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
select public.plan_product_v2(
  :'owner_household'::uuid,
  :'allocation_product'::uuid,
  current_date - (extract(isodow from current_date)::integer - 1) + 3,
  'dinner', 100, 'g',
  '77777777-7777-4777-8777-777777777773'::uuid
);
select public.generate_shopping_from_plan_v2(
  :'owner_household'::uuid,
  current_date - (extract(isodow from current_date)::integer - 1),
  (select calculation_revision from public.shopping_lists where id = :'shopping_list_id'::uuid),
  '77777777-7777-4777-8777-777777777775'::uuid
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
  '{"barcode":"4006381333962","name":"Plan-Datums-Test","source":"manual","confidence":1,"retrievedAt":"2026-08-02T10:00:00Z"}'::jsonb,
  jsonb_build_object(
    'amount', 50, 'unit', 'g', 'location', 'pantry',
    'use_by_date', (current_date - ((extract(isodow from current_date)::integer - 1)) + 6)::text,
    'date_source', 'manual_confirmed'
  ),
  '77777777-7777-4777-8777-777777777774'::uuid
);
select public.generate_shopping_from_plan_v2(
  :'owner_household'::uuid,
  current_date - (extract(isodow from current_date)::integer - 1),
  (select calculation_revision from public.shopping_lists where id = :'shopping_list_id'::uuid),
  '77777777-7777-4777-8777-777777777776'::uuid
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

select lives_ok(
  format(
    'select public.add_inventory_batch(%L::uuid, %L::jsonb, %L::jsonb, %L::uuid)',
    :'owner_household',
    '{
      "barcode":"3017624010701",
      "name":"Nutella E2E-Testprodukt",
      "brand":"FoodOS Testquelle",
      "quantity":"450 g",
      "categories":["Süßaufstriche"],
      "countries":["Deutschland"],
      "labels":[],
      "ingredientsText":"Zucker, Haselnüsse",
      "structuredIngredients":[],
      "allergens":["Haselnüsse"],
      "traces":[],
      "additives":[],
      "nutrition":{"kcal100g":539,"protein100g":6.3,"carbs100g":57.5,"fat100g":30.9},
      "assessments":[],
      "source":"open-food-facts",
      "sourceUrl":"https://world.openfoodfacts.org/product/3017624010701",
      "sourceLanguage":"de",
      "retrievedAt":"2026-08-04T10:00:00.000Z",
      "confidence":0.82
    }',
    '{
      "amount":1,
      "unit":"piece",
      "location":"pantry",
      "best_before_date":null,
      "use_by_date":null,
      "lot_number":null,
      "serial_number":null,
      "purchase_price_cents":null,
      "date_source":"manual_confirmed",
      "personal_risk_confirmed":false
    }',
    '10000000-0000-4000-8000-000000000021'
  ),
  'Q-SCAN-RPC-DB-021: the serialized authenticated E2E scan payload remains accepted'
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
