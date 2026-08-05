begin;

-- Household membership is security- and consent-sensitive. Clients can read only
-- active memberships they share, while every state change is performed by one of
-- the AAL2-gated RPCs below. Removed rows remain as tombstones so an old device or
-- backup cannot silently recreate access.

alter table public.household_members
  add column revision bigint not null default 1 check (revision > 0),
  add column removed_at timestamptz,
  add column removed_by uuid references auth.users(id) on delete set null,
  add column updated_at timestamptz not null default now(),
  add constraint household_members_removal_shape check (
    (removed_at is null and removed_by is null)
    or removed_at is not null
  );

create index household_members_active_user_idx
  on public.household_members (user_id, household_id)
  where removed_at is null;

create unique index household_members_one_active_owner_idx
  on public.household_members (household_id)
  where role = 'owner' and removed_at is null;

create table public.household_membership_state (
  household_id uuid primary key references public.households(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.household_membership_state enable row level security;

insert into public.household_membership_state (household_id)
select household.id
from public.households household
on conflict (household_id) do nothing;

create or replace function private.create_household_membership_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.household_membership_state (household_id)
  values (new.id)
  on conflict (household_id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_household_membership_state() from public, anon, authenticated;

create trigger households_create_membership_state
after insert on public.households
for each row execute function private.create_household_membership_state();

create table public.account_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('free', 'plus', 'family')),
  state text not null check (state in ('free', 'trialing', 'active', 'grace', 'expired', 'revoked')),
  source text not null check (source in ('system', 'trial', 'apple', 'google', 'stripe')),
  verified_at timestamptz,
  valid_until timestamptz,
  updated_at timestamptz not null default now(),
  check (valid_until is null or verified_at is null or valid_until > verified_at),
  check (state <> 'trialing' or (plan = 'plus' and source = 'trial'))
);

alter table public.account_entitlements enable row level security;

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '7 days'),
  check (not (accepted_at is not null and revoked_at is not null)),
  check ((accepted_at is null) = (accepted_by is null)),
  check ((revoked_at is null) = (revoked_by is null))
);

create index household_invitations_pending_idx
  on public.household_invitations (household_id, expires_at)
  where accepted_at is null and revoked_at is null;

alter table public.household_invitations enable row level security;

revoke all on table public.household_membership_state,
  public.account_entitlements,
  public.household_invitations
from public, anon, authenticated;

-- Fail closed: only a current, server-verified Family entitlement permits more
-- than one active household member. Missing, trial, Free, Plus, expired, revoked
-- or malformed state always resolves to one member.
create or replace function private.effective_household_member_limit(target_owner uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when entitlement.plan = 'family'
      and entitlement.state in ('active', 'grace')
      and entitlement.source in ('apple', 'google', 'stripe', 'system')
      and entitlement.verified_at is not null
      and entitlement.verified_at <= now()
      and entitlement.valid_until is not null
      and entitlement.valid_until > now()
    then 5
    else 1
  end
  from (select 1) seed
  left join public.account_entitlements entitlement
    on entitlement.user_id = target_owner;
$$;

revoke all on function private.effective_household_member_limit(uuid) from public, anon, authenticated;

create or replace function private.active_household_owner(target_household uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.user_id
  from public.household_members member
  where member.household_id = target_household
    and member.role = 'owner'
    and member.removed_at is null;
$$;

revoke all on function private.active_household_owner(uuid) from public, anon, authenticated;

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_aal2() and exists (
    select 1
    from public.household_members member
    where member.household_id = target_household
      and member.user_id = auth.uid()
      and member.removed_at is null
  );
$$;

create or replace function public.is_household_owner(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_aal2() and exists (
    select 1
    from public.household_members member
    where member.household_id = target_household
      and member.user_id = auth.uid()
      and member.role = 'owner'
      and member.removed_at is null
  );
$$;

revoke all on function public.is_household_member(uuid) from public, anon;
revoke all on function public.is_household_owner(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;

drop policy if exists members_owner_write on public.household_members;
drop policy if exists members_read on public.household_members;
create policy members_read_active
on public.household_members
for select to authenticated
using (
  removed_at is null
  and (select public.is_household_member(household_id))
);

revoke insert, update, delete on table public.household_members from authenticated;
grant select on table public.household_members to authenticated;

create or replace function private.assert_household_owner(target_household uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'FOODOS_AAL2_REQUIRED';
  end if;
  if not public.is_household_owner(target_household) then
    raise exception using errcode = '42501', message = 'FOODOS_HOUSEHOLD_OWNER_REQUIRED';
  end if;
end;
$$;

revoke all on function private.assert_household_owner(uuid) from public, anon, authenticated;

create or replace function private.assert_membership_revision(
  target_household uuid,
  expected_revision bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
begin
  if expected_revision is null or expected_revision < 1 then
    raise exception using errcode = '22023', message = 'FOODOS_MEMBERSHIP_REVISION_REQUIRED';
  end if;
  select state.revision into current_revision
  from public.household_membership_state state
  where state.household_id = target_household
  for update;
  if current_revision is null then
    raise exception using errcode = '42501', message = 'FOODOS_HOUSEHOLD_ACCESS_DENIED';
  end if;
  if current_revision <> expected_revision then
    raise exception using errcode = '40001', message = 'FOODOS_MEMBERSHIP_REVISION_CONFLICT';
  end if;
end;
$$;

revoke all on function private.assert_membership_revision(uuid, bigint) from public, anon, authenticated;

create or replace function private.advance_membership_revision(target_household uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision bigint;
begin
  update public.household_membership_state
  set revision = revision + 1,
      updated_at = now()
  where household_id = target_household
  returning revision into next_revision;
  if next_revision is null then
    raise exception using errcode = '42501', message = 'FOODOS_HOUSEHOLD_ACCESS_DENIED';
  end if;
  return next_revision;
end;
$$;

revoke all on function private.advance_membership_revision(uuid) from public, anon, authenticated;

create or replace function private.enforce_single_active_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household uuid;
  owner_count integer;
begin
  target_household := coalesce(new.household_id, old.household_id);
  if exists (select 1 from public.households household where household.id = target_household) then
    select count(*)::integer into owner_count
    from public.household_members member
    where member.household_id = target_household
      and member.role = 'owner'
      and member.removed_at is null;
    if owner_count <> 1 then
      raise exception using errcode = '23514', message = 'FOODOS_LAST_OWNER_REQUIRED';
    end if;
  end if;
  if tg_op = 'UPDATE'
    and old.household_id is distinct from new.household_id
    and exists (select 1 from public.households household where household.id = old.household_id)
  then
    select count(*)::integer into owner_count
    from public.household_members member
    where member.household_id = old.household_id
      and member.role = 'owner'
      and member.removed_at is null;
    if owner_count <> 1 then
      raise exception using errcode = '23514', message = 'FOODOS_LAST_OWNER_REQUIRED';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_single_active_owner() from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
    from public.households household
    where (
      select count(*)
      from public.household_members member
      where member.household_id = household.id
        and member.role = 'owner'
        and member.removed_at is null
    ) <> 1
  ) then
    raise exception using errcode = '23514', message = 'FOODOS_LAST_OWNER_REQUIRED';
  end if;
end;
$$;

create constraint trigger household_members_require_single_owner
after insert or update or delete on public.household_members
deferrable initially deferred
for each row execute function private.enforce_single_active_owner();

create or replace function public.get_my_households()
returns table (
  household_id uuid,
  household_name text,
  member_role public.household_role,
  membership_revision bigint,
  member_count integer,
  member_limit integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'FOODOS_AAL2_REQUIRED';
  end if;
  return query
  select household.id,
    household.name,
    membership.role,
    state.revision,
    (
      select count(*)::integer
      from public.household_members counted_member
      where counted_member.household_id = household.id
        and counted_member.removed_at is null
    ),
    private.effective_household_member_limit(private.active_household_owner(household.id))
  from public.household_members membership
  join public.households household on household.id = membership.household_id
  join public.household_membership_state state on state.household_id = household.id
  where membership.user_id = auth.uid()
    and membership.removed_at is null
  order by household.created_at, household.id;
end;
$$;

create or replace function public.get_household_members(target_household uuid)
returns table (
  user_id uuid,
  member_role public.household_role,
  display_name text,
  joined_at timestamptz,
  membership_revision bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'FOODOS_AAL2_REQUIRED';
  end if;
  if not public.is_household_member(target_household) then
    raise exception using errcode = '42501', message = 'FOODOS_HOUSEHOLD_ACCESS_DENIED';
  end if;
  return query
  select member.user_id,
    member.role,
    profile.display_name,
    member.joined_at,
    member.revision
  from public.household_members member
  left join public.profiles profile on profile.user_id = member.user_id
  where member.household_id = target_household
    and member.removed_at is null
  order by case when member.role = 'owner' then 0 else 1 end, member.joined_at, member.user_id;
end;
$$;

create or replace function public.list_household_invitations(target_household uuid)
returns table (
  invitation_id uuid,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_household_owner(target_household);
  return query
  select invitation.id, invitation.created_at, invitation.expires_at
  from public.household_invitations invitation
  where invitation.household_id = target_household
    and invitation.accepted_at is null
    and invitation.revoked_at is null
    and invitation.expires_at > now()
  order by invitation.created_at desc;
end;
$$;

create or replace function public.create_household_invitation(
  target_household uuid,
  expected_revision bigint,
  ttl_minutes integer default 1440
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  owner_id uuid;
  active_count integer;
  pending_count integer;
  allowed_count integer;
  raw_token text;
  invitation_id uuid;
  invitation_expires_at timestamptz;
  next_revision bigint;
begin
  perform private.assert_household_owner(target_household);
  perform private.assert_membership_revision(target_household, expected_revision);
  if ttl_minutes is null or ttl_minutes not between 10 and 10080 then
    raise exception using errcode = '22023', message = 'FOODOS_INVITATION_TTL_INVALID';
  end if;

  owner_id := private.active_household_owner(target_household);
  allowed_count := private.effective_household_member_limit(owner_id);
  select count(*)::integer into active_count
  from public.household_members member
  where member.household_id = target_household and member.removed_at is null;
  select count(*)::integer into pending_count
  from public.household_invitations invitation
  where invitation.household_id = target_household
    and invitation.accepted_at is null
    and invitation.revoked_at is null
    and invitation.expires_at > now();
  if active_count + pending_count >= allowed_count then
    raise exception using errcode = '23514', message = 'FOODOS_HOUSEHOLD_MEMBER_LIMIT';
  end if;

  raw_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  invitation_expires_at := now() + make_interval(mins => ttl_minutes);
  insert into public.household_invitations (
    household_id, token_hash, created_by, expires_at
  ) values (
    target_household,
    extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256'),
    actor_id,
    invitation_expires_at
  ) returning id into invitation_id;
  next_revision := private.advance_membership_revision(target_household);

  return jsonb_build_object(
    'invitation_id', invitation_id,
    'invite_token', raw_token,
    'expires_at', invitation_expires_at,
    'membership_revision', next_revision
  );
end;
$$;

create or replace function public.accept_household_invitation(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  invitation_household_id uuid;
  invitation public.household_invitations%rowtype;
  owner_id uuid;
  active_count integer;
  allowed_count integer;
  household_name text;
  member_revision bigint;
  next_revision bigint;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'FOODOS_AAL2_REQUIRED';
  end if;
  if invite_token is null or invite_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception using errcode = '22023', message = 'FOODOS_INVITATION_INVALID';
  end if;

  -- Resolve only the owning household first, then serialize on its membership
  -- state before locking the invitation. Create/revoke/transfer use the same
  -- state -> invitation order, avoiding an invitation/state deadlock cycle.
  select candidate.household_id into invitation_household_id
  from public.household_invitations candidate
  where candidate.token_hash = extensions.digest(convert_to(invite_token, 'UTF8'), 'sha256');
  if not found then
    raise exception using errcode = '22023', message = 'FOODOS_INVITATION_INVALID';
  end if;
  perform 1
  from public.household_membership_state state
  where state.household_id = invitation_household_id
  for update;

  select candidate.* into invitation
  from public.household_invitations candidate
  where candidate.token_hash = extensions.digest(convert_to(invite_token, 'UTF8'), 'sha256')
    and candidate.household_id = invitation_household_id
  for update;
  if not found
    or invitation.accepted_at is not null
    or invitation.revoked_at is not null
    or invitation.expires_at <= now()
  then
    raise exception using errcode = '22023', message = 'FOODOS_INVITATION_INVALID';
  end if;

  owner_id := private.active_household_owner(invitation.household_id);
  allowed_count := private.effective_household_member_limit(owner_id);
  select count(*)::integer into active_count
  from public.household_members member
  where member.household_id = invitation.household_id and member.removed_at is null;
  if active_count >= allowed_count then
    raise exception using errcode = '23514', message = 'FOODOS_HOUSEHOLD_MEMBER_LIMIT';
  end if;
  if exists (
    select 1 from public.household_members member
    where member.household_id = invitation.household_id
      and member.user_id = actor_id
      and member.removed_at is null
  ) then
    raise exception using errcode = '23505', message = 'FOODOS_MEMBERSHIP_ALREADY_ACTIVE';
  end if;

  insert into public.household_members (
    household_id, user_id, role, joined_at, revision, removed_at, removed_by, updated_at
  ) values (
    invitation.household_id, actor_id, 'member', now(), 1, null, null, now()
  )
  on conflict (household_id, user_id) do update set
    role = 'member',
    joined_at = now(),
    revision = public.household_members.revision + 1,
    removed_at = null,
    removed_by = null,
    updated_at = now()
  returning revision into member_revision;

  update public.household_invitations
  set accepted_by = actor_id, accepted_at = now()
  where id = invitation.id;
  next_revision := private.advance_membership_revision(invitation.household_id);
  select household.name into household_name
  from public.households household
  where household.id = invitation.household_id;

  return jsonb_build_object(
    'household_id', invitation.household_id,
    'household_name', household_name,
    'member_role', 'member',
    'member_revision', member_revision,
    'membership_revision', next_revision
  );
end;
$$;

create or replace function public.revoke_household_invitation(
  target_household uuid,
  target_invitation uuid,
  expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision bigint;
begin
  perform private.assert_household_owner(target_household);
  perform private.assert_membership_revision(target_household, expected_revision);
  update public.household_invitations
  set revoked_by = auth.uid(), revoked_at = now()
  where id = target_invitation
    and household_id = target_household
    and accepted_at is null
    and revoked_at is null
    and expires_at > now();
  if not found then
    raise exception using errcode = '22023', message = 'FOODOS_INVITATION_INVALID';
  end if;
  next_revision := private.advance_membership_revision(target_household);
  return jsonb_build_object('membership_revision', next_revision);
end;
$$;

create or replace function public.remove_household_member(
  target_household uuid,
  target_user uuid,
  expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision bigint;
begin
  perform private.assert_household_owner(target_household);
  perform private.assert_membership_revision(target_household, expected_revision);
  if target_user = auth.uid() then
    raise exception using errcode = '23514', message = 'FOODOS_LAST_OWNER_REQUIRED';
  end if;
  update public.household_members
  set removed_at = now(),
      removed_by = auth.uid(),
      updated_at = now(),
      revision = revision + 1
  where household_id = target_household
    and user_id = target_user
    and role = 'member'
    and removed_at is null;
  if not found then
    raise exception using errcode = '22023', message = 'FOODOS_MEMBERSHIP_NOT_ACTIVE';
  end if;
  next_revision := private.advance_membership_revision(target_household);
  return jsonb_build_object('membership_revision', next_revision, 'removed_user_id', target_user);
end;
$$;

create or replace function public.leave_household(
  target_household uuid,
  expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  next_revision bigint;
begin
  if actor_id is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'FOODOS_AAL2_REQUIRED';
  end if;
  if not public.is_household_member(target_household) then
    raise exception using errcode = '42501', message = 'FOODOS_HOUSEHOLD_ACCESS_DENIED';
  end if;
  perform private.assert_membership_revision(target_household, expected_revision);
  update public.household_members
  set removed_at = now(),
      removed_by = actor_id,
      updated_at = now(),
      revision = revision + 1
  where household_id = target_household
    and user_id = actor_id
    and role = 'member'
    and removed_at is null;
  if not found then
    raise exception using errcode = '23514', message = 'FOODOS_LAST_OWNER_REQUIRED';
  end if;
  next_revision := private.advance_membership_revision(target_household);
  return jsonb_build_object('membership_revision', next_revision, 'left_household_id', target_household);
end;
$$;

create or replace function public.transfer_household_ownership(
  target_household uuid,
  target_user uuid,
  expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  active_count integer;
  target_limit integer;
  next_revision bigint;
begin
  perform private.assert_household_owner(target_household);
  perform private.assert_membership_revision(target_household, expected_revision);
  if target_user = actor_id then
    raise exception using errcode = '22023', message = 'FOODOS_OWNER_TRANSFER_TARGET_INVALID';
  end if;
  if not exists (
    select 1 from public.household_members member
    where member.household_id = target_household
      and member.user_id = target_user
      and member.role = 'member'
      and member.removed_at is null
  ) then
    raise exception using errcode = '22023', message = 'FOODOS_MEMBERSHIP_NOT_ACTIVE';
  end if;
  select count(*)::integer into active_count
  from public.household_members member
  where member.household_id = target_household and member.removed_at is null;
  target_limit := private.effective_household_member_limit(target_user);
  if active_count > target_limit then
    raise exception using errcode = '23514', message = 'FOODOS_NEW_OWNER_MEMBER_LIMIT';
  end if;

  update public.household_members
  set role = 'member', updated_at = now(), revision = revision + 1
  where household_id = target_household and user_id = actor_id and removed_at is null;
  update public.household_members
  set role = 'owner', updated_at = now(), revision = revision + 1
  where household_id = target_household and user_id = target_user and removed_at is null;
  update public.household_invitations
  set revoked_by = actor_id, revoked_at = now()
  where household_id = target_household
    and accepted_at is null
    and revoked_at is null;
  next_revision := private.advance_membership_revision(target_household);
  return jsonb_build_object(
    'membership_revision', next_revision,
    'owner_user_id', target_user
  );
end;
$$;

revoke all on function public.get_my_households() from public, anon;
revoke all on function public.get_household_members(uuid) from public, anon;
revoke all on function public.list_household_invitations(uuid) from public, anon;
revoke all on function public.create_household_invitation(uuid, bigint, integer) from public, anon;
revoke all on function public.accept_household_invitation(text) from public, anon;
revoke all on function public.revoke_household_invitation(uuid, uuid, bigint) from public, anon;
revoke all on function public.remove_household_member(uuid, uuid, bigint) from public, anon;
revoke all on function public.leave_household(uuid, bigint) from public, anon;
revoke all on function public.transfer_household_ownership(uuid, uuid, bigint) from public, anon;

grant execute on function public.get_my_households() to authenticated;
grant execute on function public.get_household_members(uuid) to authenticated;
grant execute on function public.list_household_invitations(uuid) to authenticated;
grant execute on function public.create_household_invitation(uuid, bigint, integer) to authenticated;
grant execute on function public.accept_household_invitation(text) to authenticated;
grant execute on function public.revoke_household_invitation(uuid, uuid, bigint) to authenticated;
grant execute on function public.remove_household_member(uuid, uuid, bigint) to authenticated;
grant execute on function public.leave_household(uuid, bigint) to authenticated;
grant execute on function public.transfer_household_ownership(uuid, uuid, bigint) to authenticated;

commit;
