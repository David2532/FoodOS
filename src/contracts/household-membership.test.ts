import { describe, expect, it } from "vitest";
import {
  acceptedHouseholdInvitationSchema,
  createdHouseholdInvitationSchema,
  householdMemberRowSchema,
  householdSummaryRowSchema
} from "./household-membership";

const householdId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

describe("household membership contracts", () => {
  it("accepts bounded authoritative overview rows", () => {
    expect(householdSummaryRowSchema.parse({
      household_id: householdId,
      household_name: "Zuhause",
      member_role: "owner",
      membership_revision: "3",
      member_count: "2",
      member_limit: "5"
    })).toMatchObject({ membership_revision: 3, member_count: 2, member_limit: 5 });

    expect(householdMemberRowSchema.parse({
      user_id: userId,
      member_role: "member",
      display_name: null,
      joined_at: "2026-08-05T10:00:00.000Z",
      membership_revision: 1
    }).display_name).toBeNull();
  });

  it("rejects impossible member limits and malformed invite tokens", () => {
    expect(householdSummaryRowSchema.safeParse({
      household_id: householdId,
      household_name: "Zuhause",
      member_role: "owner",
      membership_revision: 1,
      member_count: 1,
      member_limit: 6
    }).success).toBe(false);
    expect(createdHouseholdInvitationSchema.safeParse({
      invitation_id: householdId,
      invite_token: "raw-token-in-the-wrong-shape",
      expires_at: "2026-08-06T10:00:00.000Z",
      membership_revision: 2
    }).success).toBe(false);
  });

  it("requires an accepted invitation to resolve to a regular member", () => {
    expect(acceptedHouseholdInvitationSchema.safeParse({
      household_id: householdId,
      household_name: "Zuhause",
      member_role: "owner",
      member_revision: 1,
      membership_revision: 2
    }).success).toBe(false);
  });
});
