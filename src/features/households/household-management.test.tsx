/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HouseholdMemberRow, HouseholdSummaryRow } from "@/contracts/household-membership";

const api = vi.hoisted(() => ({
  createHouseholdInvitation: vi.fn(),
  leaveHousehold: vi.fn(),
  purgeOfflineHouseholdData: vi.fn(),
  removeHouseholdMember: vi.fn(),
  revokeHouseholdInvitation: vi.fn(),
  selectHousehold: vi.fn(),
  transferHouseholdOwnership: vi.fn()
}));
vi.mock("@/infrastructure/household-membership-client", () => api);
vi.mock("@/infrastructure/offline-outbox", () => ({
  purgeOfflineHouseholdData: api.purgeOfflineHouseholdData
}));

import { HouseholdManagement } from "./household-management";

const householdId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const memberId = "33333333-3333-4333-8333-333333333333";
const invitationId = "44444444-4444-4444-8444-444444444444";
const token = "a".repeat(43);

const owner: HouseholdMemberRow = {
  user_id: ownerId,
  member_role: "owner",
  display_name: "Alex",
  joined_at: "2026-08-01T10:00:00.000Z",
  membership_revision: 1
};
const member: HouseholdMemberRow = {
  user_id: memberId,
  member_role: "member",
  display_name: "Sam",
  joined_at: "2026-08-02T10:00:00.000Z",
  membership_revision: 1
};

function summary(overrides: Partial<HouseholdSummaryRow> = {}): HouseholdSummaryRow {
  return {
    household_id: householdId,
    household_name: "Zuhause",
    member_role: "owner",
    membership_revision: 1,
    member_count: 1,
    member_limit: 5,
    ...overrides
  };
}

function renderManagement(overrides: Partial<Parameters<typeof HouseholdManagement>[0]> = {}) {
  return render(<HouseholdManagement
    currentUserId={ownerId}
    currentHouseholdId={householdId}
    households={[summary()]}
    members={[owner]}
    pendingInvitations={[]}
    onChanged={vi.fn()}
    {...overrides}
  />);
}

describe("HouseholdManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
    api.purgeOfflineHouseholdData.mockResolvedValue({ purged: 1, preserved: 2, unreadable: 0 });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows and copies a raw invitation only in the one-time result", async () => {
    api.createHouseholdInvitation.mockResolvedValue({
      invitation_id: invitationId,
      invite_token: token,
      expires_at: "2026-08-06T10:00:00.000Z",
      membership_revision: 2
    });
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    renderManagement();
    await user.click(screen.getByRole("button", { name: "Code erstellen" }));

    expect(screen.getByText(token)).toBeTruthy();
    expect(screen.getByText("Nur jetzt sichtbar")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Einladung kopieren" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]?.[0]).toContain(`Einmaliger Code: ${token}`);
    expect(writeText.mock.calls[0]?.[0]).not.toContain(`?token=${token}`);
  });

  it("fails closed when the authoritative plan exposes one occupied slot", () => {
    renderManagement({ households: [summary({ member_limit: 1 })] });

    expect((screen.getByRole("button", { name: "Code erstellen" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Family erforderlich/)).toBeTruthy();
  });

  it("uses the displayed membership revision for a confirmed removal", async () => {
    api.removeHouseholdMember.mockResolvedValue(8);
    const user = userEvent.setup();
    renderManagement({
      households: [summary({ member_count: 2, membership_revision: 7 })],
      members: [owner, member]
    });

    await user.click(screen.getByRole("button", { name: "Entfernen" }));
    await waitFor(() => expect(api.removeHouseholdMember).toHaveBeenCalledWith({
      householdId,
      userId: memberId,
      expectedRevision: 7
    }));
    expect(screen.getByRole("status").textContent).toContain("Zugriff serverseitig gesperrt");
  });

  it("lets a regular member leave but never renders owner-only controls", async () => {
    api.leaveHousehold.mockResolvedValue(3);
    const user = userEvent.setup();
    renderManagement({
      currentUserId: memberId,
      households: [summary({ member_role: "member", member_count: 2, membership_revision: 2 })],
      members: [owner, member]
    });

    expect(screen.queryByRole("button", { name: "Code erstellen" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Haushalt verlassen/ }));
    await waitFor(() => expect(api.leaveHousehold).toHaveBeenCalledWith({ householdId, expectedRevision: 2 }));
    expect(api.purgeOfflineHouseholdData).toHaveBeenCalledWith(householdId);
    expect(screen.getByRole("status").textContent).toContain("lokalen Offline-Änderungen wurden entfernt");
  });
});
