/** @vitest-environment jsdom */

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const outbox = vi.hoisted(() => {
  let lifecycleListener: ((state: string) => void) | undefined;
  return {
    discardRejectedOperations: vi.fn(async () => undefined),
    flushQueuedOperations: vi.fn(async () => ({ queued: 0, sending: 0, rejected: 0 })),
    getOfflineDataStorageState: vi.fn(() => "available"),
    getOutboxSummary: vi.fn(async () => ({ queued: 0, sending: 0, rejected: 0 })),
    subscribeToOutbox: vi.fn(() => () => undefined),
    subscribeToOfflineDataStorageState: vi.fn((listener: (state: string) => void) => {
      lifecycleListener = listener;
      return () => undefined;
    }),
    notifyLifecycle: (state: string) => lifecycleListener?.(state)
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/infrastructure/offline-outbox", () => outbox);

import { OutboxStatus } from "./outbox-status";

describe("OutboxStatus", () => {
  beforeEach(() => {
    outbox.getOfflineDataStorageState.mockReturnValue("available");
    outbox.getOutboxSummary.mockResolvedValue({ queued: 0, sending: 0, rejected: 0 });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not present unreadable browser storage as an empty outbox", async () => {
    outbox.getOutboxSummary.mockRejectedValue(new Error("IndexedDB unavailable"));

    render(<OutboxStatus />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Lokale Synchronisierung nicht prüfbar");
    expect(alert.textContent).toContain("weder eine leere Warteschlange noch eine erfolgreiche Löschung angenommen");
  });

  it("renders the pending cleanup state when another tab reports it", async () => {
    render(<OutboxStatus />);
    await waitFor(() => expect(outbox.subscribeToOfflineDataStorageState).toHaveBeenCalledOnce());

    outbox.getOfflineDataStorageState.mockReturnValue("cleanup-pending");
    act(() => outbox.notifyLifecycle("cleanup-pending"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Lokale Offline-Daten werden noch entfernt");
    expect(alert.textContent).toContain("Löschung ist noch nicht bestätigt");
  });
});
