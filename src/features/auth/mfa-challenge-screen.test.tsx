/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  challenge: vi.fn(),
  refresh: vi.fn(),
  verify: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: state.refresh }) }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({ auth: { mfa: { challenge: state.challenge, verify: state.verify } } })
}));
vi.mock("./auth-frame", () => ({ AuthFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("./sign-out-button", () => ({ SignOutButton: () => <button type="button">Sicher abmelden</button> }));

import { MfaChallengeScreen } from "./mfa-challenge-screen";

const factors = [
  { id: "primary", label: "Hauptgerät" },
  { id: "backup", label: "Ersatzgerät" }
];

function enterCodeAndSubmit(code = "123456") {
  const input = document.querySelector<HTMLInputElement>('input[name="code"]');
  if (!input) throw new Error("MFA code field was not rendered");
  fireEvent.change(input, { target: { value: code } });
  fireEvent.submit(input.closest("form") ?? input);
}

describe("MfaChallengeScreen", () => {
  beforeEach(() => {
    state.challenge.mockReset().mockResolvedValue({ data: { id: "challenge-id" }, error: null });
    state.verify.mockReset().mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lets the user choose among verified factors", async () => {
    render(<MfaChallengeScreen factors={factors} />);
    fireEvent.click(screen.getByRole("radio", { name: /Ersatzgerät/ }));
    enterCodeAndSubmit();

    await waitFor(() => expect(state.challenge).toHaveBeenCalledWith({ factorId: "backup" }));
    expect(state.verify).toHaveBeenCalledWith({ factorId: "backup", challengeId: "challenge-id", code: "123456" });
    expect(state.refresh).toHaveBeenCalledOnce();
  });

  it("backs off after a rejected code and gives concrete clock-skew and recovery help", async () => {
    state.verify.mockResolvedValue({ data: null, error: new Error("invalid") });
    render(<MfaChallengeScreen factors={factors} />);
    enterCodeAndSubmit();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("5 Sekunden");
    expect(screen.getByRole("button", { name: "FoodOS entsperren" }).getAttribute("disabled")).not.toBeNull();
    fireEvent.click(screen.getByText("Code wird abgelehnt?", { exact: true }));
    expect(screen.getByText(/Datum & Uhrzeit/)).toBeTruthy();
    fireEvent.click(screen.getByText("Kein Zugriff auf deine Authenticator-App?", { exact: true }));
    expect(screen.getByText(/sie ersetzt 2FA nicht/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sicher abmelden" })).toBeTruthy();
  });
});
