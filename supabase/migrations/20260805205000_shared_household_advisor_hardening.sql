begin;

-- These complete B-tree indexes cover the four user-reference foreign keys
-- introduced by the shared-household lifecycle and are intentionally shaped
-- to satisfy the Supabase unindexed-foreign-key advisor.
create index if not exists household_invitations_created_by_idx
  on public.household_invitations (created_by);
create index if not exists household_invitations_accepted_by_idx
  on public.household_invitations (accepted_by);
create index if not exists household_invitations_revoked_by_idx
  on public.household_invitations (revoked_by);
create index if not exists household_members_removed_by_idx
  on public.household_members (removed_by);

comment on table public.household_membership_state is
  'Internal revision lock state. RLS is intentionally deny-all with no client policy; only pinned SECURITY DEFINER lifecycle RPCs may access it.';
comment on table public.account_entitlements is
  'Server-authoritative entitlement state. RLS is intentionally deny-all with no client policy or direct client privileges.';
comment on table public.household_invitations is
  'Hashed one-time invitation state. RLS is intentionally deny-all; authenticated clients use the AAL2 lifecycle RPCs only.';

comment on function public.get_my_households() is
  'Intentional authenticated SECURITY DEFINER boundary; requires live AAL2 and exposes only the caller active memberships.';
comment on function public.get_household_members(uuid) is
  'Intentional authenticated SECURITY DEFINER boundary; requires live AAL2 and active household membership.';
comment on function public.list_household_invitations(uuid) is
  'Intentional authenticated SECURITY DEFINER boundary; requires live AAL2 owner authority and never returns token hashes.';
comment on function public.create_household_invitation(uuid, bigint, integer) is
  'Intentional authenticated SECURITY DEFINER boundary; requires live AAL2 owner authority and returns a raw token once.';
comment on function public.accept_household_invitation(text) is
  'Intentional authenticated SECURITY DEFINER boundary; requires live AAL2 and consumes a hashed one-time token.';
comment on function public.revoke_household_invitation(uuid, uuid, bigint) is
  'Intentional authenticated SECURITY DEFINER boundary; requires live AAL2 owner authority and revision matching.';
comment on function public.remove_household_member(uuid, uuid, bigint) is
  'Intentional authenticated SECURITY DEFINER boundary; requires live AAL2 owner authority and records a tombstone.';
comment on function public.leave_household(uuid, bigint) is
  'Intentional authenticated SECURITY DEFINER boundary; requires live AAL2 and preserves the last-owner invariant.';
comment on function public.transfer_household_ownership(uuid, uuid, bigint) is
  'Intentional authenticated SECURITY DEFINER boundary; requires live AAL2 and transfers the sole-owner invariant atomically.';

commit;
