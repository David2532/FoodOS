/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ accept: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: state.refresh }) }));
vi.mock("@/infrastructure/household-membership-client", () => ({ acceptHouseholdInvitation: state.accept }));

import { HouseholdInvitationAcceptance } from "./household-invitation-acceptance";

const token = "a".repeat(43);

describe("HouseholdInvitationAcceptance", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("rejects malformed codes locally without contacting Supabase", async () => {
    const user = userEvent.setup();
    render(<HouseholdInvitationAcceptance />);

    await user.type(screen.getByLabelText("Einmaliger Einladungscode"), "short");
    await user.click(screen.getByRole("button", { name: "Einladung sicher annehmen" }));

    expect(screen.getByRole("alert").textContent).toContain("vollständigen");
    expect(state.accept).not.toHaveBeenCalled();
  });

  it("accepts a valid code once and refreshes into the shared household", async () => {
    state.accept.mockResolvedValue({
      household_id: "11111111-1111-4111-8111-111111111111",
      household_name: "Zuhause",
      member_role: "member",
      member_revision: 1,
      membership_revision: 2
    });
    const user = userEvent.setup();
    render(<HouseholdInvitationAcceptance />);

    await user.type(screen.getByLabelText("Einmaliger Einladungscode"), token);
    await user.click(screen.getByRole("button", { name: "Einladung sicher annehmen" }));

    await waitFor(() => expect(state.accept).toHaveBeenCalledWith(token));
    expect(screen.getByRole("status").textContent).toContain("Zuhause");
    expect(state.refresh).toHaveBeenCalledOnce();
    expect((screen.getByLabelText("Einmaliger Einladungscode") as HTMLInputElement).value).toBe("");
  });
});
