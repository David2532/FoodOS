begin;

-- Trust changes are append-only. A manual metadata hash is not an authoritative
-- invoice artifact, so historical metadata-only rows need an effective trust
-- correction rather than an in-place journal rewrite.
create table public.ops_finance_source_validation_events (
  event_sequence bigint generated always as identity primary key,
  source_document_id uuid not null references public.ops_finance_source_documents(id) on delete restrict,
  effective_trust_state public.ops_finance_trust_state not null,
  validation_reason text not null check (
    validation_reason in ('metadata_only_reclassification', 'authoritative_artifact_validated')
  ),
  authoritative_artifact_sha256 text,
  parser_version text,
  recorded_by uuid references auth.users(id) on delete restrict,
  recorded_by_system text,
  recorded_at timestamptz not null default now(),
  check ((recorded_by is null) <> (recorded_by_system is null)),
  check (recorded_by_system is null or char_length(recorded_by_system) between 2 and 120),
  check (
    (
      effective_trust_state = 'source_final'
      and validation_reason = 'authoritative_artifact_validated'
      and authoritative_artifact_sha256 is not null
      and authoritative_artifact_sha256 ~ '^[0-9a-f]{64}$'
      and parser_version is not null
      and char_length(parser_version) between 2 and 80
    )
    or (
      effective_trust_state in ('estimate', 'no_source')
      and validation_reason = 'metadata_only_reclassification'
      and authoritative_artifact_sha256 is null
      and parser_version is null
    )
  )
);

create index ops_finance_source_validation_latest_idx
  on public.ops_finance_source_validation_events (source_document_id, event_sequence desc);
create unique index ops_finance_source_validation_metadata_once_idx
  on public.ops_finance_source_validation_events (source_document_id)
  where validation_reason = 'metadata_only_reclassification';

create trigger ops_finance_source_validation_immutable
before update or delete on public.ops_finance_source_validation_events
for each row execute function public.reject_ops_finance_mutation();

alter table public.ops_finance_source_validation_events enable row level security;

create policy ops_source_validation_require_aal2 on public.ops_finance_source_validation_events
as restrictive for select to authenticated
using ((select public.has_aal2()));

create policy ops_source_validation_read_ceo on public.ops_finance_source_validation_events
for select to authenticated
using ((select private.has_ops_role('ceo')));

revoke all on table public.ops_finance_source_validation_events from public, anon, authenticated;
grant select on table public.ops_finance_source_validation_events to authenticated;

-- Preserve the original immutable journal and append the corrected effective trust.
-- Every source created by the first invoice RPC is metadata-only by construction.
insert into public.ops_finance_source_validation_events (
  source_document_id,
  effective_trust_state,
  validation_reason,
  recorded_by_system
)
select
  source.id,
  'estimate',
  'metadata_only_reclassification',
  'migration:20260805165055'
from public.ops_finance_source_documents source
join public.ops_finance_journals journal on journal.source_document_id = source.id
where source.evidence_kind = 'invoice_metadata'
  and journal.trust_state = 'source_final'
on conflict (source_document_id) where validation_reason = 'metadata_only_reclassification'
do nothing;

create or replace function public.assert_ops_source_final_authoritative()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  latest_validation public.ops_finance_source_validation_events%rowtype;
begin
  if new.trust_state <> 'source_final' then
    return new;
  end if;

  select * into latest_validation
  from public.ops_finance_source_validation_events validation
  where validation.source_document_id = new.source_document_id
  order by validation.event_sequence desc
  limit 1;

  if latest_validation.effective_trust_state is distinct from 'source_final'
    or latest_validation.validation_reason is distinct from 'authoritative_artifact_validated'
    or latest_validation.authoritative_artifact_sha256 is null
    or latest_validation.parser_version is null then
    raise exception 'Authoritative source validation required for SOURCE FINAL';
  end if;

  return new;
end;
$$;

create trigger ops_finance_source_final_requires_evidence
before insert on public.ops_finance_journals
for each row execute function public.assert_ops_source_final_authoritative();

revoke all on function public.assert_ops_source_final_authoritative() from public, anon, authenticated;

commit;
