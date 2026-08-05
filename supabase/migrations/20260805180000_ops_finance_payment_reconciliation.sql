begin;

-- Payment evidence is deliberately metadata-only. It stores no account number,
-- IBAN, card data, statement text or raw receipt body. The authoritative artifact
-- remains in its controlled source; only its immutable hash and parser provenance
-- are retained here.
create table public.ops_finance_payment_evidence (
  id uuid primary key default gen_random_uuid(),
  payment_system text not null check (payment_system ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  external_payment_id text not null check (char_length(external_payment_id) between 2 and 160),
  evidence_kind text not null check (
    evidence_kind in ('supplier_payment_confirmation', 'supplier_payment_reversal', 'supplier_payment_uncertainty')
  ),
  artifact_sha256 text not null check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  parser_version text not null check (
    char_length(parser_version) between 2 and 80
    and parser_version ~ '^[a-z0-9][a-z0-9._-]+$'
  ),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  effective_on date not null,
  captured_by uuid not null references auth.users(id) on delete restrict,
  captured_at timestamptz not null default now(),
  unique (payment_system, external_payment_id),
  unique (artifact_sha256)
);

create table public.ops_finance_payment_events (
  event_sequence bigint generated always as identity primary key,
  journal_id uuid not null references public.ops_finance_journals(id) on delete restrict,
  payment_evidence_id uuid not null unique references public.ops_finance_payment_evidence(id) on delete restrict,
  effective_payment_state public.ops_payment_state not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now()
);

create index ops_finance_payment_evidence_captured_by_idx
  on public.ops_finance_payment_evidence (captured_by);
create index ops_finance_payment_events_latest_idx
  on public.ops_finance_payment_events (journal_id, event_sequence desc);
create index ops_finance_payment_events_recorded_by_idx
  on public.ops_finance_payment_events (recorded_by);

create or replace function public.assert_ops_payment_event_consistent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_journal public.ops_finance_journals%rowtype;
  target_evidence public.ops_finance_payment_evidence%rowtype;
  latest_validation public.ops_finance_source_validation_events%rowtype;
  expected_state public.ops_payment_state;
begin
  select * into target_journal
  from public.ops_finance_journals
  where id = new.journal_id;
  if target_journal.id is null then
    raise exception 'Payment event references an unknown journal';
  end if;

  select * into target_evidence
  from public.ops_finance_payment_evidence
  where id = new.payment_evidence_id;
  if target_evidence.id is null then
    raise exception 'Payment event references unknown evidence';
  end if;

  select * into latest_validation
  from public.ops_finance_source_validation_events validation
  where validation.source_document_id = target_journal.source_document_id
  order by validation.event_sequence desc
  limit 1;
  if latest_validation.effective_trust_state is distinct from 'source_final'
    or latest_validation.validation_reason is distinct from 'authoritative_artifact_validated'
    or latest_validation.authoritative_artifact_sha256 is null
    or latest_validation.parser_version is null then
    raise exception 'Authoritative supplier source required before payment reconciliation';
  end if;

  expected_state := case target_evidence.evidence_kind
    when 'supplier_payment_confirmation' then 'paid'::public.ops_payment_state
    when 'supplier_payment_reversal' then 'open'::public.ops_payment_state
    else 'unknown'::public.ops_payment_state
  end;
  if new.effective_payment_state is distinct from expected_state then
    raise exception 'Payment evidence kind does not match effective state';
  end if;
  if new.amount_minor is distinct from target_evidence.amount_minor
    or new.currency is distinct from target_evidence.currency
    or new.amount_minor is distinct from target_journal.total_minor
    or new.currency is distinct from target_journal.currency then
    raise exception 'Payment amount or currency does not match evidence and journal';
  end if;

  return new;
end;
$$;

create trigger ops_finance_payment_evidence_immutable
before update or delete on public.ops_finance_payment_evidence
for each row execute function public.reject_ops_finance_mutation();

create trigger ops_finance_payment_events_immutable
before update or delete on public.ops_finance_payment_events
for each row execute function public.reject_ops_finance_mutation();

create trigger ops_finance_payment_event_consistent
before insert on public.ops_finance_payment_events
for each row execute function public.assert_ops_payment_event_consistent();

alter table public.ops_finance_payment_evidence enable row level security;
alter table public.ops_finance_payment_events enable row level security;

create policy ops_payment_evidence_require_aal2 on public.ops_finance_payment_evidence
as restrictive for select to authenticated
using ((select public.has_aal2()));
create policy ops_payment_evidence_read_ceo on public.ops_finance_payment_evidence
for select to authenticated
using ((select private.has_ops_role('ceo')));

create policy ops_payment_events_require_aal2 on public.ops_finance_payment_events
as restrictive for select to authenticated
using ((select public.has_aal2()));
create policy ops_payment_events_read_ceo on public.ops_finance_payment_events
for select to authenticated
using ((select private.has_ops_role('ceo')));

create or replace function public.record_ops_supplier_payment(
  input_journal_id uuid,
  input_payment_system text,
  input_external_payment_id text,
  input_artifact_sha256 text,
  input_parser_version text,
  input_amount_minor bigint,
  input_currency char(3),
  input_paid_on date
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_journal public.ops_finance_journals%rowtype;
  latest_validation public.ops_finance_source_validation_events%rowtype;
  evidence_id uuid;
  existing_evidence public.ops_finance_payment_evidence%rowtype;
  existing_event public.ops_finance_payment_events%rowtype;
  payment_event_sequence bigint;
begin
  if not private.has_ops_role('ceo') then
    raise exception 'AAL2 CEO authorization required';
  end if;
  if input_journal_id is null
    or input_payment_system is null
    or input_payment_system !~ '^[a-z0-9][a-z0-9_-]{1,39}$'
    or input_external_payment_id is null
    or char_length(input_external_payment_id) not between 2 and 160
    or input_artifact_sha256 is null
    or input_artifact_sha256 !~ '^[0-9a-f]{64}$'
    or input_parser_version is null
    or char_length(input_parser_version) not between 2 and 80
    or input_parser_version !~ '^[a-z0-9][a-z0-9._-]+$'
    or input_amount_minor is null
    or input_amount_minor <= 0
    or input_currency is null
    or input_currency !~ '^[A-Z]{3}$'
    or input_paid_on is null then
    raise exception 'Invalid immutable payment evidence payload';
  end if;

  select * into target_journal
  from public.ops_finance_journals
  where id = input_journal_id;
  if target_journal.id is null then
    raise exception 'Unknown supplier journal';
  end if;
  if target_journal.total_minor is distinct from input_amount_minor
    or target_journal.currency is distinct from input_currency then
    raise exception 'Payment amount or currency does not match journal';
  end if;

  select * into latest_validation
  from public.ops_finance_source_validation_events validation
  where validation.source_document_id = target_journal.source_document_id
  order by validation.event_sequence desc
  limit 1;
  if latest_validation.effective_trust_state is distinct from 'source_final'
    or latest_validation.validation_reason is distinct from 'authoritative_artifact_validated'
    or latest_validation.authoritative_artifact_sha256 is null
    or latest_validation.parser_version is null then
    raise exception 'Authoritative supplier source required before payment reconciliation';
  end if;

  insert into public.ops_finance_payment_evidence (
    payment_system,
    external_payment_id,
    evidence_kind,
    artifact_sha256,
    parser_version,
    amount_minor,
    currency,
    effective_on,
    captured_by
  ) values (
    input_payment_system,
    input_external_payment_id,
    'supplier_payment_confirmation',
    input_artifact_sha256,
    input_parser_version,
    input_amount_minor,
    input_currency,
    input_paid_on,
    auth.uid()
  )
  on conflict do nothing
  returning id into evidence_id;

  if evidence_id is null then
    select * into existing_evidence
    from public.ops_finance_payment_evidence
    where payment_system = input_payment_system
      and external_payment_id = input_external_payment_id;

    if existing_evidence.id is null then
      if exists (
        select 1
        from public.ops_finance_payment_evidence
        where artifact_sha256 = input_artifact_sha256
      ) then
        raise exception 'Conflicting duplicate payment evidence hash';
      end if;
      raise exception 'Conflicting payment evidence';
    end if;

    select * into existing_event
    from public.ops_finance_payment_events
    where payment_evidence_id = existing_evidence.id;
    if existing_event.event_sequence is null
      or existing_evidence.evidence_kind is distinct from 'supplier_payment_confirmation'
      or existing_evidence.artifact_sha256 is distinct from input_artifact_sha256
      or existing_evidence.parser_version is distinct from input_parser_version
      or existing_evidence.amount_minor is distinct from input_amount_minor
      or existing_evidence.currency is distinct from input_currency
      or existing_evidence.effective_on is distinct from input_paid_on
      or existing_event.journal_id is distinct from input_journal_id
      or existing_event.effective_payment_state is distinct from 'paid'
      or existing_event.amount_minor is distinct from input_amount_minor
      or existing_event.currency is distinct from input_currency then
      raise exception 'Conflicting duplicate payment evidence';
    end if;
    return existing_event.event_sequence;
  end if;

  insert into public.ops_finance_payment_events (
    journal_id,
    payment_evidence_id,
    effective_payment_state,
    amount_minor,
    currency,
    recorded_by
  ) values (
    input_journal_id,
    evidence_id,
    'paid',
    input_amount_minor,
    input_currency,
    auth.uid()
  )
  returning event_sequence into payment_event_sequence;

  return payment_event_sequence;
end;
$$;

revoke all on table public.ops_finance_payment_evidence, public.ops_finance_payment_events
  from public, anon, authenticated;
grant select on table public.ops_finance_payment_evidence, public.ops_finance_payment_events
  to authenticated;
revoke all on sequence public.ops_finance_payment_events_event_sequence_seq
  from public, anon, authenticated;
revoke all on function public.assert_ops_payment_event_consistent()
  from public, anon, authenticated;
revoke all on function public.record_ops_supplier_payment(uuid, text, text, text, text, bigint, char(3), date)
  from public, anon, authenticated;
grant execute on function public.record_ops_supplier_payment(uuid, text, text, text, text, bigint, char(3), date)
  to authenticated;

commit;
