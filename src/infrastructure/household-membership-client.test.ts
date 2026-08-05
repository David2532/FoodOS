/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({ getSupabaseBrowserClient: () => ({ rpc }) }));

import {
  acceptHouseholdInvitation,
  createHouseholdInvitation,
  removeHouseholdMember,
  selectHousehold
} from "./household-membership-client";

const householdId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const invitationId = "33333333-3333-4333-8333-333333333333";
const token = "a".repeat(43);

describe("household membership client", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.unstubAllGlobals();
  });

  it("validates and returns the one-time invitation without persisting it", async () => {
    const persistToken = vi.fn();
    vi.stubGlobal("localStorage", { setItem: persistToken });
    rpc.mockResolvedValue({
      data: {
        invitation_id: invitationId,
        invite_token: token,
        expires_at: "2026-08-06T10:00:00.000Z",
        membership_revision: 2
      },
      error: null
    });

    await expect(createHouseholdInvitation({ householdId, expectedRevision: 1 })).resolves.toMatchObject({
      invite_token: token,
      membership_revision: 2
    });
    expect(rpc).toHaveBeenCalledWith("create_household_invitation", {
      target_household: householdId,
      expected_revision: 1,
      ttl_minutes: 1440
    });
    expect(persistToken).not.toHaveBeenCalled();
  });

  it("sends a bounded invitation token only to its dedicated RPC", async () => {
    rpc.mockResolvedValue({
      data: {
        household_id: householdId,
        household_name: "Zuhause",
        member_role: "member",
        member_revision: 1,
        membership_revision: 2
      },
      error: null
    });

    await acceptHouseholdInvitation(` ${token} `);
    expect(rpc).toHaveBeenCalledWith("accept_household_invitation", { invite_token: token });
    expect(() => acceptHouseholdInvitation("too-short")).toThrow();
  });

  it("maps provider details to a bounded message", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private detail FOODOS_HOUSEHOLD_MEMBER_LIMIT host=secret" } });
    await expect(removeHouseholdMember({ householdId, userId, expectedRevision: 1 })).rejects.toThrow("Family-Tarif");
    await expect(removeHouseholdMember({ householdId, userId, expectedRevision: 1 })).rejects.not.toThrow("host=secret");
  });

  it("selects a household through a same-origin body instead of a sensitive URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await selectHousehold(householdId);

    expect(fetchMock).toHaveBeenCalledWith("/api/households/select", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ householdId })
    }));
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain(householdId);
  });
});
