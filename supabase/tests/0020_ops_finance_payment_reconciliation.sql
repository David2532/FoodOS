begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

select has_table('public', 'ops_finance_payment_evidence', 'payment evidence is persisted separately from journals');
select has_table('public', 'ops_finance_payment_events', 'effective payment state is append-only');
select has_function(
  'public',
  'record_ops_supplier_payment',
  array['uuid', 'text', 'text', 'text', 'text', 'bigint', 'character', 'date'],
  'AAL2 CEO payment reconciliation RPC exists'
);
select has_function('public', 'assert_ops_payment_event_consistent', array[]::text[], 'payment event consistency guard exists');
select ok(
  (select count(*) from pg_class where oid in (
    'public.ops_finance_payment_evidence'::regclass,
    'public.ops_finance_payment_events'::regclass
  ) and relrowsecurity) = 2,
  'all payment reconciliation tables enforce RLS'
);
select results_eq(
  $$
    select count(*)::bigint
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ops_finance_payment_evidence'
      and column_name in ('iban', 'account_number', 'card_number', 'statement_text', 'raw_receipt')
  $$,
  $$ values (0::bigint) $$,
  'payment evidence stores no bank-account or raw-receipt fields'
);
select ok(
  not has_table_privilege('anon', 'public.ops_finance_payment_evidence', 'select')
  and not has_table_privilege('anon', 'public.ops_finance_payment_events', 'select'),
  'anon cannot read payment evidence or state events'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.record_ops_supplier_payment(uuid,text,text,text,text,bigint,character,date)',
    'execute'
  ),
  'anon cannot execute payment reconciliation'
);
select ok(
  not has_function_privilege('authenticated', 'public.assert_ops_payment_event_consistent()', 'execute'),
  'authenticated clients cannot execute the internal payment trigger function'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '44444444-4444-4444-8444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'payment-ceo@example.test', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'payment-user@example.test', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );
insert into public.ops_members (user_id, role)
values ('44444444-4444-4444-8444-444444444444', 'ceo');

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select results_eq(
  $$ select count(*)::bigint from public.ops_finance_payment_evidence $$,
  $$ values (0::bigint) $$,
  'AAL1 cannot read payment evidence'
);
select results_eq(
  $$ select count(*)::bigint from public.ops_finance_payment_events $$,
  $$ values (0::bigint) $$,
  'AAL1 cannot read payment events'
);
select throws_ok(
  $$ select public.record_ops_supplier_payment('70000000-0000-4000-8000-000000000011', 'paypal', 'aal1-payment', repeat('a', 64), 'gmail-html-body-v1', 13113, 'EUR', '2026-08-05') $$,
  'P0001',
  'AAL2 CEO authorization required',
  'AAL1 cannot reconcile a payment'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select results_eq(
  $$ select count(*)::bigint from public.ops_finance_payment_evidence $$,
  $$ values (0::bigint) $$,
  'AAL2 without CEO role cannot read payment evidence'
);
select results_eq(
  $$ select count(*)::bigint from public.ops_finance_payment_events $$,
  $$ values (0::bigint) $$,
  'AAL2 without CEO role cannot read payment events'
);
select throws_ok(
  $$ select public.record_ops_supplier_payment('70000000-0000-4000-8000-000000000011', 'paypal', 'non-ceo-payment', repeat('b', 64), 'gmail-html-body-v1', 13113, 'EUR', '2026-08-05') $$,
  'P0001',
  'AAL2 CEO authorization required',
  'AAL2 without CEO role cannot reconcile a payment'
);

reset role;

-- A synthetic Supabase invoice fixture has an authoritative invoice artifact but no
-- payment evidence. It must therefore remain OPEN. The OpenAI fixture below is a
-- separate validated supplier journal used to exercise the payment event chain.
insert into public.ops_finance_source_documents (
  id, source_system, source_document_id, supplier, evidence_kind, source_sha256, issued_on, due_on, captured_by
) values
  (
    '60000000-0000-4000-8000-000000000001', 'supabase', 'SUPABASE-TEST-INVOICE-0001', 'Supabase', 'invoice_metadata',
    repeat('6', 64),
    '2026-08-05', '2026-08-05', '44444444-4444-4444-8444-444444444444'
  ),
  (
    '70000000-0000-4000-8000-000000000001', 'openai', 'chatgpt-pro-2026-08-05', 'OpenAI', 'invoice_metadata',
    repeat('c', 64), '2026-08-05', '2026-08-05', '44444444-4444-4444-8444-444444444444'
  ),
  (
    '80000000-0000-4000-8000-000000000001', 'supabase', 'estimate-only-2026-08', 'Supabase', 'invoice_metadata',
    repeat('e', 64), '2026-08-05', null, '44444444-4444-4444-8444-444444444444'
  );

insert into public.ops_finance_source_validation_events (
  source_document_id, effective_trust_state, validation_reason, authoritative_artifact_sha256, parser_version, recorded_by
) values
  (
    '60000000-0000-4000-8000-000000000001', 'source_final', 'authoritative_artifact_validated',
    repeat('6', 64),
    'gmail-pdf-text-v1', '44444444-4444-4444-8444-444444444444'
  ),
  (
    '70000000-0000-4000-8000-000000000001', 'source_final', 'authoritative_artifact_validated',
    repeat('d', 64), 'supplier-invoice-v1', '44444444-4444-4444-8444-444444444444'
  );

insert into public.ops_finance_journals (
  id, source_document_id, expense_label, trust_state, payment_state, currency, total_minor, created_by
) values
  (
    '60000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000001',
    'Supabase Pro', 'source_final', 'open', 'USD', 2500, '44444444-4444-4444-8444-444444444444'
  ),
  (
    '70000000-0000-4000-8000-000000000011', '70000000-0000-4000-8000-000000000001',
    'ChatGPT Pro', 'source_final', 'open', 'EUR', 13113, '44444444-4444-4444-8444-444444444444'
  ),
  (
    '80000000-0000-4000-8000-000000000011', '80000000-0000-4000-8000-000000000001',
    'Estimate only', 'estimate', 'open', 'USD', 2500, '44444444-4444-4444-8444-444444444444'
  );

insert into public.ops_finance_ledger_lines (journal_id, account_code, currency, debit_minor, credit_minor) values
  ('60000000-0000-4000-8000-000000000011', 'expense:hosting', 'USD', 2500, 0),
  ('60000000-0000-4000-8000-000000000011', 'liability:accounts_payable', 'USD', 0, 2500),
  ('70000000-0000-4000-8000-000000000011', 'expense:ai', 'EUR', 13113, 0),
  ('70000000-0000-4000-8000-000000000011', 'liability:accounts_payable', 'EUR', 0, 13113),
  ('80000000-0000-4000-8000-000000000011', 'expense:hosting', 'USD', 2500, 0),
  ('80000000-0000-4000-8000-000000000011', 'liability:accounts_payable', 'USD', 0, 2500);
set constraints all immediate;
set constraints all deferred;

select results_eq(
  $$
    select journal.payment_state::text
    from public.ops_finance_journals journal
    where journal.id = '60000000-0000-4000-8000-000000000011'
      and not exists (
        select 1 from public.ops_finance_payment_events event where event.journal_id = journal.id
      )
  $$,
  $$ values ('open'::text) $$,
  'the 25 USD Supabase invoice remains OPEN without payment evidence'
);

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select results_eq(
  $$ select count(*)::bigint from public.ops_finance_journals $$,
  $$ values (3::bigint) $$,
  'the AAL2 CEO can read the payment-eligible journal scope'
);
select lives_ok(
  $$
    select public.record_ops_supplier_payment(
      '70000000-0000-4000-8000-000000000011',
      'paypal',
      'PAYPAL-TEST-PAYMENT-0020-0001',
      repeat('5', 64),
      'gmail-html-body-v1',
      13113,
      'EUR',
      '2026-08-05'
    )
  $$,
  'the AAL2 CEO can append exact payment evidence for SOURCE FINAL'
);
select results_eq(
  $$
    select effective_payment_state::text
    from public.ops_finance_payment_events
    where journal_id = '70000000-0000-4000-8000-000000000011'
    order by event_sequence desc
    limit 1
  $$,
  $$ values ('paid'::text) $$,
  'a payment confirmation produces an effective PAID event'
);
select lives_ok(
  $$
    select public.record_ops_supplier_payment(
      '70000000-0000-4000-8000-000000000011',
      'paypal',
      'PAYPAL-TEST-PAYMENT-0020-0001',
      repeat('5', 64),
      'gmail-html-body-v1',
      13113,
      'EUR',
      '2026-08-05'
    )
  $$,
  'an exact payment-evidence replay is idempotent'
);
select results_eq(
  $$
    select count(*)::bigint, (select count(*)::bigint from public.ops_finance_payment_events)
    from public.ops_finance_payment_evidence
  $$,
  $$ values (1::bigint, 1::bigint) $$,
  'an exact replay creates neither duplicate evidence nor a duplicate event'
);
select throws_ok(
  $$ select public.record_ops_supplier_payment('70000000-0000-4000-8000-000000000011', 'paypal', 'PAYPAL-TEST-PAYMENT-0020-0001', repeat('9', 64), 'gmail-html-body-v1', 13113, 'EUR', '2026-08-05') $$,
  'P0001',
  'Conflicting duplicate payment evidence',
  'the same external payment ID with a different hash fails closed'
);
select throws_ok(
  $$ select public.record_ops_supplier_payment('70000000-0000-4000-8000-000000000011', 'paypal', 'different-payment-id', repeat('5', 64), 'gmail-html-body-v1', 13113, 'EUR', '2026-08-05') $$,
  'P0001',
  'Conflicting duplicate payment evidence hash',
  'the same payment artifact hash under another ID fails closed'
);
select throws_ok(
  $$ select public.record_ops_supplier_payment('70000000-0000-4000-8000-000000000011', 'paypal', null, repeat('6', 64), 'gmail-html-body-v1', 13113, 'EUR', '2026-08-05') $$,
  'P0001',
  'Invalid immutable payment evidence payload',
  'NULL payment evidence identifiers fail closed before persistence'
);
select throws_ok(
  $$ select public.record_ops_supplier_payment('70000000-0000-4000-8000-000000000011', 'paypal', 'amount-mismatch', repeat('7', 64), 'gmail-html-body-v1', 8934, 'EUR', '2026-08-03') $$,
  'P0001',
  'Payment amount or currency does not match journal',
  'payment evidence with the wrong exact minor amount is rejected'
);
select throws_ok(
  $$ select public.record_ops_supplier_payment('70000000-0000-4000-8000-000000000011', 'paypal', 'currency-mismatch', repeat('8', 64), 'gmail-html-body-v1', 13113, 'USD', '2026-08-05') $$,
  'P0001',
  'Payment amount or currency does not match journal',
  'payment evidence with the wrong currency is rejected'
);
select throws_ok(
  $$ select public.record_ops_supplier_payment('80000000-0000-4000-8000-000000000011', 'paypal', 'estimate-payment', repeat('1', 64), 'gmail-html-body-v1', 2500, 'USD', '2026-08-05') $$,
  'P0001',
  'Authoritative supplier source required before payment reconciliation',
  'an ESTIMATE journal cannot become PAID'
);
select throws_ok(
  $$ insert into public.ops_finance_payment_evidence (payment_system, external_payment_id, evidence_kind, artifact_sha256, parser_version, amount_minor, currency, effective_on, captured_by) values ('paypal', 'forged-evidence', 'supplier_payment_confirmation', repeat('2', 64), 'gmail-html-body-v1', 13113, 'EUR', '2026-08-05', '44444444-4444-4444-8444-444444444444') $$,
  '42501',
  'permission denied for table ops_finance_payment_evidence',
  'the CEO client cannot forge payment evidence directly'
);
select throws_ok(
  $$ insert into public.ops_finance_payment_events (journal_id, payment_evidence_id, effective_payment_state, amount_minor, currency, recorded_by) select '70000000-0000-4000-8000-000000000011', id, 'paid', 13113, 'EUR', '44444444-4444-4444-8444-444444444444' from public.ops_finance_payment_evidence limit 1 $$,
  '42501',
  'permission denied for table ops_finance_payment_events',
  'the CEO client cannot forge payment state directly'
);

reset role;
create or replace function pg_temp.exercise_payment_event_guard(input_case text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  evidence_id uuid;
begin
  insert into public.ops_finance_payment_evidence (
    payment_system, external_payment_id, evidence_kind, artifact_sha256, parser_version,
    amount_minor, currency, effective_on, captured_by
  ) values (
    'paypal',
    'guard-' || input_case,
    'supplier_payment_confirmation',
    case when input_case = 'amount' then repeat('3', 64) else repeat('4', 64) end,
    'gmail-html-body-v1',
    case when input_case = 'amount' then 13112 else 13113 end,
    'EUR',
    '2026-08-05',
    '44444444-4444-4444-8444-444444444444'
  ) returning id into evidence_id;

  insert into public.ops_finance_payment_events (
    journal_id, payment_evidence_id, effective_payment_state, amount_minor, currency, recorded_by
  ) values (
    '70000000-0000-4000-8000-000000000011',
    evidence_id,
    case when input_case = 'state' then 'open'::public.ops_payment_state else 'paid'::public.ops_payment_state end,
    case when input_case = 'amount' then 13112 else 13113 end,
    'EUR',
    '44444444-4444-4444-8444-444444444444'
  );
end;
$$;

select throws_ok(
  $$ select pg_temp.exercise_payment_event_guard('amount') $$,
  'P0001',
  'Payment amount or currency does not match evidence and journal',
  'the table trigger rejects a mismatched amount even outside the RPC'
);
select throws_ok(
  $$ select pg_temp.exercise_payment_event_guard('state') $$,
  'P0001',
  'Payment evidence kind does not match effective state',
  'the table trigger rejects a state inconsistent with evidence kind'
);

select lives_ok(
  $$
    with evidence as (
      insert into public.ops_finance_payment_evidence (
        payment_system, external_payment_id, evidence_kind, artifact_sha256, parser_version,
        amount_minor, currency, effective_on, captured_by
      ) values (
        'paypal', 'PAYPAL-TEST-PAYMENT-0020-0001-reversal', 'supplier_payment_reversal', repeat('2', 64),
        'gmail-html-body-v1', 13113, 'EUR', '2026-08-05', '44444444-4444-4444-8444-444444444444'
      ) returning id
    )
    insert into public.ops_finance_payment_events (
      journal_id, payment_evidence_id, effective_payment_state, amount_minor, currency, recorded_by
    )
    select '70000000-0000-4000-8000-000000000011', id, 'open', 13113, 'EUR', '44444444-4444-4444-8444-444444444444'
    from evidence
  $$,
  'a corrective reversal is appended rather than overwriting payment history'
);
select results_eq(
  $$
    select effective_payment_state::text
    from public.ops_finance_payment_events
    where journal_id = '70000000-0000-4000-8000-000000000011'
    order by event_sequence desc
    limit 1
  $$,
  $$ values ('open'::text) $$,
  'the newest append-only event is the effective payment state'
);
select throws_ok(
  $$ update public.ops_finance_payment_evidence set parser_version = 'tampered-v2' where external_payment_id = 'PAYPAL-TEST-PAYMENT-0020-0001' $$,
  'P0001',
  'Ops finance records are immutable; post a correction or payment journal instead.',
  'payment evidence cannot be updated'
);
select throws_ok(
  $$ delete from public.ops_finance_payment_events where journal_id = '70000000-0000-4000-8000-000000000011' $$,
  'P0001',
  'Ops finance records are immutable; post a correction or payment journal instead.',
  'payment events cannot be deleted'
);
select results_eq(
  $$ select payment_state::text from public.ops_finance_journals where id = '70000000-0000-4000-8000-000000000011' $$,
  $$ values ('open'::text) $$,
  'the immutable legacy journal flag is not overwritten by reconciliation events'
);

select * from finish();
rollback;
