begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.has_ops_role(required_role public.ops_role default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_aal2()
    and auth.uid() is not null
    and exists (
      select 1
      from public.ops_members membership
      where membership.user_id = auth.uid()
        and (required_role is null or membership.role = required_role)
    );
$$;

revoke all on function private.has_ops_role(public.ops_role) from public, anon;
grant execute on function private.has_ops_role(public.ops_role) to authenticated;

drop policy ops_members_read_own_aal2 on public.ops_members;
drop policy ops_source_documents_read_ceo_aal2 on public.ops_finance_source_documents;
drop policy ops_finance_journals_read_ceo_aal2 on public.ops_finance_journals;
drop policy ops_finance_ledger_lines_read_ceo_aal2 on public.ops_finance_ledger_lines;

create policy ops_members_require_aal2 on public.ops_members
as restrictive for select to authenticated
using ((select public.has_aal2()));
create policy ops_members_read_own on public.ops_members
for select to authenticated
using (user_id = (select auth.uid()));

create policy ops_sources_require_aal2 on public.ops_finance_source_documents
as restrictive for select to authenticated
using ((select public.has_aal2()));
create policy ops_sources_read_ceo on public.ops_finance_source_documents
for select to authenticated
using ((select private.has_ops_role('ceo')));

create policy ops_journals_require_aal2 on public.ops_finance_journals
as restrictive for select to authenticated
using ((select public.has_aal2()));
create policy ops_journals_read_ceo on public.ops_finance_journals
for select to authenticated
using ((select private.has_ops_role('ceo')));

create policy ops_lines_require_aal2 on public.ops_finance_ledger_lines
as restrictive for select to authenticated
using ((select public.has_aal2()));
create policy ops_lines_read_ceo on public.ops_finance_ledger_lines
for select to authenticated
using ((select private.has_ops_role('ceo')));

create unique index ops_finance_source_documents_sha_idx
  on public.ops_finance_source_documents (source_sha256);

create or replace function public.assert_ops_journal_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_journal uuid := coalesce(new.journal_id, old.journal_id);
  debit_total bigint;
  credit_total bigint;
  line_count integer;
  currency_count integer;
  journal_total bigint;
  journal_currency char(3);
begin
  select total_minor, currency
    into journal_total, journal_currency
    from public.ops_finance_journals
    where id = target_journal;
  select coalesce(sum(debit_minor), 0), coalesce(sum(credit_minor), 0), count(*), count(distinct currency)
    into debit_total, credit_total, line_count, currency_count
    from public.ops_finance_ledger_lines
    where journal_id = target_journal;
  if journal_total is null
    or line_count < 2
    or debit_total <> credit_total
    or debit_total <> journal_total
    or currency_count <> 1
    or exists (
      select 1 from public.ops_finance_ledger_lines
      where journal_id = target_journal and currency <> journal_currency
    ) then
    raise exception 'Ops journal % is incomplete or inconsistent.', target_journal;
  end if;
  return null;
end;
$$;

create or replace function public.assert_ops_journal_complete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  debit_total bigint;
  credit_total bigint;
  line_count integer;
  currency_count integer;
begin
  select coalesce(sum(debit_minor), 0), coalesce(sum(credit_minor), 0), count(*), count(distinct currency)
    into debit_total, credit_total, line_count, currency_count
    from public.ops_finance_ledger_lines
    where journal_id = new.id;
  if line_count < 2
    or debit_total <> new.total_minor
    or credit_total <> new.total_minor
    or currency_count <> 1
    or exists (
      select 1 from public.ops_finance_ledger_lines
      where journal_id = new.id and currency <> new.currency
    ) then
    raise exception 'Ops journal % has no complete matching ledger.', new.id;
  end if;
  return null;
end;
$$;

create constraint trigger ops_finance_journal_complete
after insert on public.ops_finance_journals
deferrable initially deferred
for each row execute function public.assert_ops_journal_complete();

create or replace function public.record_ops_supplier_invoice(
  input_source_system text,
  input_source_document_id text,
  input_supplier text,
  input_expense_label text,
  input_amount_minor bigint,
  input_currency char(3),
  input_issued_on date,
  input_due_on date,
  input_source_sha256 text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_id uuid;
  journal_id uuid;
  expense_account text;
  existing_source public.ops_finance_source_documents%rowtype;
  existing_journal public.ops_finance_journals%rowtype;
begin
  if not private.has_ops_role('ceo') then
    raise exception 'AAL2 CEO authorization required';
  end if;
  if input_source_system !~ '^[a-z0-9][a-z0-9_-]{1,39}$'
    or char_length(input_source_document_id) not between 2 and 160
    or char_length(input_supplier) not between 2 and 120
    or char_length(input_expense_label) not between 2 and 160
    or input_amount_minor <= 0
    or input_currency !~ '^[A-Z]{3}$'
    or input_source_sha256 !~ '^[0-9a-f]{64}$'
    or (input_due_on is not null and input_due_on < input_issued_on) then
    raise exception 'Invalid immutable supplier invoice payload';
  end if;

  if exists (
    select 1
    from public.ops_finance_source_documents
    where source_sha256 = input_source_sha256
      and (source_system, source_document_id) <> (input_source_system, input_source_document_id)
  ) then
    raise exception 'Conflicting duplicate source hash';
  end if;

  insert into public.ops_finance_source_documents (
    source_system, source_document_id, supplier, evidence_kind, source_sha256, issued_on, due_on, captured_by
  ) values (
    input_source_system, input_source_document_id, input_supplier, 'invoice_metadata', input_source_sha256, input_issued_on, input_due_on, auth.uid()
  )
  on conflict (source_system, source_document_id) do nothing
  returning id into source_id;

  if source_id is null then
    select * into existing_source
      from public.ops_finance_source_documents
      where source_system = input_source_system and source_document_id = input_source_document_id;
    select * into existing_journal
      from public.ops_finance_journals
      where source_document_id = existing_source.id;
    if existing_journal.id is null then
      raise exception 'Existing source document has no journal';
    end if;
    if existing_source.supplier is distinct from input_supplier
      or existing_source.source_sha256 is distinct from input_source_sha256
      or existing_source.issued_on is distinct from input_issued_on
      or existing_source.due_on is distinct from input_due_on
      or existing_journal.expense_label is distinct from input_expense_label
      or existing_journal.total_minor is distinct from input_amount_minor
      or existing_journal.currency is distinct from input_currency then
      raise exception 'Conflicting duplicate source document';
    end if;
    return existing_journal.id;
  end if;

  expense_account := case
    when input_source_system = 'openai' then 'expense:ai'
    else 'expense:hosting'
  end;

  insert into public.ops_finance_journals (
    source_document_id, expense_label, trust_state, payment_state, currency, total_minor, created_by
  ) values (
    source_id, input_expense_label, 'estimate', 'open', input_currency, input_amount_minor, auth.uid()
  ) returning id into journal_id;

  insert into public.ops_finance_ledger_lines (journal_id, account_code, currency, debit_minor, credit_minor) values
    (journal_id, expense_account, input_currency, input_amount_minor, 0),
    (journal_id, 'liability:accounts_payable', input_currency, 0, input_amount_minor);

  return journal_id;
end;
$$;

revoke all on function public.record_ops_supplier_invoice(text, text, text, text, bigint, char(3), date, date, text) from public, anon, authenticated;
grant execute on function public.record_ops_supplier_invoice(text, text, text, text, bigint, char(3), date, date, text) to authenticated;
revoke all on function public.reject_ops_finance_mutation() from public, anon, authenticated;
revoke all on function public.assert_ops_journal_balanced() from public, anon, authenticated;
revoke all on function public.assert_ops_journal_complete() from public, anon, authenticated;

drop function public.has_ops_role(public.ops_role);

commit;
