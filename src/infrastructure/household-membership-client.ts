"use client";

import { z } from "zod";
import {
  acceptedHouseholdInvitationSchema,
  createdHouseholdInvitationSchema,
  householdInviteTokenSchema,
  membershipMutationResultSchema,
  type AcceptedHouseholdInvitation,
  type CreatedHouseholdInvitation
} from "@/contracts/household-membership";
import { safeHouseholdMembershipError } from "@/domain/household-membership";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export class HouseholdMembershipClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HouseholdMembershipClientError";
  }
}

function fail(providerMessage?: string): never {
  throw new HouseholdMembershipClientError(safeHouseholdMembershipError(providerMessage));
}

async function membershipRpc<T>(
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>
): Promise<T> {
  const { data, error } = await getSupabaseBrowserClient().rpc(name, args);
  if (error) fail(error.message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) fail();
  return parsed.data;
}

export function createHouseholdInvitation(input: {
  householdId: string;
  expectedRevision: number;
  ttlMinutes?: number;
}): Promise<CreatedHouseholdInvitation> {
  return membershipRpc("create_household_invitation", {
    target_household: z.uuid().parse(input.householdId),
    expected_revision: z.number().int().positive().parse(input.expectedRevision),
    ttl_minutes: z.number().int().min(10).max(10_080).parse(input.ttlMinutes ?? 1_440)
  }, createdHouseholdInvitationSchema);
}

export function acceptHouseholdInvitation(inviteToken: string): Promise<AcceptedHouseholdInvitation> {
  return membershipRpc("accept_household_invitation", {
    invite_token: householdInviteTokenSchema.parse(inviteToken.trim())
  }, acceptedHouseholdInvitationSchema);
}

export async function revokeHouseholdInvitation(input: {
  householdId: string;
  invitationId: string;
  expectedRevision: number;
}): Promise<number> {
  const result = await membershipRpc("revoke_household_invitation", {
    target_household: z.uuid().parse(input.householdId),
    target_invitation: z.uuid().parse(input.invitationId),
    expected_revision: z.number().int().positive().parse(input.expectedRevision)
  }, membershipMutationResultSchema);
  return result.membership_revision;
}

export async function removeHouseholdMember(input: {
  householdId: string;
  userId: string;
  expectedRevision: number;
}): Promise<number> {
  const result = await membershipRpc("remove_household_member", {
    target_household: z.uuid().parse(input.householdId),
    target_user: z.uuid().parse(input.userId),
    expected_revision: z.number().int().positive().parse(input.expectedRevision)
  }, membershipMutationResultSchema);
  return result.membership_revision;
}

export async function leaveHousehold(input: {
  householdId: string;
  expectedRevision: number;
}): Promise<number> {
  const result = await membershipRpc("leave_household", {
    target_household: z.uuid().parse(input.householdId),
    expected_revision: z.number().int().positive().parse(input.expectedRevision)
  }, membershipMutationResultSchema);
  return result.membership_revision;
}

export async function transferHouseholdOwnership(input: {
  householdId: string;
  userId: string;
  expectedRevision: number;
}): Promise<number> {
  const result = await membershipRpc("transfer_household_ownership", {
    target_household: z.uuid().parse(input.householdId),
    target_user: z.uuid().parse(input.userId),
    expected_revision: z.number().int().positive().parse(input.expectedRevision)
  }, membershipMutationResultSchema);
  return result.membership_revision;
}

export async function selectHousehold(householdId: string): Promise<void> {
  const response = await fetch("/api/households/select", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ householdId: z.uuid().parse(householdId) })
  });
  if (!response.ok) fail();
}
