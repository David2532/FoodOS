/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppSnapshot } from "@/lib/types";

const state = vi.hoisted(() => ({ accept: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: state.refresh }) }));
vi.mock("@/infrastructure/household-membership-client", () => ({
  acceptHouseholdInvitation: state.accept
}));
vi.mock("@/features/households/household-management", () => ({ HouseholdManagement: () => <div>Mitgliederverwaltung</div> }));
vi.mock("@/features/auth/sign-out-button", () => ({ SignOutButton: () => null }));
vi.mock("@/features/privacy/data-export-button", () => ({ DataExportButton: () => null }));
vi.mock("@/features/privacy/privacy-center-button", () => ({ PrivacyCenterButton: () => null }));
vi.mock("./password-change-form", () => ({ PasswordChangeForm: () => null }));
vi.mock("./theme-options", () => ({ ThemeOptions: () => null }));

import { AccountSettingsView } from "./account-settings-view";

const token = "a".repeat(43);
const snapshot = {
  currentUserId: "22222222-2222-4222-8222-222222222222",
  household: { id: "11111111-1111-4111-8111-111111111111", name: "Zuhause" },
  households: [],
  householdMembers: [],
  pendingHouseholdInvitations: []
} as unknown as AppSnapshot;

describe("AccountSettingsView household invitation entry", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lets an existing user accept a second-household invitation without a URL token", async () => {
    state.accept.mockResolvedValue({
      household_id: "33333333-3333-4333-8333-333333333333",
      household_name: "Teamküche",
      member_role: "member",
      member_revision: 1,
      membership_revision: 2
    });
    const onDataChanged = vi.fn();
    const user = userEvent.setup();
    render(<AccountSettingsView snapshot={snapshot} onDataChanged={onDataChanged} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("Einmaliger Einladungscode"), token);
    await user.click(screen.getByRole("button", { name: "Einladung sicher annehmen" }));

    await waitFor(() => expect(state.accept).toHaveBeenCalledWith(token));
    expect(onDataChanged).toHaveBeenCalledOnce();
    expect(state.refresh).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Einmaliger Einladungscode") as HTMLInputElement).value).toBe("");
  });
});
