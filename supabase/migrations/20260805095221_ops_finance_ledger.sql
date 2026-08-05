begin;

-- The Ops ledger is deliberately separate from household/health data. New public
-- tables are not Data-API exposed by default; explicit grants and AAL2/RLS below
-- are the only application access path.
create type public.ops_role as enum ('ceo', 'finance', 'engineering_responder', 'release_manager', 'privacy_security', 'support');
create type public.ops_finance_trust_state as enum ('source_final', 'estimate', 'no_source');
create type public.ops_payment_state as enum ('open', 'paid', 'unknown');

create table public.ops_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.ops_role not null,
  granted_by uuid references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now()
);

create table public.ops_finance_source_documents (
  id uuid primary key default gen_random_uuid(),
  source_system text not null check (source_system ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  source_document_id text not null check (char_length(source_document_id) between 2 and 160),
  supplier text not null check (char_length(supplier) between 2 and 120),
  evidence_kind text not null check (evidence_kind in ('invoice_metadata')),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  issued_on date not null,
  due_on date,
  captured_by uuid not null references auth.users(id) on delete restrict,
  captured_at timestamptz not null default now(),
  check (due_on is null or due_on >= issued_on),
  unique (source_system, source_document_id)
);

create table public.ops_finance_journals (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null unique references public.ops_finance_source_documents(id) on delete restrict,
  expense_label text not null check (char_length(expense_label) between 2 and 160),
  trust_state public.ops_finance_trust_state not null,
  payment_state public.ops_payment_state not null default 'open',
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  total_minor bigint not null check (total_minor > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.ops_finance_ledger_lines (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.ops_finance_journals(id) on delete restrict,
  account_code text not null check (account_code in ('expense:hosting', 'expense:ai', 'liability:accounts_payable')),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  debit_minor bigint not null default 0 check (debit_minor >= 0),
  credit_minor bigint not null default 0 check (credit_minor >= 0),
  created_at timestamptz not null default now(),
  check ((debit_minor = 0) <> (credit_minor = 0))
);

create index ops_finance_journals_payment_idx on public.ops_finance_journals (payment_state, currency, created_at desc);
create index ops_finance_ledger_lines_journal_idx on public.ops_finance_ledger_lines (journal_id);

create or replace function public.has_ops_role(required_role public.ops_role default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.ops_members membership
      where membership.user_id = auth.uid()
        and (required_role is null or membership.role = required_role)
    );
$$;

create or replace function public.reject_ops_finance_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Ops finance records are immutable; post a correction or payment journal instead.';
end;
$$;

create or replace function public.assert_ops_journal_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_journal uuid := coalesce(new.journal_id, old.journal_id);
  debit_total bigint;
  credit_total bigint;
  currency_count integer;
begin
  select coalesce(sum(debit_minor), 0), coalesce(sum(credit_minor), 0), count(distinct currency)
    into debit_total, credit_total, currency_count
    from public.ops_finance_ledger_lines
    where journal_id = target_journal;
  if debit_total <> credit_total or currency_count <> 1 then
    raise exception 'Ops journal % is not balanced.', target_journal;
  end if;
  return null;
end;
$$;

create trigger ops_source_documents_immutable
before update or delete on public.ops_finance_source_documents
for each row execute function public.reject_ops_finance_mutation();

create trigger ops_finance_journals_immutable
before update or delete on public.ops_finance_journals
for each row execute function public.reject_ops_finance_mutation();

create trigger ops_finance_ledger_lines_immutable
before update or delete on public.ops_finance_ledger_lines
for each row execute function public.reject_ops_finance_mutation();

create constraint trigger ops_finance_journal_balanced
after insert on public.ops_finance_ledger_lines
deferrable initially deferred
for each row execute function public.assert_ops_journal_balanced();

alter table public.ops_members enable row level security;
alter table public.ops_finance_source_documents enable row level security;
alter table public.ops_finance_journals enable row level security;
alter table public.ops_finance_ledger_lines enable row level security;

create policy ops_members_read_own_aal2 on public.ops_members
for select to authenticated
using (user_id = auth.uid() and public.has_aal2());

create policy ops_source_documents_read_ceo_aal2 on public.ops_finance_source_documents
for select to authenticated
using (public.has_aal2() and public.has_ops_role('ceo'));

create policy ops_finance_journals_read_ceo_aal2 on public.ops_finance_journals
for select to authenticated
using (public.has_aal2() and public.has_ops_role('ceo'));

create policy ops_finance_ledger_lines_read_ceo_aal2 on public.ops_finance_ledger_lines
for select to authenticated
using (public.has_aal2() and public.has_ops_role('ceo'));

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
begin
  if not public.has_aal2() or not public.has_ops_role('ceo') then
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

  insert into public.ops_finance_source_documents (
    source_system, source_document_id, supplier, evidence_kind, source_sha256, issued_on, due_on, captured_by
  ) values (
    input_source_system, input_source_document_id, input_supplier, 'invoice_metadata', input_source_sha256, input_issued_on, input_due_on, auth.uid()
  )
  on conflict (source_system, source_document_id) do nothing
  returning id into source_id;

  if source_id is null then
    select id into source_id
      from public.ops_finance_source_documents
      where source_system = input_source_system and source_document_id = input_source_document_id;
    select id into journal_id from public.ops_finance_journals where source_document_id = source_id;
    return journal_id;
  end if;

  expense_account := case
    when input_source_system = 'openai' then 'expense:ai'
    else 'expense:hosting'
  end;

  insert into public.ops_finance_journals (
    source_document_id, expense_label, trust_state, payment_state, currency, total_minor, created_by
  ) values (
    source_id, input_expense_label, 'source_final', 'open', input_currency, input_amount_minor, auth.uid()
  ) returning id into journal_id;

  insert into public.ops_finance_ledger_lines (journal_id, account_code, currency, debit_minor, credit_minor) values
    (journal_id, expense_account, input_currency, input_amount_minor, 0),
    (journal_id, 'liability:accounts_payable', input_currency, 0, input_amount_minor);

  return journal_id;
end;
$$;

revoke all on table public.ops_members, public.ops_finance_source_documents, public.ops_finance_journals, public.ops_finance_ledger_lines from public, anon, authenticated;
grant select on table public.ops_members, public.ops_finance_source_documents, public.ops_finance_journals, public.ops_finance_ledger_lines to authenticated;
revoke all on function public.has_ops_role(public.ops_role) from public;
grant execute on function public.has_ops_role(public.ops_role) to authenticated;
revoke all on function public.record_ops_supplier_invoice(text, text, text, text, bigint, char(3), date, date, text) from public;
grant execute on function public.record_ops_supplier_invoice(text, text, text, text, bigint, char(3), date, date, text) to authenticated;

commit;
