/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));

const outbox = vi.hoisted(() => {
  let lifecycleListener: ((state: string) => void) | undefined;
  let outboxListener: (() => void) | undefined;
  return {
    discardRejectedOperations: vi.fn(async () => undefined),
    flushQueuedOperations: vi.fn(async () => ({ queued: 0, sending: 0, rejected: 0, uncertain: 0 })),
    getOfflineDataStorageState: vi.fn(() => "available"),
    getOutboxSummary: vi.fn(async () => ({ queued: 0, sending: 0, rejected: 0, uncertain: 0 })),
    reconcileOfflineHouseholdAccess: vi.fn<(householdIds: string[]) => Promise<{ purged: number; preserved: number; unreadable: number }>>()
      .mockResolvedValue({ purged: 0, preserved: 0, unreadable: 0 }),
    reconcileUncertainOperations: vi.fn(async () => ({ queued: 0, sending: 0, rejected: 0, uncertain: 0 })),
    subscribeToOutbox: vi.fn((listener: () => void) => {
      outboxListener = listener;
      return () => undefined;
    }),
    subscribeToOfflineDataStorageState: vi.fn((listener: (state: string) => void) => {
      lifecycleListener = listener;
      return () => undefined;
    }),
    notifyLifecycle: (state: string) => lifecycleListener?.(state),
    notifyOutbox: () => outboxListener?.()
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: navigation.refresh }) }));
vi.mock("@/infrastructure/offline-outbox", () => outbox);

import { OutboxStatus } from "./outbox-status";

describe("OutboxStatus", () => {
  beforeEach(() => {
    navigation.refresh.mockReset();
    outbox.getOfflineDataStorageState.mockReturnValue("available");
    outbox.flushQueuedOperations.mockResolvedValue({ queued: 0, sending: 0, rejected: 0, uncertain: 0 });
    outbox.getOutboxSummary.mockResolvedValue({ queued: 0, sending: 0, rejected: 0, uncertain: 0 });
    outbox.reconcileOfflineHouseholdAccess.mockResolvedValue({ purged: 0, preserved: 0, unreadable: 0 });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("does not present unreadable browser storage as an empty outbox", async () => {
    outbox.getOutboxSummary.mockRejectedValue(new Error("IndexedDB unavailable"));

    render(<OutboxStatus />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Lokale Synchronisierung nicht prüfbar");
    expect(alert.textContent).toContain("weder eine leere Warteschlange noch eine erfolgreiche Löschung angenommen");
  });

  it("hydrates before reading a browser-only offline-data marker", async () => {
    let clientMounted = false;
    outbox.getOfflineDataStorageState.mockImplementation(() => clientMounted ? "cleared" : "available");
    const markup = renderToString(<OutboxStatus />);
    clientMounted = true;
    const container = document.createElement("div");
    container.innerHTML = markup;
    document.body.append(container);
    const recoverableErrors: unknown[] = [];
    const root = hydrateRoot(container, <OutboxStatus />, {
      onRecoverableError: (error) => recoverableErrors.push(error)
    });
    try {
      await waitFor(() => expect(container.textContent).toContain("Lokale Offline-Daten bestätigt entfernt"));
      expect(recoverableErrors).toEqual([]);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("hydrates before applying the browser's offline state", async () => {
    const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, "onLine");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const markup = renderToString(<OutboxStatus />);
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const container = document.createElement("div");
    container.innerHTML = markup;
    document.body.append(container);
    const recoverableErrors: unknown[] = [];
    const root = hydrateRoot(container, <OutboxStatus />, {
      onRecoverableError: (error) => recoverableErrors.push(error)
    });
    try {
      await waitFor(() => expect(container.textContent).toContain("Offline · Serverstand nicht aktualisierbar"));
      expect(recoverableErrors).toEqual([]);
    } finally {
      act(() => root.unmount());
      container.remove();
      if (onlineDescriptor) Object.defineProperty(navigator, "onLine", onlineDescriptor);
      else Reflect.deleteProperty(navigator, "onLine");
    }
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

  it("refreshes the authoritative server snapshot when an outbox outcome changes", async () => {
    render(<OutboxStatus />);
    await waitFor(() => expect(outbox.flushQueuedOperations).toHaveBeenCalledOnce());
    navigation.refresh.mockClear();

    act(() => outbox.notifyOutbox());

    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledOnce());
  });

  it("keeps the queued local status visible without requesting a server snapshot while offline", async () => {
    const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, "onLine");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    try {
      outbox.getOutboxSummary.mockResolvedValue({ queued: 1, sending: 0, rejected: 0, uncertain: 0 });
      render(<OutboxStatus />);
      await screen.findByText("Offline · auf diesem Gerät gespeichert");
      navigation.refresh.mockClear();

      act(() => outbox.notifyOutbox());

      await waitFor(() => expect(outbox.getOutboxSummary).toHaveBeenCalled());
      expect(navigation.refresh).not.toHaveBeenCalled();
      expect(screen.getByText("Offline · auf diesem Gerät gespeichert")).toBeTruthy();
    } finally {
      if (onlineDescriptor) Object.defineProperty(navigator, "onLine", onlineDescriptor);
      else Reflect.deleteProperty(navigator, "onLine");
    }
  });

  it("reconciles the server-authorized household set before flushing", async () => {
    const activeHouseholdIds = ["11111111-1111-4111-8111-111111111111"];
    const view = render(<OutboxStatus activeHouseholdIds={activeHouseholdIds} />);

    await waitFor(() => expect(outbox.reconcileOfflineHouseholdAccess).toHaveBeenCalledWith(activeHouseholdIds));
    expect(outbox.reconcileOfflineHouseholdAccess.mock.invocationCallOrder[0]).toBeLessThan(
      outbox.flushQueuedOperations.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER
    );

    view.rerender(<OutboxStatus activeHouseholdIds={[...activeHouseholdIds]} />);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(outbox.reconcileOfflineHouseholdAccess).toHaveBeenCalledOnce();
  });

  it("shows an uncertain acknowledgement as non-discardable instead of success", async () => {
    outbox.getOutboxSummary.mockResolvedValue({ queued: 0, sending: 0, rejected: 0, uncertain: 1 });

    render(<OutboxStatus />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Serverbestätigung unklar");
    expect(alert.textContent).toContain("1 Änderung kann bereits gebucht worden sein");
    expect(alert.textContent).toContain("kann bereits gebucht worden sein");
    expect(alert.textContent).toContain("sendet nichts automatisch erneut");
    expect(alert.textContent).toContain("nicht doppelt");
    expect(screen.queryByRole("button", { name: /verwerfen/i })).toBeNull();
    expect(outbox.discardRejectedOperations).not.toHaveBeenCalled();
    expect(outbox.reconcileUncertainOperations).not.toHaveBeenCalled();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Unklare Änderungen sicher abgleichen" }));
    await waitFor(() => expect(outbox.reconcileUncertainOperations).toHaveBeenCalledOnce());
  });

  it("prevents duplicate reconciliation while an uncertain batch is still being checked", async () => {
    let finishReconciliation: ((summary: { queued: number; sending: number; rejected: number; uncertain: number }) => void) | undefined;
    outbox.getOutboxSummary.mockResolvedValue({ queued: 0, sending: 0, rejected: 0, uncertain: 1 });
    outbox.reconcileUncertainOperations.mockImplementationOnce(() => new Promise((resolve) => {
      finishReconciliation = resolve;
    }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<OutboxStatus />);

    const button = await screen.findByRole("button", { name: "Unklare Änderungen sicher abgleichen" });
    fireEvent.click(button);
    const pendingButton = await screen.findByRole("button", { name: "Unklare Änderungen werden abgeglichen …" });
    expect((pendingButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(pendingButton);
    expect(outbox.reconcileUncertainOperations).toHaveBeenCalledOnce();

    await act(async () => finishReconciliation?.({ queued: 0, sending: 0, rejected: 0, uncertain: 1 }));
    await screen.findByRole("button", { name: "Unklare Änderungen sicher abgleichen" });
  });

  it("keeps uncertain, rejected, sending, and queued states visible together", async () => {
    outbox.getOutboxSummary.mockResolvedValue({ queued: 3, sending: 1, rejected: 2, uncertain: 1 });

    render(<OutboxStatus />);

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((alert) => alert.textContent).join(" ")).toContain("Serverbestätigung unklar");
    expect(alerts.map((alert) => alert.textContent).join(" ")).toContain("Synchronisierung angehalten");
    expect(screen.getByText("Wird synchronisiert")).toBeTruthy();
    expect(screen.getByText("Synchronisierung wartet")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Abgelehnte lokale Änderungen verwerfen/ })).toBeTruthy();
  });

  it("serializes overlapping online flush requests", async () => {
    let releaseFlush: (() => void) | undefined;
    outbox.flushQueuedOperations.mockReturnValueOnce(new Promise((resolve) => {
      releaseFlush = () => resolve({ queued: 0, sending: 0, rejected: 0, uncertain: 0 });
    }));

    render(<OutboxStatus />);

    await waitFor(() => expect(outbox.flushQueuedOperations).toHaveBeenCalledOnce());
    act(() => {
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("online"));
    });
    expect(outbox.flushQueuedOperations).toHaveBeenCalledOnce();

    releaseFlush?.();
    await waitFor(() => expect(outbox.getOutboxSummary).toHaveBeenCalled());
  });

  it("runs one trailing reconciliation for the latest household set after an in-flight sync", async () => {
    const firstHouseholdIds = ["11111111-1111-4111-8111-111111111111"];
    const latestHouseholdIds = ["22222222-2222-4222-8222-222222222222"];
    let releaseFirstReconciliation: (() => void) | undefined;
    let concurrentReconciliations = 0;
    let maximumConcurrency = 0;
    outbox.reconcileOfflineHouseholdAccess.mockImplementation(async (householdIds: string[]) => {
      concurrentReconciliations += 1;
      maximumConcurrency = Math.max(maximumConcurrency, concurrentReconciliations);
      if (householdIds[0] === firstHouseholdIds[0]) {
        await new Promise<void>((resolve) => {
          releaseFirstReconciliation = resolve;
        });
      }
      concurrentReconciliations -= 1;
      return { purged: 0, preserved: 0, unreadable: 0 };
    });

    const view = render(<OutboxStatus activeHouseholdIds={firstHouseholdIds} />);
    await waitFor(() => expect(outbox.reconcileOfflineHouseholdAccess).toHaveBeenCalledOnce());

    view.rerender(<OutboxStatus activeHouseholdIds={latestHouseholdIds} />);
    await act(async () => Promise.resolve());
    expect(outbox.reconcileOfflineHouseholdAccess).toHaveBeenCalledOnce();

    await act(async () => {
      releaseFirstReconciliation?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(outbox.reconcileOfflineHouseholdAccess).toHaveBeenNthCalledWith(2, latestHouseholdIds));
    expect(maximumConcurrency).toBe(1);
  });

  it("rechecks a sending claim until an interrupted lease becomes visible as uncertain", async () => {
    const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, "onLine");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    vi.useFakeTimers();
    let view: ReturnType<typeof render> | undefined;
    try {
      outbox.getOutboxSummary
        .mockResolvedValueOnce({ queued: 0, sending: 1, rejected: 0, uncertain: 0 })
        .mockResolvedValue({ queued: 0, sending: 0, rejected: 0, uncertain: 1 });

      view = render(<OutboxStatus />);
      await act(async () => vi.advanceTimersByTimeAsync(0));
      expect(screen.getByText("Wird synchronisiert")).toBeTruthy();

      await act(async () => vi.advanceTimersByTimeAsync(5_000));
      expect(screen.getByText("Serverbestätigung unklar")).toBeTruthy();
      expect(outbox.getOutboxSummary).toHaveBeenCalledTimes(2);
    } finally {
      view?.unmount();
      vi.useRealTimers();
      if (onlineDescriptor) Object.defineProperty(navigator, "onLine", onlineDescriptor);
      else Reflect.deleteProperty(navigator, "onLine");
    }
  });
});
