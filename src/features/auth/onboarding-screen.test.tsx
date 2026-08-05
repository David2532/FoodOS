/** @vitest-environment jsdom */

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  reconcileOfflineHouseholdAccess: vi.fn(async () => ({ purged: 2, preserved: 0, unreadable: 0 })),
  refresh: vi.fn(),
  rpc: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: state.refresh }) }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({ rpc: state.rpc })
}));
vi.mock("@/infrastructure/offline-outbox", () => ({
  reconcileOfflineHouseholdAccess: state.reconcileOfflineHouseholdAccess
}));
vi.mock("./auth-frame", () => ({
  AuthFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

import { OnboardingScreen } from "./onboarding-screen";

describe("OnboardingScreen household access reconciliation", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("purges stale household queues after the server authoritatively returned zero households", async () => {
    render(<OnboardingScreen />);

    await waitFor(() => expect(state.reconcileOfflineHouseholdAccess).toHaveBeenCalledWith([]));
    expect(state.reconcileOfflineHouseholdAccess).toHaveBeenCalledOnce();
  });
});
