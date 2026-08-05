/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  assurance: vi.fn(),
  listFactors: vi.fn(),
  refresh: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: state.refresh }) }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { mfa: { getAuthenticatorAssuranceLevel: state.assurance, listFactors: state.listFactors } }
  })
}));
vi.mock("./auth-frame", () => ({
  AuthFrame: ({ children }: { children: ReactNode }) => <main>{children}</main>
}));
vi.mock("./mfa-enrollment-screen", () => ({ MfaEnrollmentScreen: () => <div>ENROLLMENT</div> }));
vi.mock("./mfa-challenge-screen", () => ({
  MfaChallengeScreen: ({ factors }: { factors: Array<{ id: string; label: string }> }) => <div>CHALLENGE:{factors.map((factor) => factor.label).join("|")}</div>
}));

import { MfaGate } from "./mfa-gate";

describe("MfaGate", () => {
  beforeEach(() => {
    state.assurance.mockReset().mockResolvedValue({ data: { currentLevel: "aal1" }, error: null });
    state.listFactors.mockReset().mockResolvedValue({ data: { totp: [] }, error: null });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("fails closed without offering enrollment when assurance loading fails", async () => {
    state.assurance.mockResolvedValue({ data: null, error: new Error("unavailable") });
    render(<MfaGate />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Erneut sicher prüfen" })).toBeTruthy();
    expect(screen.queryByText("ENROLLMENT")).toBeNull();
    expect(state.listFactors).not.toHaveBeenCalled();
  });

  it("fails closed without offering enrollment when factor loading fails", async () => {
    state.listFactors.mockResolvedValue({ data: null, error: new Error("unavailable") });
    render(<MfaGate />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("ENROLLMENT")).toBeNull();
  });

  it("passes every verified TOTP factor to the challenge and ignores unverified factors", async () => {
    state.listFactors.mockResolvedValue({
      data: {
        totp: [
          { id: "primary", status: "verified", friendly_name: "Hauptgerät" },
          { id: "pending", status: "unverified", friendly_name: "Unbestätigt" },
          { id: "backup", status: "verified", friendly_name: "Ersatzgerät" }
        ]
      },
      error: null
    });
    render(<MfaGate />);

    await waitFor(() => expect(screen.getByText("CHALLENGE:Hauptgerät|Ersatzgerät")).toBeTruthy());
    expect(screen.queryByText(/Unbestätigt/)).toBeNull();
    expect(screen.queryByText("ENROLLMENT")).toBeNull();
  });
});
