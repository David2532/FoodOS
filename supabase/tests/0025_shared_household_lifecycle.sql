begin;

create extension if not exists pgtap with schema extensions;

select plan(70);

select has_table('public', 'household_membership_state', 'membership revision state exists');
select has_table('public', 'household_invitations', 'hashed invitation state exists');
select has_table('public', 'account_entitlements', 'server-authoritative entitlement state exists');
select has_column('public', 'household_members', 'revision', 'memberships have individual revisions');
select has_column('public', 'household_members', 'removed_at', 'memberships retain removal tombstones');
select has_column('public', 'household_members', 'removed_by', 'membership tombstones retain the responsible actor');
select ok(has_table_privilege('authenticated', 'public.household_members', 'select'), 'authenticated members can read RLS-filtered active memberships');
select ok(not has_table_privilege('authenticated', 'public.household_members', 'insert'), 'authenticated cannot directly insert memberships');
select ok(not has_table_privilege('authenticated', 'public.household_members', 'update'), 'authenticated cannot directly update memberships');
select ok(not has_table_privilege('authenticated', 'public.household_members', 'delete'), 'authenticated cannot directly delete membership tombstones');
select ok(not has_table_privilege('authenticated', 'public.household_invitations', 'select'), 'authenticated cannot read invitation hashes');
select ok(not has_table_privilege('authenticated', 'public.account_entitlements', 'select'), 'authenticated cannot read or self-assert entitlements');
select ok((
  select relrowsecurity
  from pg_catalog.pg_class
  where oid = 'public.household_membership_state'::regclass
), 'membership revision state has RLS enabled');
select ok(not (
  has_table_privilege('authenticated', 'public.household_membership_state', 'select')
  or has_table_privilege('authenticated', 'public.household_membership_state', 'insert')
  or has_table_privilege('authenticated', 'public.household_membership_state', 'update')
  or has_table_privilege('authenticated', 'public.household_membership_state', 'delete')
  or has_table_privilege('authenticated', 'public.household_membership_state', 'truncate')
  or has_table_privilege('authenticated', 'public.household_membership_state', 'references')
  or has_table_privilege('authenticated', 'public.household_membership_state', 'trigger')
), 'authenticated has no privileges on membership revision state');
select ok(not (
  has_table_privilege('anon', 'public.household_membership_state', 'select')
  or has_table_privilege('anon', 'public.household_membership_state', 'insert')
  or has_table_privilege('anon', 'public.household_membership_state', 'update')
  or has_table_privilege('anon', 'public.household_membership_state', 'delete')
  or has_table_privilege('anon', 'public.household_membership_state', 'truncate')
  or has_table_privilege('anon', 'public.household_membership_state', 'references')
  or has_table_privilege('anon', 'public.household_membership_state', 'trigger')
), 'anonymous has no privileges on membership revision state');
select ok(has_function_privilege('authenticated', 'public.get_my_households()', 'execute'), 'authenticated can request its AAL2 household overview');
select ok(not has_function_privilege('anon', 'public.get_my_households()', 'execute'), 'anonymous cannot request household overview');
select ok(has_function_privilege('authenticated', 'public.create_household_invitation(uuid,bigint,integer)', 'execute'), 'authenticated can call the guarded invite RPC');
select ok(not has_function_privilege('anon', 'public.create_household_invitation(uuid,bigint,integer)', 'execute'), 'anonymous cannot create invitations');
select ok(has_function_privilege('authenticated', 'public.accept_household_invitation(text)', 'execute'), 'authenticated can accept a guarded invitation');
select ok(has_function_privilege('authenticated', 'public.revoke_household_invitation(uuid,uuid,bigint)', 'execute'), 'authenticated owners can revoke invitations through the RPC');
select ok(has_function_privilege('authenticated', 'public.remove_household_member(uuid,uuid,bigint)', 'execute'), 'authenticated owners can remove members through the RPC');
select ok(has_function_privilege('authenticated', 'public.leave_household(uuid,bigint)', 'execute'), 'authenticated members can leave through the RPC');
select ok(has_function_privilege('authenticated', 'public.transfer_household_ownership(uuid,uuid,bigint)', 'execute'), 'authenticated owners can transfer ownership through the RPC');
select ok(to_regclass('public.household_members_one_active_owner_idx') is not null, 'a partial unique index prevents two active owners');
select col_type_is('public', 'household_invitations', 'token_hash', 'bytea', 'only a binary invitation digest is stored');
select ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public'
    and table_name = 'household_invitations'
    and column_name = 'invite_token'
), 'the raw invitation token has no database column');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('d1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'household-owner@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('d1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'household-member@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('d1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'household-outsider@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into auth.sessions (id, user_id, created_at, updated_at, aal, not_after)
values
  ('d1100000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', now(), now(), 'aal2', now() + interval '1 day'),
  ('d1100000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', now(), now(), 'aal2', now() + interval '1 day'),
  ('d1100000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000003', now(), now(), 'aal2', now() + interval '1 day'),
  ('d1100000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000001', now(), now(), 'aal1', now() + interval '1 day'),
  ('d1100000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000001', now(), now(), 'aal2', now() + interval '1 day');

insert into public.profiles (user_id, display_name)
values
  ('d1000000-0000-4000-8000-000000000001', 'Owner'),
  ('d1000000-0000-4000-8000-000000000002', 'Member');

insert into public.households (id, name, created_by)
values ('d1200000-0000-4000-8000-000000000001', 'Gemeinsam', 'd1000000-0000-4000-8000-000000000001');
insert into public.household_members (household_id, user_id, role)
values ('d1200000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'owner');

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"d1100000-0000-4000-8000-000000000004"}',
  true
);
set local role authenticated;
select throws_ok(
  'select public.get_my_households()',
  '42501',
  'FOODOS_AAL2_REQUIRED',
  'a live AAL1 session is rejected explicitly instead of looking like onboarding'
);
select results_eq(
  $$ select public.is_household_member('d1200000-0000-4000-8000-000000000001') $$,
  $$ values (false) $$,
  'AAL1 cannot probe the household-membership bit'
);
select results_eq(
  $$ select public.is_household_owner('d1200000-0000-4000-8000-000000000001') $$,
  $$ values (false) $$,
  'AAL1 cannot probe the household-owner bit'
);

reset role;
delete from auth.sessions where id = 'd1100000-0000-4000-8000-000000000005';
select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000005"}',
  true
);
set local role authenticated;
select throws_ok(
  'select public.get_my_households()',
  '42501',
  'FOODOS_AAL2_REQUIRED',
  'a revoked AAL2 session is rejected explicitly instead of looking like onboarding'
);
select results_eq(
  $$ select public.is_household_member('d1200000-0000-4000-8000-000000000001') $$,
  $$ values (false) $$,
  'a revoked AAL2 session cannot probe the household-membership bit'
);
select results_eq(
  $$ select public.is_household_owner('d1200000-0000-4000-8000-000000000001') $$,
  $$ values (false) $$,
  'a revoked AAL2 session cannot probe the household-owner bit'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000001"}',
  true
);
set local role authenticated;
select results_eq(
  $$ select household_name || '|' || member_role::text || '|' || member_count::text || '|' || member_limit::text from public.get_my_households() $$,
  $$ values ('Gemeinsam|owner|1|1') $$,
  'a live owner sees the deterministic Free household overview'
);
select throws_ok(
  $$ insert into public.household_members (household_id, user_id, role) values ('d1200000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002', 'member') $$,
  '42501',
  'permission denied for table household_members',
  'an owner cannot bypass invitation consent with direct DML'
);
select throws_ok(
  $$ select public.create_household_invitation('d1200000-0000-4000-8000-000000000001', 1, 1440) $$,
  '23514',
  'FOODOS_HOUSEHOLD_MEMBER_LIMIT',
  'missing entitlement fails closed to the one-member Free limit'
);

reset role;
insert into public.account_entitlements (user_id, plan, state, source, verified_at, valid_until)
values ('d1000000-0000-4000-8000-000000000001', 'plus', 'trialing', 'trial', now(), now() + interval '14 days');
set local role authenticated;
select throws_ok(
  $$ select public.create_household_invitation('d1200000-0000-4000-8000-000000000001', 1, 1440) $$,
  '23514',
  'FOODOS_HOUSEHOLD_MEMBER_LIMIT',
  'a Plus trial remains a one-member household entitlement'
);

reset role;
update public.account_entitlements
set plan = 'family', state = 'expired', source = 'system', verified_at = now() - interval '2 days', valid_until = now() - interval '1 day'
where user_id = 'd1000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok(
  $$ select public.create_household_invitation('d1200000-0000-4000-8000-000000000001', 1, 1440) $$,
  '23514',
  'FOODOS_HOUSEHOLD_MEMBER_LIMIT',
  'an expired Family entitlement fails closed'
);

reset role;
update public.account_entitlements
set state = 'active', verified_at = now() - interval '1 minute', valid_until = now() + interval '30 days'
where user_id = 'd1000000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok(
  $$
  do $flow$
  declare
    created jsonb;
    accepted jsonb;
    raw_token text;
  begin
    perform set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000001"}', true);
    created := public.create_household_invitation('d1200000-0000-4000-8000-000000000001', 1, 1440);
    raw_token := created ->> 'invite_token';
    if length(raw_token) <> 43 or created ->> 'membership_revision' <> '2' then
      raise exception 'invalid one-time invitation result';
    end if;
    perform set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000002"}', true);
    accepted := public.accept_household_invitation(raw_token);
    if accepted ->> 'member_role' <> 'member' or accepted ->> 'membership_revision' <> '3' then
      raise exception 'invalid accepted membership result';
    end if;
    begin
      perform public.accept_household_invitation(raw_token);
      raise exception 'used token was accepted twice';
    exception when sqlstate '22023' then
      if sqlerrm <> 'FOODOS_INVITATION_INVALID' then raise; end if;
    end;
  end
  $flow$;
  $$,
  'a Family owner can issue one raw token, a second user accepts it once, and replay is rejected'
);
select results_eq(
  $$ select count(*)::bigint from public.household_members where household_id = 'd1200000-0000-4000-8000-000000000001' and removed_at is null $$,
  $$ values (2::bigint) $$,
  'invitation acceptance creates exactly one active member'
);

reset role;
select results_eq(
  $$ select count(*)::bigint from public.household_invitations where household_id = 'd1200000-0000-4000-8000-000000000001' and accepted_at is not null $$,
  $$ values (1::bigint) $$,
  'the accepted invitation is permanently consumed'
);
select ok(
  (select bool_and(octet_length(token_hash) = 32) from public.household_invitations),
  'every persisted invitation value is a SHA-256-sized digest'
);

set local role authenticated;
select results_eq(
  $$ select household_id::text from public.get_my_households() $$,
  $$ values ('d1200000-0000-4000-8000-000000000001') $$,
  'the accepted member can load the shared household'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000003"}',
  true
);
set local role authenticated;
select throws_ok(
  $$ select public.get_household_members('d1200000-0000-4000-8000-000000000001') $$,
  '42501',
  'FOODOS_HOUSEHOLD_ACCESS_DENIED',
  'an unrelated AAL2 user cannot enumerate household members'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000001"}',
  true
);
set local role authenticated;
select lives_ok(
  $$ select public.remove_household_member('d1200000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002', 3) $$,
  'an owner can remove an active regular member at the displayed revision'
);

reset role;
select results_eq(
  $$ select count(*)::bigint from public.household_members where household_id = 'd1200000-0000-4000-8000-000000000001' and user_id = 'd1000000-0000-4000-8000-000000000002' and removed_at is not null and revision = 2 $$,
  $$ values (1::bigint) $$,
  'removal keeps a revisioned membership tombstone'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000002"}',
  true
);
set local role authenticated;
select results_eq(
  $$ select count(*)::bigint from public.get_my_households() $$,
  $$ values (0::bigint) $$,
  'a live but removed member has no active household overview'
);
select throws_ok(
  $$ select public.get_household_members('d1200000-0000-4000-8000-000000000001') $$,
  '42501',
  'FOODOS_HOUSEHOLD_ACCESS_DENIED',
  'a removed member cannot enumerate the former household'
);

select lives_ok(
  $$
  do $flow$
  declare
    created jsonb;
  begin
    perform set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000001"}', true);
    created := public.create_household_invitation('d1200000-0000-4000-8000-000000000001', 4, 1440);
    perform set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000002"}', true);
    perform public.accept_household_invitation(created ->> 'invite_token');
  end
  $flow$;
  $$,
  'a fresh invitation can explicitly reactivate a tombstoned member'
);
select results_eq(
  $$ select revision from public.household_members where household_id = 'd1200000-0000-4000-8000-000000000001' and user_id = 'd1000000-0000-4000-8000-000000000002' and removed_at is null $$,
  $$ values (3::bigint) $$,
  'reactivation increments rather than replaces the membership revision'
);
select lives_ok(
  $$ select public.leave_household('d1200000-0000-4000-8000-000000000001', 6) $$,
  'a regular member can leave at the current revision'
);

reset role;
select results_eq(
  $$ select revision from public.household_members where household_id = 'd1200000-0000-4000-8000-000000000001' and user_id = 'd1000000-0000-4000-8000-000000000002' and removed_at is not null $$,
  $$ values (4::bigint) $$,
  'leaving advances the retained tombstone revision'
);

set local role authenticated;
select lives_ok(
  $$
  do $flow$
  declare
    created jsonb;
  begin
    perform set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000001"}', true);
    created := public.create_household_invitation('d1200000-0000-4000-8000-000000000001', 7, 1440);
    perform set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000002"}', true);
    perform public.accept_household_invitation(created ->> 'invite_token');
  end
  $flow$;
  $$,
  'a member can rejoin only through another fresh one-time invitation'
);
select results_eq(
  $$ select count(*)::bigint from public.household_members where household_id = 'd1200000-0000-4000-8000-000000000001' and user_id = 'd1000000-0000-4000-8000-000000000002' and removed_at is null $$,
  $$ values (1::bigint) $$,
  'the rejoined member is active exactly once'
);

reset role;
insert into public.account_entitlements (user_id, plan, state, source, verified_at, valid_until)
values ('d1000000-0000-4000-8000-000000000002', 'family', 'active', 'system', now() - interval '1 minute', now() + interval '30 days');
set local role authenticated;
select lives_ok(
  $$
  do $flow$
  begin
    perform set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000001"}', true);
    perform public.create_household_invitation('d1200000-0000-4000-8000-000000000001', 9, 1440);
  end
  $flow$;
  $$,
  'the current owner can create a pending invitation before transfer'
);
select lives_ok(
  $$ select public.transfer_household_ownership('d1200000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002', 10) $$,
  'ownership transfers atomically to an active Family-capable member'
);
select results_eq(
  $$ select user_id::text from public.household_members where household_id = 'd1200000-0000-4000-8000-000000000001' and role = 'owner' and removed_at is null $$,
  $$ values ('d1000000-0000-4000-8000-000000000002') $$,
  'the target member becomes the sole active owner'
);
select results_eq(
  $$ select role::text from public.household_members where household_id = 'd1200000-0000-4000-8000-000000000001' and user_id = 'd1000000-0000-4000-8000-000000000001' and removed_at is null $$,
  $$ values ('member') $$,
  'the previous owner remains a regular member after transfer'
);

reset role;
select results_eq(
  $$ select count(*)::bigint from public.household_invitations where household_id = 'd1200000-0000-4000-8000-000000000001' and accepted_at is null and revoked_at is null $$,
  $$ values (0::bigint) $$,
  'ownership transfer revokes all pending invitations from the previous authority'
);

set local role authenticated;
select throws_ok(
  $$ select public.create_household_invitation('d1200000-0000-4000-8000-000000000001', 11, 1440) $$,
  '42501',
  'FOODOS_HOUSEHOLD_OWNER_REQUIRED',
  'the previous owner immediately loses membership-management authority'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000002"}',
  true
);
select lives_ok(
  $$ select public.remove_household_member('d1200000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 11) $$,
  'the new owner can remove the previous owner as a regular member'
);

reset role;
select results_eq(
  $$ select count(*)::bigint from public.household_members where household_id = 'd1200000-0000-4000-8000-000000000001' and user_id = 'd1000000-0000-4000-8000-000000000001' and removed_at is not null $$,
  $$ values (1::bigint) $$,
  'the removed previous owner remains a tombstone'
);

set local role authenticated;
select throws_ok(
  $$ select public.leave_household('d1200000-0000-4000-8000-000000000001', 12) $$,
  '23514',
  'FOODOS_LAST_OWNER_REQUIRED',
  'the last owner cannot leave without transferring ownership'
);

select lives_ok(
  $$
  do $flow$
  declare
    created jsonb;
    revoked jsonb;
  begin
    created := public.create_household_invitation('d1200000-0000-4000-8000-000000000001', 12, 1440);
    revoked := public.revoke_household_invitation(
      'd1200000-0000-4000-8000-000000000001',
      (created ->> 'invitation_id')::uuid,
      (created ->> 'membership_revision')::bigint
    );
    perform set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000003"}', true);
    begin
      perform public.accept_household_invitation(created ->> 'invite_token');
      raise exception 'revoked token was accepted';
    exception when sqlstate '22023' then
      if sqlerrm <> 'FOODOS_INVITATION_INVALID' then raise; end if;
    end;
    if revoked ->> 'membership_revision' <> '14' then
      raise exception 'revocation did not advance revision';
    end if;
  end
  $flow$;
  $$,
  'revocation consumes authority before a third user can accept the invitation'
);

reset role;
select results_eq(
  $$ select count(*)::bigint from public.household_invitations where household_id = 'd1200000-0000-4000-8000-000000000001' and accepted_at is null and revoked_at is null and expires_at > now() $$,
  $$ values (0::bigint) $$,
  'no pending invitation remains after explicit revocation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000002"}',
  true
);
set local role authenticated;
select throws_ok(
  $$ select public.create_household_invitation('d1200000-0000-4000-8000-000000000001', 12, 1440) $$,
  '40001',
  'FOODOS_MEMBERSHIP_REVISION_CONFLICT',
  'a stale client revision cannot create a new invitation'
);
select results_eq(
  $$ select count(*)::bigint from public.household_members where household_id = 'd1200000-0000-4000-8000-000000000001' and role = 'owner' and removed_at is null $$,
  $$ values (1::bigint) $$,
  'the lifecycle always retains exactly one active owner'
);
select results_eq(
  $$ select membership_revision::text || '|' || member_count::text || '|' || member_limit::text from public.get_my_households() $$,
  $$ values ('14|1|5') $$,
  'the final authoritative overview exposes revision, active count and Family limit'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000001"}',
  true
);
select results_eq(
  $$ select count(*)::bigint from public.households where id = 'd1200000-0000-4000-8000-000000000001' $$,
  $$ values (0::bigint) $$,
  'the removed previous owner cannot read the household through RLS'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"d1100000-0000-4000-8000-000000000002"}',
  true
);
select results_eq(
  $$ select count(*)::bigint from public.get_household_members('d1200000-0000-4000-8000-000000000001') $$,
  $$ values (1::bigint) $$,
  'the active owner sees only the one active member, never removed tombstones'
);

select * from finish();
rollback;
