begin;

-- Connector-ingested finance records must identify a system actor explicitly.
-- A system is never represented by a synthetic auth.users row. Existing human
-- records keep their user actor and satisfy the same exclusive-or constraint.
alter table public.ops_finance_source_documents
  add column captured_by_system text check (
    captured_by_system is null
    or (
      char_length(captured_by_system) between 2 and 120
      and captured_by_system ~ '^[a-z][a-z0-9._:-]+$'
    )
  ),
  alter column captured_by drop not null,
  add constraint ops_finance_source_documents_actor_xor
    check ((captured_by is null) <> (captured_by_system is null));

alter table public.ops_finance_journals
  add column created_by_system text check (
    created_by_system is null
    or (
      char_length(created_by_system) between 2 and 120
      and created_by_system ~ '^[a-z][a-z0-9._:-]+$'
    )
  ),
  alter column created_by drop not null,
  add constraint ops_finance_journals_actor_xor
    check ((created_by is null) <> (created_by_system is null));

alter table public.ops_finance_payment_evidence
  add column captured_by_system text check (
    captured_by_system is null
    or (
      char_length(captured_by_system) between 2 and 120
      and captured_by_system ~ '^[a-z][a-z0-9._:-]+$'
    )
  ),
  alter column captured_by drop not null,
  add constraint ops_finance_payment_evidence_actor_xor
    check ((captured_by is null) <> (captured_by_system is null));

alter table public.ops_finance_payment_events
  add column recorded_by_system text check (
    recorded_by_system is null
    or (
      char_length(recorded_by_system) between 2 and 120
      and recorded_by_system ~ '^[a-z][a-z0-9._:-]+$'
    )
  ),
  alter column recorded_by drop not null,
  add constraint ops_finance_payment_events_actor_xor
    check ((recorded_by is null) <> (recorded_by_system is null));

create unique index ops_finance_source_validation_artifact_sha_idx
  on public.ops_finance_source_validation_events (authoritative_artifact_sha256)
  where authoritative_artifact_sha256 is not null;

create or replace function public.ingest_verified_ops_supplier_receipt(
  input_system_actor text,
  input_source_system text,
  input_source_document_id text,
  input_supplier text,
  input_expense_label text,
  input_amount_minor bigint,
  input_currency char(3),
  input_issued_on date,
  input_due_on date,
  input_source_artifact_sha256 text,
  input_source_parser_version text,
  input_payment_system text,
  input_external_payment_id text,
  input_payment_artifact_sha256 text,
  input_payment_parser_version text,
  input_paid_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_record public.ops_finance_source_documents%rowtype;
  journal_record public.ops_finance_journals%rowtype;
  latest_validation public.ops_finance_source_validation_events%rowtype;
  evidence_id uuid;
  existing_evidence public.ops_finance_payment_evidence%rowtype;
  existing_event public.ops_finance_payment_events%rowtype;
  payment_requested boolean;
  expense_account text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service-role connector authorization required';
  end if;

  if input_system_actor is null
    or char_length(input_system_actor) not between 2 and 120
    or input_system_actor !~ '^[a-z][a-z0-9._:-]+$'
    or input_source_system is null
    or input_source_system !~ '^[a-z0-9][a-z0-9_-]{1,39}$'
    or input_source_document_id is null
    or char_length(input_source_document_id) not between 2 and 160
    or input_supplier is null
    or char_length(input_supplier) not between 2 and 120
    or input_expense_label is null
    or char_length(input_expense_label) not between 2 and 160
    or input_amount_minor is null
    or input_amount_minor <= 0
    or input_currency is null
    or input_currency !~ '^[A-Z]{3}$'
    or input_issued_on is null
    or (input_due_on is not null and input_due_on < input_issued_on)
    or input_source_artifact_sha256 is null
    or input_source_artifact_sha256 !~ '^[0-9a-f]{64}$'
    or input_source_parser_version is null
    or char_length(input_source_parser_version) not between 2 and 80
    or input_source_parser_version !~ '^[a-z0-9][a-z0-9._-]+$' then
    raise exception 'Invalid verified supplier source payload';
  end if;

  payment_requested := input_payment_system is not null
    or input_external_payment_id is not null
    or input_payment_artifact_sha256 is not null
    or input_payment_parser_version is not null
    or input_paid_on is not null;
  if payment_requested and (
    input_payment_system is null
    or input_payment_system !~ '^[a-z0-9][a-z0-9_-]{1,39}$'
    or input_external_payment_id is null
    or char_length(input_external_payment_id) not between 2 and 160
    or input_payment_artifact_sha256 is null
    or input_payment_artifact_sha256 !~ '^[0-9a-f]{64}$'
    or input_payment_parser_version is null
    or char_length(input_payment_parser_version) not between 2 and 80
    or input_payment_parser_version !~ '^[a-z0-9][a-z0-9._-]+$'
    or input_paid_on is null
  ) then
    raise exception 'Incomplete verified payment payload';
  end if;

  select * into source_record
  from public.ops_finance_source_documents source
  where source.source_system = input_source_system
    and source.source_document_id = input_source_document_id;

  if source_record.id is null then
    if exists (
      select 1
      from public.ops_finance_source_documents source
      where source.source_sha256 = input_source_artifact_sha256
    ) then
      raise exception 'Conflicting supplier source artifact hash';
    end if;

    insert into public.ops_finance_source_documents (
      source_system,
      source_document_id,
      supplier,
      evidence_kind,
      source_sha256,
      issued_on,
      due_on,
      captured_by_system
    ) values (
      input_source_system,
      input_source_document_id,
      input_supplier,
      'invoice_metadata',
      input_source_artifact_sha256,
      input_issued_on,
      input_due_on,
      input_system_actor
    )
    returning * into source_record;
  elsif source_record.supplier is distinct from input_supplier
    or source_record.evidence_kind is distinct from 'invoice_metadata'
    or source_record.issued_on is distinct from input_issued_on
    or source_record.due_on is distinct from input_due_on then
    raise exception 'Conflicting existing supplier source';
  end if;

  select * into latest_validation
  from public.ops_finance_source_validation_events validation
  where validation.source_document_id = source_record.id
  order by validation.event_sequence desc
  limit 1;

  if latest_validation.event_sequence is null then
    if exists (
      select 1
      from public.ops_finance_source_validation_events validation
      where validation.authoritative_artifact_sha256 = input_source_artifact_sha256
        and validation.source_document_id <> source_record.id
    ) then
      raise exception 'Conflicting supplier validation artifact hash';
    end if;

    insert into public.ops_finance_source_validation_events (
      source_document_id,
      effective_trust_state,
      validation_reason,
      authoritative_artifact_sha256,
      parser_version,
      recorded_by_system
    ) values (
      source_record.id,
      'source_final',
      'authoritative_artifact_validated',
      input_source_artifact_sha256,
      input_source_parser_version,
      input_system_actor
    );
  elsif latest_validation.effective_trust_state is distinct from 'source_final'
    or latest_validation.validation_reason is distinct from 'authoritative_artifact_validated'
    or latest_validation.authoritative_artifact_sha256 is distinct from input_source_artifact_sha256
    or latest_validation.parser_version is distinct from input_source_parser_version then
    if latest_validation.validation_reason = 'metadata_only_reclassification'
      and latest_validation.authoritative_artifact_sha256 is null
      and latest_validation.parser_version is null then
      if exists (
        select 1
        from public.ops_finance_source_validation_events validation
        where validation.authoritative_artifact_sha256 = input_source_artifact_sha256
          and validation.source_document_id <> source_record.id
      ) then
        raise exception 'Conflicting supplier validation artifact hash';
      end if;
      insert into public.ops_finance_source_validation_events (
        source_document_id,
        effective_trust_state,
        validation_reason,
        authoritative_artifact_sha256,
        parser_version,
        recorded_by_system
      ) values (
        source_record.id,
        'source_final',
        'authoritative_artifact_validated',
        input_source_artifact_sha256,
        input_source_parser_version,
        input_system_actor
      );
    else
      raise exception 'Conflicting existing supplier validation';
    end if;
  end if;

  select * into journal_record
  from public.ops_finance_journals journal
  where journal.source_document_id = source_record.id;

  if journal_record.id is null then
    insert into public.ops_finance_journals (
      source_document_id,
      expense_label,
      trust_state,
      payment_state,
      currency,
      total_minor,
      created_by_system
    ) values (
      source_record.id,
      input_expense_label,
      'source_final',
      'open',
      input_currency,
      input_amount_minor,
      input_system_actor
    )
    returning * into journal_record;

    expense_account := case
      when input_source_system = 'openai' or input_supplier = 'OpenAI' then 'expense:ai'
      else 'expense:hosting'
    end;
    insert into public.ops_finance_ledger_lines (
      journal_id,
      account_code,
      currency,
      debit_minor,
      credit_minor
    ) values
      (journal_record.id, expense_account, input_currency, input_amount_minor, 0),
      (journal_record.id, 'liability:accounts_payable', input_currency, 0, input_amount_minor);
  elsif journal_record.expense_label is distinct from input_expense_label
    or journal_record.total_minor is distinct from input_amount_minor
    or journal_record.currency is distinct from input_currency then
    raise exception 'Conflicting existing supplier journal';
  end if;

  if not payment_requested then
    if journal_record.payment_state = 'paid'
      or exists (
        select 1
        from public.ops_finance_payment_events event
        where event.journal_id = journal_record.id
      ) then
      raise exception 'Existing payment evidence conflicts with OPEN ingestion';
    end if;
    return journal_record.id;
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
    captured_by_system
  ) values (
    input_payment_system,
    input_external_payment_id,
    'supplier_payment_confirmation',
    input_payment_artifact_sha256,
    input_payment_parser_version,
    input_amount_minor,
    input_currency,
    input_paid_on,
    input_system_actor
  )
  on conflict do nothing
  returning id into evidence_id;

  if evidence_id is null then
    select * into existing_evidence
    from public.ops_finance_payment_evidence evidence
    where evidence.payment_system = input_payment_system
      and evidence.external_payment_id = input_external_payment_id;

    if existing_evidence.id is null then
      if exists (
        select 1
        from public.ops_finance_payment_evidence evidence
        where evidence.artifact_sha256 = input_payment_artifact_sha256
      ) then
        raise exception 'Conflicting duplicate system payment hash';
      end if;
      raise exception 'Conflicting system payment evidence';
    end if;

    select * into existing_event
    from public.ops_finance_payment_events event
    where event.payment_evidence_id = existing_evidence.id;
    if existing_event.event_sequence is null
      or existing_evidence.evidence_kind is distinct from 'supplier_payment_confirmation'
      or existing_evidence.artifact_sha256 is distinct from input_payment_artifact_sha256
      or existing_evidence.parser_version is distinct from input_payment_parser_version
      or existing_evidence.amount_minor is distinct from input_amount_minor
      or existing_evidence.currency is distinct from input_currency
      or existing_evidence.effective_on is distinct from input_paid_on
      or existing_event.journal_id is distinct from journal_record.id
      or existing_event.effective_payment_state is distinct from 'paid'
      or existing_event.amount_minor is distinct from input_amount_minor
      or existing_event.currency is distinct from input_currency then
      raise exception 'Conflicting duplicate system payment evidence';
    end if;
    return journal_record.id;
  end if;

  insert into public.ops_finance_payment_events (
    journal_id,
    payment_evidence_id,
    effective_payment_state,
    amount_minor,
    currency,
    recorded_by_system
  ) values (
    journal_record.id,
    evidence_id,
    'paid',
    input_amount_minor,
    input_currency,
    input_system_actor
  );

  return journal_record.id;
end;
$$;

revoke all on function public.ingest_verified_ops_supplier_receipt(
  text, text, text, text, text, bigint, char(3), date, date, text, text,
  text, text, text, text, date
) from public, anon, authenticated;
grant execute on function public.ingest_verified_ops_supplier_receipt(
  text, text, text, text, text, bigint, char(3), date, date, text, text,
  text, text, text, text, date
) to service_role;

commit;
