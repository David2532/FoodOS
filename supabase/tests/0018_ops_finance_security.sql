begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

select has_table('public', 'ops_members', 'Ops roles are persisted separately from household data');
select has_table('public', 'ops_finance_source_documents', 'finance sources are immutable records');
select has_table('public', 'ops_finance_journals', 'finance journals are persisted');
select has_table('public', 'ops_finance_ledger_lines', 'double-entry lines are persisted');
select has_function('private', 'has_ops_role', array['public.ops_role'], 'Ops authorization helper is outside the exposed API schema');
select has_function('public', 'record_ops_supplier_invoice', array['text', 'text', 'text', 'text', 'bigint', 'character', 'date', 'date', 'text'], 'CEO invoice RPC exists');
select ok(
  (select count(*) from pg_class where oid in (
    'public.ops_members'::regclass,
    'public.ops_finance_source_documents'::regclass,
    'public.ops_finance_journals'::regclass,
    'public.ops_finance_ledger_lines'::regclass
  ) and relrowsecurity) = 4,
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
  and not has_function_privilege('authenticated', 'public.assert_ops_journal_complete()', 'execute'),
  'authenticated clients cannot execute internal trigger functions'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '44444444-4444-4444-8444-444444444444',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ceo@example.test', '',
  '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.ops_members (user_id, role) values ('44444444-4444-4444-8444-444444444444', 'ceo');
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select results_eq(
  $$ select count(*)::bigint from public.ops_finance_journals $$,
  $$ values (0::bigint) $$,
  'AAL1 cannot read the CEO ledger'
);
select throws_ok(
  $$ select public.record_ops_supplier_invoice('supabase', 'test-aal1', 'Supabase', 'Database', 2500, 'USD', '2026-08-05', '2026-08-05', repeat('a', 64)) $$,
  'P0001',
  'AAL2 CEO authorization required',
  'AAL1 cannot create an Ops supplier invoice'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select ok(private.has_ops_role('ceo'), 'the assigned AAL2 CEO has the explicit Ops role');
select lives_ok(
  $$ select public.record_ops_supplier_invoice('supabase', 'test-source-1', 'Supabase', 'Database subscription', 2500, 'USD', '2026-08-05', '2026-08-05', repeat('b', 64)) $$,
  'AAL2 CEO can create a balanced immutable supplier invoice journal'
);
set constraints ops_finance_journal_balanced immediate;
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
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.record_ops_supplier_invoice('supabase', 'test-no-role', 'Supabase', 'Database', 2500, 'USD', '2026-08-05', '2026-08-05', repeat('d', 64)) $$,
  'P0001',
  'AAL2 CEO authorization required',
  'AAL2 without an explicit CEO role cannot write the ledger'
);

reset role;
select * from finish();
rollback;
