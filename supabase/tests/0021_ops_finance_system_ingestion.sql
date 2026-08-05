begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

select has_function(
  'public',
  'ingest_verified_ops_supplier_receipt',
  array[
    'text', 'text', 'text', 'text', 'text', 'bigint', 'character', 'date',
    'date', 'text', 'text', 'text', 'text', 'text', 'text', 'date'
  ],
  'the controlled verified-receipt ingestion function exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.ingest_verified_ops_supplier_receipt(text,text,text,text,text,bigint,character,date,date,text,text,text,text,text,text,date)',
    'execute'
  ),
  'anon cannot execute system finance ingestion'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.ingest_verified_ops_supplier_receipt(text,text,text,text,text,bigint,character,date,date,text,text,text,text,text,text,date)',
    'execute'
  ),
  'authenticated users cannot execute system finance ingestion'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.ingest_verified_ops_supplier_receipt(text,text,text,text,text,bigint,character,date,date,text,text,text,text,text,text,date)',
    'execute'
  ),
  'only the connector service role receives ingestion execution'
);
select results_eq(
  $$
    select count(*)::bigint
    from pg_constraint
    where conname in (
      'ops_finance_source_documents_actor_xor',
      'ops_finance_journals_actor_xor',
      'ops_finance_payment_evidence_actor_xor',
      'ops_finance_payment_events_actor_xor'
    )
  $$,
  $$ values (4::bigint) $$,
  'every newly system-writable finance record enforces a user/system actor XOR'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '99999999-9999-4999-8999-999999999999',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'system-ingestion-ceo@example.test', '',
  '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into auth.sessions (id, user_id, created_at, updated_at, aal, not_after)
values (
  'aaaaaaaa-9999-4999-8999-222222222222',
  '99999999-9999-4999-8999-999999999999',
  now(), now(), 'aal2', now() + interval '1 day'
);
insert into public.ops_members (user_id, role)
values ('99999999-9999-4999-8999-999999999999', 'ceo');

select set_config(
  'request.jwt.claims',
  '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated","aal":"aal2","session_id":"aaaaaaaa-9999-4999-8999-222222222222"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select public.ingest_verified_ops_supplier_receipt(
      'connector:ops-finance-test-v1', 'supabase', 'billing-dashboard-test-current-cycle',
      'Supabase', 'Supabase Pro', 2500, 'USD', '2026-08-05', '2026-08-05',
      repeat('2', 64), 'fixture-pdf-v1', null, null, null, null, null
    )
  $$,
  '42501',
  null,
  'an AAL2 CEO still cannot invoke the system-only ingestion function'
);
select lives_ok(
  $$
    select public.record_ops_supplier_invoice(
      'supabase', 'billing-dashboard-test-current-cycle', 'Supabase', 'Supabase Pro',
      2500, 'USD', '2026-08-05', '2026-08-05', repeat('1', 64)
    )
  $$,
  'a synthetic existing dashboard estimate is created through the human RPC'
);
reset role;
set constraints all immediate;
set constraints all deferred;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select lives_ok(
  $$
    select public.ingest_verified_ops_supplier_receipt(
      'connector:ops-finance-test-v1', 'supabase', 'billing-dashboard-test-current-cycle',
      'Supabase', 'Supabase Pro', 2500, 'USD', '2026-08-05', '2026-08-05',
      repeat('2', 64), 'fixture-pdf-v1', null, null, null, null, null
    )
  $$,
  'the connector validates the existing Supabase estimate without duplicating it'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint
    from public.ops_finance_source_documents
    where source_system = 'supabase'
      and source_document_id = 'billing-dashboard-test-current-cycle'
  $$,
  $$ values (1::bigint) $$,
  'the existing Supabase natural source key remains unique'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.ops_finance_journals journal
    join public.ops_finance_source_documents source on source.id = journal.source_document_id
    where source.source_system = 'supabase'
      and source.source_document_id = 'billing-dashboard-test-current-cycle'
  $$,
  $$ values (1::bigint) $$,
  'the existing Supabase journal is not double-booked'
);
select results_eq(
  $$
    select validation.effective_trust_state::text,
      validation.authoritative_artifact_sha256,
      validation.parser_version
    from public.ops_finance_source_validation_events validation
    join public.ops_finance_source_documents source on source.id = validation.source_document_id
    where source.source_system = 'supabase'
      and source.source_document_id = 'billing-dashboard-test-current-cycle'
    order by validation.event_sequence desc
    limit 1
  $$,
  $$ values ('source_final'::text, repeat('2', 64)::text, 'fixture-pdf-v1'::text) $$,
  'the existing Supabase journal receives authoritative source provenance'
);
select results_eq(
  $$
    select journal.payment_state::text,
      (select count(*)::bigint from public.ops_finance_payment_events event where event.journal_id = journal.id)
    from public.ops_finance_journals journal
    join public.ops_finance_source_documents source on source.id = journal.source_document_id
    where source.source_system = 'supabase'
      and source.source_document_id = 'billing-dashboard-test-current-cycle'
  $$,
  $$ values ('open'::text, 0::bigint) $$,
  'authoritative Supabase source evidence remains OPEN without payment evidence'
);
select results_eq(
  $$
    select validation.recorded_by is null, validation.recorded_by_system
    from public.ops_finance_source_validation_events validation
    join public.ops_finance_source_documents source on source.id = validation.source_document_id
    where source.source_system = 'supabase'
      and source.source_document_id = 'billing-dashboard-test-current-cycle'
    order by validation.event_sequence desc
    limit 1
  $$,
  $$ values (true, 'connector:ops-finance-test-v1'::text) $$,
  'source validation attributes the connector as a system rather than a fake user'
);

set local role service_role;
select lives_ok(
  $$
    select public.ingest_verified_ops_supplier_receipt(
      'connector:ops-finance-test-v1', 'supabase', 'billing-dashboard-test-current-cycle',
      'Supabase', 'Supabase Pro', 2500, 'USD', '2026-08-05', '2026-08-05',
      repeat('2', 64), 'fixture-pdf-v1', null, null, null, null, null
    )
  $$,
  'an exact existing-source replay is idempotent'
);
reset role;
select results_eq(
  $$
    select
      (select count(*)::bigint from public.ops_finance_source_documents),
      (select count(*)::bigint from public.ops_finance_journals),
      (select count(*)::bigint from public.ops_finance_source_validation_events)
  $$,
  $$ values (1::bigint, 1::bigint, 1::bigint) $$,
  'the source replay appends no duplicate source, journal, or validation event'
);

set local role service_role;
select lives_ok(
  $$
    select public.ingest_verified_ops_supplier_receipt(
      'connector:ops-finance-test-v1', 'paypal', 'PAYPAL-TEST-RECEIPT-0001',
      'OpenAI', 'ChatGPT Pro', 8934, 'EUR', '2026-08-03', '2026-08-03',
      repeat('3', 64), 'fixture-html-v1', 'paypal', 'PAYPAL-TEST-PAYMENT-0001',
      repeat('3', 64), 'fixture-html-v1', '2026-08-03'
    )
  $$,
  'the first synthetic completed supplier receipt is ingested atomically'
);
select lives_ok(
  $$
    select public.ingest_verified_ops_supplier_receipt(
      'connector:ops-finance-test-v1', 'paypal', 'PAYPAL-TEST-RECEIPT-0002',
      'OpenAI', 'ChatGPT Pro', 13113, 'EUR', '2026-08-05', '2026-08-05',
      repeat('4', 64), 'fixture-html-v1', 'paypal', 'PAYPAL-TEST-PAYMENT-0002',
      repeat('4', 64), 'fixture-html-v1', '2026-08-05'
    )
  $$,
  'the second synthetic completed supplier receipt is ingested atomically'
);
select lives_ok(
  $$
    select public.ingest_verified_ops_supplier_receipt(
      'connector:ops-finance-test-v1', 'paypal', 'PAYPAL-TEST-RECEIPT-0001',
      'OpenAI', 'ChatGPT Pro', 8934, 'EUR', '2026-08-03', '2026-08-03',
      repeat('3', 64), 'fixture-html-v1', 'paypal', 'PAYPAL-TEST-PAYMENT-0001',
      repeat('3', 64), 'fixture-html-v1', '2026-08-03'
    )
  $$,
  'the first paid receipt replays exactly'
);
select lives_ok(
  $$
    select public.ingest_verified_ops_supplier_receipt(
      'connector:ops-finance-test-v1', 'paypal', 'PAYPAL-TEST-RECEIPT-0002',
      'OpenAI', 'ChatGPT Pro', 13113, 'EUR', '2026-08-05', '2026-08-05',
      repeat('4', 64), 'fixture-html-v1', 'paypal', 'PAYPAL-TEST-PAYMENT-0002',
      repeat('4', 64), 'fixture-html-v1', '2026-08-05'
    )
  $$,
  'the second paid receipt replays exactly'
);
reset role;
set constraints all immediate;
set constraints all deferred;

select results_eq(
  $$
    select
      (select count(*)::bigint from public.ops_finance_source_documents),
      (select count(*)::bigint from public.ops_finance_journals),
      (select count(*)::bigint from public.ops_finance_payment_evidence),
      (select count(*)::bigint from public.ops_finance_payment_events)
  $$,
  $$ values (3::bigint, 3::bigint, 2::bigint, 2::bigint) $$,
  'two exact paid replays create no duplicate finance records'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.ops_finance_journals journal
    join public.ops_finance_source_documents source on source.id = journal.source_document_id
    join lateral (
      select validation.effective_trust_state
      from public.ops_finance_source_validation_events validation
      where validation.source_document_id = source.id
      order by validation.event_sequence desc
      limit 1
    ) latest on true
    where source.source_system = 'paypal'
      and latest.effective_trust_state = 'source_final'
  $$,
  $$ values (2::bigint) $$,
  'both completed receipt journals are SOURCE FINAL'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.ops_finance_journals journal
    join public.ops_finance_source_documents source on source.id = journal.source_document_id
    join lateral (
      select event.effective_payment_state
      from public.ops_finance_payment_events event
      where event.journal_id = journal.id
      order by event.event_sequence desc
      limit 1
    ) latest on true
    where source.source_system = 'paypal'
      and latest.effective_payment_state = 'paid'
  $$,
  $$ values (2::bigint) $$,
  'both completed receipt journals derive PAID from their newest evidence event'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.ops_finance_journals journal
    join public.ops_finance_source_documents source on source.id = journal.source_document_id
    where source.source_system = 'paypal'
      and journal.payment_state = 'open'
  $$,
  $$ values (2::bigint) $$,
  'system ingestion does not overwrite immutable legacy journal payment flags'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.ops_finance_journals journal
    where (
      select coalesce(sum(line.debit_minor), 0) = journal.total_minor
        and coalesce(sum(line.credit_minor), 0) = journal.total_minor
        and count(distinct line.currency) = 1
      from public.ops_finance_ledger_lines line
      where line.journal_id = journal.id
    )
  $$,
  $$ values (3::bigint) $$,
  'every ingested or reused journal remains exactly balanced in one currency'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.ops_finance_source_documents source
    where source.source_system = 'paypal'
      and source.captured_by is null
      and source.captured_by_system = 'connector:ops-finance-test-v1'
  $$,
  $$ values (2::bigint) $$,
  'system-created source documents have only the system actor'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.ops_finance_journals journal
    join public.ops_finance_source_documents source on source.id = journal.source_document_id
    where source.source_system = 'paypal'
      and journal.created_by is null
      and journal.created_by_system = 'connector:ops-finance-test-v1'
  $$,
  $$ values (2::bigint) $$,
  'system-created journals have only the system actor'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.ops_finance_payment_evidence evidence
    where evidence.captured_by is null
      and evidence.captured_by_system = 'connector:ops-finance-test-v1'
  $$,
  $$ values (2::bigint) $$,
  'system-created payment evidence has only the system actor'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.ops_finance_payment_events event
    where event.recorded_by is null
      and event.recorded_by_system = 'connector:ops-finance-test-v1'
  $$,
  $$ values (2::bigint) $$,
  'system-created payment events have only the system actor'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select throws_ok(
  $$
    select public.ingest_verified_ops_supplier_receipt(
      'connector:ops-finance-test-v1', 'paypal', 'PAYPAL-TEST-CONFLICT-ROLLBACK',
      'OpenAI', 'ChatGPT Pro', 8934, 'EUR', '2026-08-03', '2026-08-03',
      repeat('5', 64), 'fixture-html-v1', 'paypal', 'PAYPAL-TEST-PAYMENT-0001',
      repeat('6', 64), 'fixture-html-v1', '2026-08-03'
    )
  $$,
  'P0001',
  'Conflicting duplicate system payment evidence',
  'a conflicting existing payment ID fails the whole ingestion closed'
);
reset role;
select results_eq(
  $$
    select count(*)::bigint
    from public.ops_finance_source_documents
    where source_system = 'paypal'
      and source_document_id = 'PAYPAL-TEST-CONFLICT-ROLLBACK'
  $$,
  $$ values (0::bigint) $$,
  'payment conflict rolls back its source, validation, journal, and ledger inserts'
);

set local role service_role;
select throws_ok(
  $$
    select public.ingest_verified_ops_supplier_receipt(
      'connector:ops-finance-test-v1', 'supabase', 'billing-dashboard-test-current-cycle',
      'Supabase', 'Supabase Pro', 2600, 'USD', '2026-08-05', '2026-08-05',
      repeat('2', 64), 'fixture-pdf-v1', null, null, null, null, null
    )
  $$,
  'P0001',
  'Conflicting existing supplier journal',
  'a natural-key replay with a different amount fails closed'
);
reset role;
select results_eq(
  $$ select total_minor from public.ops_finance_journals where expense_label = 'Supabase Pro' $$,
  $$ values (2500::bigint) $$,
  'a conflicting replay leaves the original exact amount unchanged'
);

select throws_ok(
  $$
    insert into public.ops_finance_source_documents (
      source_system, source_document_id, supplier, evidence_kind, source_sha256, issued_on
    ) values (
      'synthetic', 'actor-neither', 'Synthetic', 'invoice_metadata', repeat('7', 64), '2026-08-05'
    )
  $$,
  '23514',
  null,
  'a finance source cannot omit both user and system actor'
);
select throws_ok(
  $$
    insert into public.ops_finance_source_documents (
      source_system, source_document_id, supplier, evidence_kind, source_sha256, issued_on,
      captured_by, captured_by_system
    ) values (
      'synthetic', 'actor-both', 'Synthetic', 'invoice_metadata', repeat('8', 64), '2026-08-05',
      '99999999-9999-4999-8999-999999999999', 'connector:ops-finance-test-v1'
    )
  $$,
  '23514',
  null,
  'a finance source cannot claim both user and system actor'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select throws_ok(
  $$
    select public.ingest_verified_ops_supplier_receipt(
      'Not A Valid Actor', 'paypal', 'PAYPAL-TEST-INVALID-ACTOR', 'OpenAI', 'ChatGPT Pro',
      1000, 'EUR', '2026-08-05', '2026-08-05', repeat('9', 64), 'fixture-html-v1',
      null, null, null, null, null
    )
  $$,
  'P0001',
  'Invalid verified supplier source payload',
  'invalid system actor identifiers fail before persistence'
);
select throws_ok(
  $$
    select public.ingest_verified_ops_supplier_receipt(
      'connector:ops-finance-test-v1', 'paypal', 'PAYPAL-TEST-INCOMPLETE-PAYMENT',
      'OpenAI', 'ChatGPT Pro', 1000, 'EUR', '2026-08-05', '2026-08-05',
      repeat('a', 64), 'fixture-html-v1', 'paypal', null, null, null, null
    )
  $$,
  'P0001',
  'Incomplete verified payment payload',
  'partially supplied payment evidence fails before persistence'
);
reset role;

select * from finish();
rollback;
