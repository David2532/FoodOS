/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function deferred<T>() {
  let settle: ((value: T) => void) | null = null;
  const promise = new Promise<T>((next) => {
    settle = next;
  });
  return {
    promise,
    resolve(value: T) {
      if (!settle) throw new Error("Deferred promise was not initialized");
      settle(value);
    }
  };
}

const state = vi.hoisted(() => ({
  clearStagedPrivacyChoice: vi.fn(),
  clearOfflineData: vi.fn(),
  getOfflineDataStorageState: vi.fn(),
  getOutboxSummary: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
  waitForOfflineDataCleanupCompletion: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: state.refresh }) }));
vi.mock("@/features/privacy/privacy-client", () => ({ clearStagedPrivacyChoice: state.clearStagedPrivacyChoice }));
vi.mock("@/infrastructure/offline-outbox", () => ({
  clearOfflineData: state.clearOfflineData,
  getOfflineDataStorageState: state.getOfflineDataStorageState,
  getOutboxSummary: state.getOutboxSummary,
  waitForOfflineDataCleanupCompletion: state.waitForOfflineDataCleanupCompletion
}));
vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: state.signOut } })
}));

import { SignOutButton } from "./sign-out-button";

describe("SignOutButton", () => {
  beforeEach(() => {
    state.getOfflineDataStorageState.mockReturnValue("available");
    state.getOutboxSummary.mockResolvedValue({ queued: 0, sending: 0, rejected: 0 });
    state.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("waits for the blocked deletion request before ending the local session", async () => {
    const completion = deferred<{ status: "cleared" }>();
    state.clearOfflineData.mockResolvedValue({ status: "pending" });
    state.waitForOfflineDataCleanupCompletion.mockReturnValue(completion.promise);
    render(<SignOutButton variant="settings" />);

    const button = screen.getByRole("button", { name: /Sicher abmelden/ });
    fireEvent.click(button);

    await waitFor(() => expect(state.waitForOfflineDataCleanupCompletion).toHaveBeenCalledOnce());
    expect(state.signOut).not.toHaveBeenCalled();
    expect(button.getAttribute("disabled")).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("automatisch fortgesetzt");

    completion.resolve({ status: "cleared" });

    await waitFor(() => expect(state.signOut).toHaveBeenCalledWith({ scope: "local" }));
    expect(state.clearStagedPrivacyChoice).toHaveBeenCalledOnce();
    expect(state.refresh).toHaveBeenCalledOnce();
  });

  it("keeps the session when the blocked deletion request cannot be confirmed", async () => {
    state.clearOfflineData.mockResolvedValue({ status: "pending" });
    state.waitForOfflineDataCleanupCompletion.mockResolvedValue({ status: "unconfirmed" });
    render(<SignOutButton variant="settings" />);

    fireEvent.click(screen.getByRole("button", { name: /Sicher abmelden/ }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("konnte nicht bestätigt werden");
    expect(state.signOut).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Sicher abmelden/ }).getAttribute("disabled")).toBeNull();
  });
});
