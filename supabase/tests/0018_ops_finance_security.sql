begin;

create extension if not exists pgtap with schema extensions;

select plan(39);

select has_table('public', 'ops_members', 'Ops roles are persisted separately from household data');
select has_table('public', 'ops_finance_source_documents', 'finance sources are immutable records');
select has_table('public', 'ops_finance_journals', 'finance journals are persisted');
select has_table('public', 'ops_finance_ledger_lines', 'double-entry lines are persisted');
select has_table('public', 'ops_finance_source_validation_events', 'finance source trust changes are append-only');
select has_index('public', 'ops_finance_source_validation_events', 'ops_finance_source_validation_recorded_by_idx', 'validation recorder foreign key is indexed');
select has_function('private', 'has_ops_role', array['public.ops_role'], 'Ops authorization helper is outside the exposed API schema');
select has_function('public', 'record_ops_supplier_invoice', array['text', 'text', 'text', 'text', 'bigint', 'character', 'date', 'date', 'text'], 'CEO invoice RPC exists');
select has_function('public', 'assert_ops_source_final_authoritative', array[]::text[], 'SOURCE FINAL guard exists');
select ok(
  (select count(*) from pg_class where oid in (
    'public.ops_members'::regclass,
    'public.ops_finance_source_documents'::regclass,
    'public.ops_finance_journals'::regclass,
    'public.ops_finance_ledger_lines'::regclass,
    'public.ops_finance_source_validation_events'::regclass
  ) and relrowsecurity) = 5,
  'all Ops finance tables enforce RLS'
);
select ok(
  not has_table_privilege('anon', 'public.ops_finance_source_documents', 'select')
  and not has_table_privilege('anon', 'public.ops_finance_journals', 'select')
  and not has_table_privilege('anon', 'public.ops_finance_ledger_lines', 'select'),
  'anon cannot read Ops finance data'
);
select ok(
  not has_function_privilege('anon', 'public.record_ops_supplier_invoice(text,text,text,text,bigint,character,date,date,text)', 'execute'),
  'anon cannot execute the privileged invoice RPC'
);
select ok(
  not has_function_privilege('authenticated', 'public.reject_ops_finance_mutation()', 'execute')
  and not has_function_privilege('authenticated', 'public.assert_ops_journal_balanced()', 'execute')
  and not has_function_privilege('authenticated', 'public.assert_ops_journal_complete()', 'execute')
  and not has_function_privilege('authenticated', 'public.assert_ops_source_final_authoritative()', 'execute'),
  'authenticated clients cannot execute internal trigger functions'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
(
  '44444444-4444-4444-8444-444444444444',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ceo@example.test', '',
  '{}'::jsonb, '{}'::jsonb, now(), now()
),
(
  '55555555-5555-4555-8555-555555555555',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ops-outsider@example.test', '',
  '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into auth.sessions (id, user_id, created_at, updated_at, aal, not_after)
values
  ('aaaaaaaa-4444-4444-8444-111111111111', '44444444-4444-4444-8444-444444444444', now(), now(), 'aal1', now() + interval '1 day'),
  ('aaaaaaaa-4444-4444-8444-222222222222', '44444444-4444-4444-8444-444444444444', now(), now(), 'aal2', now() + interval '1 day'),
  ('aaaaaaaa-5555-4555-8555-222222222222', '55555555-5555-4555-8555-555555555555', now(), now(), 'aal2', now() + interval '1 day');
insert into public.ops_members (user_id, role) values ('44444444-4444-4444-8444-444444444444', 'ceo');
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal1","session_id":"aaaaaaaa-4444-4444-8444-111111111111"}', true);
set local role authenticated;

select results_eq(
  $$ select count(*)::bigint from public.ops_finance_journals $$,
  $$ values (0::bigint) $$,
  'AAL1 cannot read the CEO ledger'
);
select results_eq(
  $$ select count(*)::bigint from public.ops_finance_source_validation_events $$,
  $$ values (0::bigint) $$,
  'AAL1 cannot read source validation evidence'
);
select throws_ok(
  $$ select public.record_ops_supplier_invoice('supabase', 'test-aal1', 'Supabase', 'Database', 2500, 'USD', '2026-08-05', '2026-08-05', repeat('a', 64)) $$,
  'P0001',
  'AAL2 CEO authorization required',
  'AAL1 cannot create an Ops supplier invoice'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2","session_id":"aaaaaaaa-4444-4444-8444-222222222222"}', true);
set local role authenticated;

select ok(private.has_ops_role('ceo'), 'the assigned AAL2 CEO has the explicit Ops role');
select lives_ok(
  $$ select public.record_ops_supplier_invoice('supabase', 'test-source-1', 'Supabase', 'Database subscription', 2500, 'USD', '2026-08-05', '2026-08-05', repeat('b', 64)) $$,
  'AAL2 CEO can create a balanced immutable supplier invoice journal'
);
set constraints all immediate;
set constraints all deferred;
select results_eq(
  $$ select sum(debit_minor)::bigint = sum(credit_minor)::bigint from public.ops_finance_ledger_lines $$,
  $$ values (true) $$,
  'the supplier invoice has balanced debit and credit totals'
);
select results_eq(
  $$ select payment_state::text from public.ops_finance_journals $$,
  $$ values ('open'::text) $$,
  'a supplier invoice stays open until separate payment reconciliation'
);
select results_eq(
  $$ select trust_state::text from public.ops_finance_journals $$,
  $$ values ('estimate'::text) $$,
  'manual metadata intake remains an estimate until authoritative evidence is ingested'
);
select results_eq(
  $$ select count(*)::bigint from public.ops_finance_source_validation_events $$,
  $$ values (0::bigint) $$,
  'manual metadata intake creates no authoritative validation event'
);
select lives_ok(
  $$ select public.record_ops_supplier_invoice('supabase', 'test-source-1', 'Supabase', 'Database subscription', 2500, 'USD', '2026-08-05', '2026-08-05', repeat('b', 64)) $$,
  'an exact idempotent replay returns the existing journal'
);
select results_eq(
  $$ select count(*)::bigint from public.ops_finance_journals $$,
  $$ values (1::bigint) $$,
  'an exact replay does not duplicate the journal'
);
select throws_ok(
  $$ select public.record_ops_supplier_invoice('supabase', 'test-source-1', 'Supabase', 'Database subscription', 2600, 'USD', '2026-08-05', '2026-08-05', repeat('c', 64)) $$,
  'P0001',
  'Conflicting duplicate source document',
  'the same source ID with a different payload fails closed'
);
select throws_ok(
  $$ select public.record_ops_supplier_invoice('supabase', 'test-source-2', 'Supabase', 'Database subscription', 2500, 'USD', '2026-08-05', '2026-08-05', repeat('b', 64)) $$,
  'P0001',
  'Conflicting duplicate source hash',
  'the same source hash cannot be booked under a second ID'
);
select throws_ok(
  $$ update public.ops_finance_journals set payment_state = 'paid' $$,
  '42501',
  'permission denied for table ops_finance_journals',
  'the CEO client cannot silently overwrite a journal as paid'
);
select throws_ok(
  $$ insert into public.ops_finance_ledger_lines (journal_id, account_code, currency, debit_minor) select id, 'expense:hosting', 'USD', 1 from public.ops_finance_journals $$,
  '42501',
  'permission denied for table ops_finance_ledger_lines',
  'the CEO client cannot bypass the balanced journal RPC with a direct ledger insert'
);

reset role;
create or replace function pg_temp.exercise_ops_journal_guard(input_case text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  source_id uuid := case input_case
    when 'unvalidated_final' then '60000000-0000-4000-8000-000000000001'::uuid
    when 'authoritative_final' then '70000000-0000-4000-8000-000000000001'::uuid
    when 'orphan' then '80000000-0000-4000-8000-000000000001'::uuid
    when 'wrong_total' then 'a0000000-0000-4000-8000-000000000001'::uuid
    else 'b0000000-0000-4000-8000-000000000001'::uuid
  end;
  journal_id uuid := case input_case
    when 'unvalidated_final' then '60000000-0000-4000-8000-000000000011'::uuid
    when 'authoritative_final' then '70000000-0000-4000-8000-000000000011'::uuid
    when 'orphan' then '80000000-0000-4000-8000-000000000011'::uuid
    when 'wrong_total' then 'a0000000-0000-4000-8000-000000000011'::uuid
    else 'b0000000-0000-4000-8000-000000000011'::uuid
  end;
  source_hash_character text := case input_case
    when 'unvalidated_final' then '6'
    when 'authoritative_final' then '7'
    when 'orphan' then '8'
    when 'wrong_total' then 'a'
    else 'e'
  end;
begin
  insert into public.ops_finance_source_documents (
    id, source_system, source_document_id, supplier, evidence_kind, source_sha256, issued_on, captured_by
  ) values (
    source_id, 'supabase', 'guard-' || input_case, 'Supabase', 'invoice_metadata', repeat(source_hash_character, 64), '2026-08-05',
    '44444444-4444-4444-8444-444444444444'
  );

  if input_case = 'authoritative_final' then
    insert into public.ops_finance_source_validation_events (
      source_document_id, effective_trust_state, validation_reason, authoritative_artifact_sha256, parser_version, recorded_by
    ) values (
      source_id, 'source_final', 'authoritative_artifact_validated', repeat('f', 64), 'invoice-parser-v1',
      '44444444-4444-4444-8444-444444444444'
    );
  end if;

  insert into public.ops_finance_journals (
    id, source_document_id, expense_label, trust_state, payment_state, currency, total_minor, created_by
  ) values (
    journal_id, source_id, 'Guard case ' || input_case,
    case when input_case in ('unvalidated_final', 'authoritative_final') then 'source_final'::public.ops_finance_trust_state else 'estimate'::public.ops_finance_trust_state end,
    'open', 'USD', 2500, '44444444-4444-4444-8444-444444444444'
  );

  if input_case not in ('unvalidated_final', 'orphan') then
    insert into public.ops_finance_ledger_lines (journal_id, account_code, currency, debit_minor, credit_minor) values
      (journal_id, 'expense:hosting', case when input_case = 'wrong_currency' then 'EUR' else 'USD' end, case when input_case = 'wrong_total' then 2400 else 2500 end, 0),
      (journal_id, 'liability:accounts_payable', case when input_case = 'wrong_currency' then 'EUR' else 'USD' end, 0, case when input_case = 'wrong_total' then 2400 else 2500 end);
  end if;

  set constraints all immediate;
  set constraints all deferred;
end;
$$;

select throws_ok(
  $$ select pg_temp.exercise_ops_journal_guard('unvalidated_final') $$,
  'P0001',
  'Authoritative source validation required for SOURCE FINAL',
  'SOURCE FINAL cannot be inserted without an authoritative artifact and parser version'
);
select lives_ok(
  $$ select pg_temp.exercise_ops_journal_guard('authoritative_final') $$,
  'an authoritatively validated artifact may create a SOURCE FINAL journal'
);
select results_eq(
  $$ select effective_trust_state::text from public.ops_finance_source_validation_events where source_document_id = '70000000-0000-4000-8000-000000000001' $$,
  $$ values ('source_final'::text) $$,
  'the authoritative validation event remains traceable'
);
select throws_ok(
  $$ insert into public.ops_finance_source_validation_events (source_document_id, effective_trust_state, validation_reason, parser_version, recorded_by) values ('70000000-0000-4000-8000-000000000001', 'source_final', 'authoritative_artifact_validated', 'invoice-parser-v1', '44444444-4444-4444-8444-444444444444') $$,
  '23514',
  null,
  'SOURCE FINAL validation rejects a missing authoritative artifact hash'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.ops_finance_journals journal
    left join lateral (
      select latest.effective_trust_state, latest.authoritative_artifact_sha256, latest.parser_version
      from public.ops_finance_source_validation_events latest
      where latest.source_document_id = journal.source_document_id
      order by latest.event_sequence desc
      limit 1
    ) validation on true
    where coalesce(validation.effective_trust_state, journal.trust_state) = 'source_final'
      and (
        validation.effective_trust_state is distinct from 'source_final'
        or validation.authoritative_artifact_sha256 is null
        or validation.parser_version is null
      )
  $$,
  $$ values (0::bigint) $$,
  'no effective SOURCE FINAL journal lacks authoritative validation'
);
select throws_ok(
  $$ select pg_temp.exercise_ops_journal_guard('orphan') $$,
  'P0001',
  'Ops journal 80000000-0000-4000-8000-000000000011 has no complete matching ledger.',
  'a journal without ledger lines fails closed at the deferred boundary'
);
select throws_ok(
  $$ select pg_temp.exercise_ops_journal_guard('wrong_total') $$,
  'P0001',
  'Ops journal a0000000-0000-4000-8000-000000000011 has no complete matching ledger.',
  'ledger debit and credit totals must equal the journal total'
);
select throws_ok(
  $$ select pg_temp.exercise_ops_journal_guard('wrong_currency') $$,
  'P0001',
  'Ops journal b0000000-0000-4000-8000-000000000011 has no complete matching ledger.',
  'ledger line currency must match the journal currency'
);

select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2","session_id":"aaaaaaaa-5555-4555-8555-222222222222"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.record_ops_supplier_invoice('supabase', 'test-no-role', 'Supabase', 'Database', 2500, 'USD', '2026-08-05', '2026-08-05', repeat('d', 64)) $$,
  'P0001',
  'AAL2 CEO authorization required',
  'AAL2 without an explicit CEO role cannot write the ledger'
);
select results_eq(
  $$ select count(*)::bigint from public.ops_finance_source_validation_events $$,
  $$ values (0::bigint) $$,
  'AAL2 without an explicit CEO role cannot read source validation evidence'
);
select throws_ok(
  $$ insert into public.ops_finance_source_validation_events (source_document_id, effective_trust_state, validation_reason, recorded_by) values ('70000000-0000-4000-8000-000000000001', 'estimate', 'metadata_only_reclassification', '44444444-4444-4444-8444-444444444444') $$,
  '42501',
  'permission denied for table ops_finance_source_validation_events',
  'authenticated clients cannot forge source validation events'
);

reset role;
select * from finish();
rollback;
