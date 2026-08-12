import { describe, expect, it } from "vitest";
import {
  buildHouseholdInvitationShareText,
  canManageHouseholdMembers,
  isHouseholdAccessDenied,
  remainingHouseholdMemberSlots,
  safeHouseholdMembershipError
} from "./household-membership";

const token = "a".repeat(43);

describe("household membership rules", () => {
  it("reserves pending invitations without exceeding the server limit", () => {
    expect(remainingHouseholdMemberSlots({ memberCount: 2, memberLimit: 5, pendingInvitationCount: 1 })).toBe(2);
    expect(remainingHouseholdMemberSlots({ memberCount: 1, memberLimit: 1, pendingInvitationCount: 0 })).toBe(0);
    expect(remainingHouseholdMemberSlots({ memberCount: 7, memberLimit: 5, pendingInvitationCount: 2 })).toBe(0);
  });

  it("allows only owners to manage another member", () => {
    expect(canManageHouseholdMembers("owner")).toBe(true);
    expect(canManageHouseholdMembers("member")).toBe(false);
  });

  it("builds copyable invitation text without putting the bearer token in a URL", () => {
    const text = buildHouseholdInvitationShareText({
      applicationOrigin: "https://foodos.example",
      inviteToken: token,
      expiresAt: "2026-08-06T10:00:00.000Z"
    });

    expect(text).toContain("Öffne https://foodos.example/");
    expect(text).toContain(`Einmaliger Code: ${token}`);
    expect(text).not.toContain(`?token=${token}`);
    expect(text).not.toContain(`#${token}`);
  });

  it("rejects insecure public origins and malformed tokens", () => {
    expect(() => buildHouseholdInvitationShareText({
      applicationOrigin: "http://foodos.example",
      inviteToken: token,
      expiresAt: "2026-08-06T10:00:00.000Z"
    })).toThrow("Secure application origin required");
    expect(() => buildHouseholdInvitationShareText({
      applicationOrigin: "http://127.0.0.1:3000",
      inviteToken: "short",
      expiresAt: "2026-08-06T10:00:00.000Z"
    })).toThrow();
  });

  it("maps provider detail to bounded user-safe errors", () => {
    expect(safeHouseholdMembershipError("duplicate detail: FOODOS_HOUSEHOLD_MEMBER_LIMIT")).toContain("Family-Tarif");
    expect(safeHouseholdMembershipError("database host and private details")).toBe("Die Haushaltsänderung konnte nicht sicher bestätigt werden.");
  });

  it("recognizes current and legacy access-denial contracts for local purge", () => {
    expect(isHouseholdAccessDenied("FOODOS_HOUSEHOLD_ACCESS_DENIED")).toBe(true);
    expect(isHouseholdAccessDenied("Batch access denied")).toBe(true);
    expect(isHouseholdAccessDenied("Product access denied")).toBe(true);
    expect(isHouseholdAccessDenied("Meal plan access denied")).toBe(true);
    expect(isHouseholdAccessDenied("Shopping item access denied")).toBe(true);
    expect(isHouseholdAccessDenied("Insufficient inventory")).toBe(false);
  });
});
