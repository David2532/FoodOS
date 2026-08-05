begin;

create table public.privacy_choice_events (
  id uuid primary key default gen_random_uuid(),
  event_sequence bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_mutation_id uuid not null,
  notice_version text not null check (notice_version = '2026-08-04.de-1'),
  market char(2) not null default 'DE' check (market = 'DE'),
  locale text not null default 'de-DE' check (locale = 'de-DE'),
  age_confirmed boolean not null check (age_confirmed),
  terms_accepted boolean not null check (terms_accepted),
  sensitive_profile boolean not null default false,
  analytics boolean not null default false,
  marketing boolean not null default false,
  image_cloud_processing boolean not null default false,
  off_contribution boolean not null default false,
  advertising boolean not null default false,
  recorded_at timestamptz not null default now(),
  unique (user_id, client_mutation_id)
);

create index privacy_choice_events_latest_idx
  on public.privacy_choice_events (user_id, event_sequence desc);

alter table public.privacy_choice_events enable row level security;

create policy require_aal2 on public.privacy_choice_events as restrictive
  for all to authenticated
  using (public.has_aal2())
  with check (public.has_aal2());

create policy privacy_choice_events_own_read on public.privacy_choice_events
  for select to authenticated
  using (user_id = auth.uid());

create policy privacy_choice_events_own_insert on public.privacy_choice_events
  for insert to authenticated
  with check (user_id = auth.uid());

revoke all on table public.privacy_choice_events from anon, authenticated;
grant select, insert on table public.privacy_choice_events to authenticated;

create or replace function public.record_privacy_choices(
  p_notice_version text,
  p_age_confirmed boolean,
  p_terms_accepted boolean,
  p_sensitive_profile boolean,
  p_analytics boolean,
  p_marketing boolean,
  p_image_cloud_processing boolean,
  p_off_contribution boolean,
  p_advertising boolean,
  p_client_mutation_id uuid
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  existing public.privacy_choice_events%rowtype;
  created_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not public.has_aal2() then
    raise exception 'AAL2 required' using errcode = '42501';
  end if;
  if p_notice_version is distinct from '2026-08-04.de-1' then
    raise exception 'Privacy notice version is not current' using errcode = '22023';
  end if;
  if p_age_confirmed is distinct from true then
    raise exception 'Minimum age confirmation required' using errcode = '22023';
  end if;
  if p_terms_accepted is distinct from true then
    raise exception 'Notice acknowledgement required' using errcode = '22023';
  end if;
  if p_sensitive_profile is null or p_analytics is null or p_marketing is null
    or p_image_cloud_processing is null or p_off_contribution is null or p_advertising is null then
    raise exception 'Every optional purpose requires an explicit choice' using errcode = '22023';
  end if;
  if p_client_mutation_id is null then
    raise exception 'Client mutation ID required' using errcode = '22023';
  end if;

  select * into existing
  from public.privacy_choice_events
  where user_id = actor_id and client_mutation_id = p_client_mutation_id;

  if found then
    if existing.notice_version is not distinct from p_notice_version
      and existing.age_confirmed is not distinct from p_age_confirmed
      and existing.terms_accepted is not distinct from p_terms_accepted
      and existing.sensitive_profile is not distinct from p_sensitive_profile
      and existing.analytics is not distinct from p_analytics
      and existing.marketing is not distinct from p_marketing
      and existing.image_cloud_processing is not distinct from p_image_cloud_processing
      and existing.off_contribution is not distinct from p_off_contribution
      and existing.advertising is not distinct from p_advertising then
      return existing.id;
    end if;
    raise exception 'Privacy mutation ID payload conflict' using errcode = '23505';
  end if;

  insert into public.privacy_choice_events (
    user_id, client_mutation_id, notice_version, age_confirmed, terms_accepted,
    sensitive_profile, analytics, marketing, image_cloud_processing, off_contribution, advertising
  ) values (
    actor_id, p_client_mutation_id, p_notice_version, p_age_confirmed, p_terms_accepted,
    p_sensitive_profile, p_analytics, p_marketing, p_image_cloud_processing, p_off_contribution, p_advertising
  ) returning id into created_id;

  return created_id;
end;
$$;

revoke all on function public.record_privacy_choices(text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, uuid) from public;
grant execute on function public.record_privacy_choices(text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, uuid) to authenticated;

commit;
