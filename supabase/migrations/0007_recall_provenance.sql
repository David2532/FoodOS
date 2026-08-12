begin;

create table public.recall_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  display_name text not null,
  authority_url text not null,
  approved boolean not null default false,
  license_reviewed_at timestamptz,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recall_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.recall_sources(id) on delete restrict,
  source_record_id text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  parser_version text not null,
  status text not null check (status in ('active', 'corrected', 'withdrawn')),
  title text not null,
  product_name text not null,
  brand text,
  gtins text[] not null default '{}',
  lot_numbers text[] not null default '{}',
  reason text,
  source_url text not null,
  published_at timestamptz not null,
  source_updated_at timestamptz,
  retrieved_at timestamptz not null,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (source_id, source_record_id, payload_sha256)
);

create table public.recall_acknowledgements (
  household_id uuid not null references public.households(id) on delete cascade,
  batch_id uuid not null references public.inventory_batches(id) on delete cascade,
  recall_event_id uuid not null references public.recall_events(id) on delete restrict,
  acknowledged_by uuid not null references auth.users(id) on delete restrict,
  acknowledged_at timestamptz not null default now(),
  primary key (batch_id, recall_event_id)
);

create index recall_events_gtins_idx on public.recall_events using gin (gtins);
create index recall_events_lots_idx on public.recall_events using gin (lot_numbers);
create index recall_events_freshness_idx on public.recall_events (retrieved_at desc);

create trigger recall_sources_updated before update on public.recall_sources
  for each row execute function public.set_updated_at();

alter table public.recall_sources enable row level security;
alter table public.recall_events enable row level security;
alter table public.recall_acknowledgements enable row level security;

create policy require_aal2 on public.recall_sources as restrictive
  for all to authenticated using (public.has_aal2()) with check (public.has_aal2());
create policy require_aal2 on public.recall_events as restrictive
  for all to authenticated using (public.has_aal2()) with check (public.has_aal2());
create policy require_aal2 on public.recall_acknowledgements as restrictive
  for all to authenticated using (public.has_aal2()) with check (public.has_aal2());

create policy recall_sources_read on public.recall_sources
  for select to authenticated using (true);
create policy recall_events_read on public.recall_events
  for select to authenticated using (true);
create policy recall_ack_household on public.recall_acknowledgements
  for select to authenticated using (public.is_household_member(household_id));

grant select on public.recall_sources, public.recall_events to authenticated;
grant select on public.recall_acknowledgements to authenticated;
revoke all on public.recall_sources, public.recall_events, public.recall_acknowledgements from anon;

commit;
