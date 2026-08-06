/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const scanner = vi.hoisted(() => ({ decode: vi.fn(), stop: vi.fn() }));
const outbox = vi.hoisted(() => ({
  discardRejectedOperation: vi.fn(),
  getDurableOperationStatus: vi.fn(),
  submitDurableRpc: vi.fn(),
  subscribeToOutbox: vi.fn((listener: () => void) => {
    void listener;
    return () => undefined;
  }),
  subscribeToOperationOutcome: vi.fn((operationId: string, listener: (outcome: unknown) => void) => {
    void operationId;
    void listener;
    return () => undefined;
  })
}));

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: class {
    decodeFromConstraints(...args: unknown[]) { return scanner.decode(...args); }
  }
}));
vi.mock("@/infrastructure/offline-outbox", () => outbox);

import { ScanView } from "./scan-view";

const productResponse = {
  globalCatalogStatus: "live",
  product: {
    barcode: "3017624010701",
    name: "Rühls Bestes Whey",
    brand: "Rühl24",
    imageUrl: "https://images.openfoodfacts.org/images/products/301/762/401/0701/front_de.1.400.jpg",
    quantity: "450 g",
    categories: ["Proteinshakes"], countries: ["Deutschland"], labels: [], structuredIngredients: [], allergens: [], traces: [], additives: [],
    nutrition: { kcal100g: 380, protein100g: 75, carbs100g: 8, fat100g: 5 }, assessments: [],
    source: "open-food-facts", retrievedAt: "2026-08-05T12:00:00.000Z", confidence: .94
  }
};

async function scan(code = "3017624010701") {
  const location = screen.getByLabelText("Lagerort für kommende Scans") as HTMLSelectElement;
  if (!location.value) fireEvent.change(location, { target: { value: "pantry" } });
  fireEvent.change(screen.getByPlaceholderText("EAN / UPC / GS1 eingeben"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: /Pr/ }));
  await waitFor(() => expect(document.querySelector(".capture-list")?.textContent).toContain("Rühls Bestes Whey"));
}

function finish() {
  fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
}

describe("continuous purchase capture", () => {
  beforeEach(() => {
    scanner.decode.mockReset();
    scanner.stop.mockReset();
    scanner.decode.mockResolvedValue({ stop: scanner.stop });
    outbox.discardRejectedOperation.mockReset();
    outbox.discardRejectedOperation.mockResolvedValue(true);
    outbox.getDurableOperationStatus.mockReset();
    outbox.getDurableOperationStatus.mockResolvedValue({ status: "queued" });
    outbox.submitDurableRpc.mockReset();
    outbox.subscribeToOutbox.mockReset();
    outbox.subscribeToOutbox.mockImplementation(() => () => undefined);
    outbox.subscribeToOperationOutcome.mockReset();
    outbox.subscribeToOperationOutcome.mockImplementation(() => () => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => productResponse }));
  });

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("keeps the rear camera active across lookups and stops it when the view becomes inactive", async () => {
    const view = render(<ScanView preview active />);
    fireEvent.change(screen.getByLabelText("Lagerort für kommende Scans"), { target: { value: "pantry" } });
    fireEvent.click(screen.getByRole("button", { name: "Kamera starten" }));
    await waitFor(() => expect(scanner.decode).toHaveBeenCalledOnce());
    expect(scanner.decode.mock.calls[0]?.[0]).toMatchObject({ video: { facingMode: { ideal: "environment" } } });

    await scan();
    expect(scanner.stop).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Kamera beenden" })).toBeTruthy();

    view.rerender(<ScanView preview active={false} />);
    expect(scanner.stop).toHaveBeenCalledOnce();
  });

  it("stops camera controls that resolve after the scan view became inactive", async () => {
    let resolveControls: ((controls: { stop: () => void }) => void) | undefined;
    const lateStop = vi.fn();
    scanner.decode.mockImplementationOnce(() => new Promise((resolve) => { resolveControls = resolve; }));
    const view = render(<ScanView preview active />);
    fireEvent.change(screen.getByLabelText("Lagerort für kommende Scans"), { target: { value: "pantry" } });
    fireEvent.click(screen.getByRole("button", { name: "Kamera starten" }));
    await waitFor(() => expect(scanner.decode).toHaveBeenCalledOnce());

    view.rerender(<ScanView preview active={false} />);
    await act(async () => resolveControls?.({ stop: lateStop }));
    expect(lateStop).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole("button", { name: "Kamera starten" })).toBeTruthy());

    view.rerender(<ScanView preview active />);
    expect(screen.getByRole("button", { name: "Kamera starten" })).toBeTruthy();
  });

  it("focuses the required location and starts neither camera nor manual lookup without it", async () => {
    render(<ScanView preview active />);
    const location = screen.getByLabelText("Lagerort für kommende Scans");
    fireEvent.click(screen.getByRole("button", { name: "Kamera starten" }));
    expect(scanner.decode).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(location);
    expect(screen.getAllByText("Wähle zuerst den Lagerort für den nächsten Scan.").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("EAN / UPC / GS1 eingeben"), { target: { value: "3017624010701" } });
    fireEvent.click(screen.getByRole("button", { name: /Pr/ }));
    expect(fetch).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(location);
    expect(document.querySelectorAll(".capture-list li")).toHaveLength(0);
  });

  it("uses the latest explicit location between scans while the camera remains active", async () => {
    render(<ScanView preview active />);
    const location = screen.getByLabelText("Lagerort für kommende Scans");
    fireEvent.change(location, { target: { value: "fridge" } });
    const now = vi.spyOn(Date, "now");
    let currentTime = 0;
    now.mockImplementation(() => currentTime);
    fireEvent.click(screen.getByRole("button", { name: "Kamera starten" }));
    await waitFor(() => expect(scanner.decode).toHaveBeenCalledOnce());
    const callback = scanner.decode.mock.calls[0]?.[2] as (result?: { getText: () => string }) => void;
    callback({ getText: () => "3017624010701" });
    await waitFor(() => expect(document.querySelectorAll(".capture-list li")).toHaveLength(1));

    currentTime = 1;
    callback(undefined);
    currentTime = 400;
    callback(undefined);
    fireEvent.change(location, { target: { value: "" } });
    currentTime = 401;
    callback({ getText: () => "3017624010701" });
    expect(document.querySelectorAll(".capture-list li")).toHaveLength(1);
    expect(document.activeElement).toBe(location);
    fireEvent.change(location, { target: { value: "pantry" } });
    currentTime = 402;
    callback({ getText: () => "3017624010701" });
    await waitFor(() => expect(document.querySelectorAll(".capture-list li")).toHaveLength(2));
    expect(document.querySelectorAll(".capture-list li")[0]?.textContent).toContain("Kühlschrank");
    expect(document.querySelectorAll(".capture-list li")[1]?.textContent).toContain("Vorrat");
    now.mockRestore();
  });

  it("adds a known product compactly and increments an identical duplicate without opening a form", async () => {
    render(<ScanView preview />);
    await scan();
    expect(document.querySelector<HTMLImageElement>(".capture-thumb img")?.getAttribute("src")).toContain("front_de.1.400.jpg");
    expect(document.querySelector(".capture-last.warning")).toBeNull();
    expect(screen.queryByLabelText("Menge")).toBeNull();
    await scan();
    expect(screen.getByText("2", { selector: "output" })).toBeTruthy();
    expect(screen.getAllByText(/Menge erh/).length).toBeGreaterThan(0);
  });

  it("keeps identical products in separate rows when the explicit session location changes", async () => {
    render(<ScanView preview />);
    fireEvent.change(screen.getByLabelText("Lagerort für kommende Scans"), { target: { value: "fridge" } });
    await scan();
    fireEvent.change(screen.getByLabelText("Lagerort für kommende Scans"), { target: { value: "pantry" } });
    await scan();
    expect(document.querySelectorAll(".capture-list li")).toHaveLength(2);
    expect(screen.getAllByText(/Kühlschrank/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vorrat/).length).toBeGreaterThan(0);
  });

  it("retains an unavailable product as an amber exception and lets scanning continue", async () => {
    const fetcher = vi.mocked(fetch);
    fetcher
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: "unavailable" }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => productResponse } as Response);
    render(<ScanView preview />);

    fireEvent.change(screen.getByLabelText("Lagerort für kommende Scans"), { target: { value: "pantry" } });
    fireEvent.change(screen.getByPlaceholderText("EAN / UPC / GS1 eingeben"), { target: { value: "4006381333931" } });
    fireEvent.click(screen.getByRole("button", { name: /Pr/ }));
    await screen.findByText("Unbekanntes Produkt");
    expect(screen.getAllByText(/Produktquelle nicht erreichbar|Verbindung fehlgeschlagen/).length).toBeGreaterThan(0);
    expect(document.querySelector(".capture-last.warning")).toBeTruthy();

    await scan();
    expect(screen.getAllByText("Rühls Bestes Whey").length).toBeGreaterThan(0);
    expect(screen.getByText("1", { selector: ".capture-session-bar span" })).toBeTruthy();
  });

  it("commits the whole ready purchase in one durable operation", async () => {
    outbox.submitDurableRpc.mockResolvedValue({
      status: "acked",
      data: {
        item_count: 1,
        batch_ids: ["11111111-1111-4111-8111-111111111111"],
        product_ids: ["22222222-2222-4222-8222-222222222222"],
        idempotent_replay: false
      }
    });
    const onSaved = vi.fn();
    render(<ScanView householdId="33333333-3333-4333-8333-333333333333" onSaved={onSaved} />);
    await scan();
    finish();
    expect(screen.getByText(/Keine zus/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Einkauf/ }));

    await screen.findByText(/im Vorrat/);
    expect(outbox.submitDurableRpc).toHaveBeenCalledWith(expect.objectContaining({
      kind: "inventory.commit_purchase",
      rpc: "commit_purchase_capture",
      householdId: "33333333-3333-4333-8333-333333333333",
      args: expect.objectContaining({
        target_household: "33333333-3333-4333-8333-333333333333",
        capture_items: [expect.objectContaining({
          item_mutation_id: expect.any(String),
          product_payload: expect.objectContaining({ barcode: "3017624010701" }),
          batch_payload: expect.objectContaining({ amount: 1, unit: "piece", location: "pantry", date_source: null, personal_risk_confirmed: false })
        })]
      })
    }));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("separates GS1 batches and requires visible confirmation before save", async () => {
    outbox.submitDurableRpc.mockResolvedValue({
      status: "acked",
      data: { item_count: 1, batch_ids: ["11111111-1111-4111-8111-111111111111"], product_ids: ["22222222-2222-4222-8222-222222222222"], idempotent_replay: false }
    });
    render(<ScanView householdId="33333333-3333-4333-8333-333333333333" />);
    await scan("(01)04012345123456(15)270630(10)LOT-42(21)SERIAL-7");
    finish();
    expect((screen.getByRole("button", { name: /Einkauf/ }) as HTMLButtonElement).disabled).toBe(true);
    const confirmation = screen.getByLabelText("Mit der Packung abgeglichen");
    fireEvent.change(screen.getByLabelText("Seriennummer"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Charge"), { target: { value: "" } });
    fireEvent.click(confirmation);
    expect(screen.getByLabelText("Mit der Packung abgeglichen")).toBeTruthy();
    fireEvent.click(confirmation);
    expect((screen.getByRole("button", { name: /Einkauf/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirmation);
    fireEvent.click(screen.getByRole("button", { name: /Einkauf/ }));
    await screen.findByText(/im Vorrat/);
    expect(outbox.submitDurableRpc.mock.calls[0]?.[0].args.capture_items[0].batch_payload).toMatchObject({
      best_before_date: "2027-06-30",
      lot_number: null,
      serial_number: null,
      date_source: "gs1_confirmed"
    });
  });

  it("shows the exact device-saved state and waits for a later ACK", async () => {
    let listener: ((outcome: unknown) => void) | undefined;
    const order: string[] = [];
    const unsubscribeOutcome = vi.fn();
    const unsubscribeOutbox = vi.fn();
    outbox.submitDurableRpc.mockResolvedValue({ status: "queued" });
    outbox.subscribeToOperationOutcome.mockImplementation((_id, callback) => {
      order.push("outcome-listener");
      listener = callback;
      return unsubscribeOutcome;
    });
    outbox.subscribeToOutbox.mockImplementation(() => {
      order.push("outbox-listener");
      return unsubscribeOutbox;
    });
    outbox.getDurableOperationStatus.mockImplementation(async () => {
      order.push("durable-read");
      return { status: "queued" };
    });
    const onSaved = vi.fn();
    render(<ScanView householdId="33333333-3333-4333-8333-333333333333" onSaved={onSaved} />);
    await scan();
    finish();
    fireEvent.click(screen.getByRole("button", { name: /Einkauf/ }));
    await screen.findByText("Auf diesem Gerät gespeichert");
    expect(screen.getAllByText("Rühls Bestes Whey").length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "Menge erhöhen" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onSaved).not.toHaveBeenCalled();
    expect(order.slice(0, 3)).toEqual(["outcome-listener", "outbox-listener", "durable-read"]);
    const operationId = outbox.submitDurableRpc.mock.calls[0]?.[0].operationId;

    await waitFor(() => expect(listener).toBeTypeOf("function"));
    const acknowledgement = {
      operationId,
      status: "acked",
      data: { item_count: 1, batch_ids: ["11111111-1111-4111-8111-111111111111"], product_ids: ["22222222-2222-4222-8222-222222222222"], idempotent_replay: false }
    };
    await act(async () => {
      listener?.(acknowledgement);
      listener?.(acknowledgement);
    });
    expect(await screen.findByText(/im Vorrat/)).toBeTruthy();
    expect(onSaved).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(unsubscribeOutcome).toHaveBeenCalledOnce();
      expect(unsubscribeOutbox).toHaveBeenCalledOnce();
    });
  });

  it.each(["uncertain", "absent"] as const)("fails a late durable %s state closed after queueing", async (lateStatus) => {
    let outboxListener: (() => void) | undefined;
    outbox.submitDurableRpc.mockResolvedValue({ status: "queued" });
    outbox.getDurableOperationStatus
      .mockResolvedValueOnce({ status: "queued" })
      .mockResolvedValueOnce(lateStatus === "uncertain"
        ? { status: "uncertain", safeReason: "acknowledgement_unknown" }
        : { status: "absent" });
    outbox.subscribeToOutbox.mockImplementation((callback) => {
      outboxListener = callback;
      return () => undefined;
    });
    render(<ScanView householdId="33333333-3333-4333-8333-333333333333" />);
    await scan();
    finish();
    fireEvent.click(screen.getByRole("button", { name: /Einkauf/ }));
    await screen.findByText("Auf diesem Gerät gespeichert");

    await act(async () => outboxListener?.());
    await screen.findByText("Serverbestätigung unvollständig");
    expect(screen.queryByRole("button", { name: /Erneut sicher speichern|Einkauf übernehmen/ })).toBeNull();
    expect((screen.getByRole("button", { name: "Menge erhöhen" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("fails a durable status read error closed after a known queued state", async () => {
    let outboxListener: (() => void) | undefined;
    outbox.submitDurableRpc.mockResolvedValue({ status: "queued" });
    outbox.getDurableOperationStatus
      .mockResolvedValueOnce({ status: "queued" })
      .mockRejectedValueOnce(new Error("indexed-db-unavailable"));
    outbox.subscribeToOutbox.mockImplementation((callback) => {
      outboxListener = callback;
      return () => undefined;
    });
    render(<ScanView householdId="33333333-3333-4333-8333-333333333333" />);
    await scan();
    finish();
    fireEvent.click(screen.getByRole("button", { name: /Einkauf/ }));
    await screen.findByText("Auf diesem Gerät gespeichert");

    await act(async () => outboxListener?.());
    await screen.findByText("Serverbestätigung unvollständig");
    expect(outbox.submitDurableRpc).toHaveBeenCalledOnce();
  });

  it("turns a late durable rejection into a fresh safe retry and discards only the rejected operation after success", async () => {
    let outboxListener: (() => void) | undefined;
    outbox.submitDurableRpc
      .mockResolvedValueOnce({ status: "queued" })
      .mockResolvedValueOnce({ status: "acked", data: { item_count: 1, batch_ids: ["11111111-1111-4111-8111-111111111111"], product_ids: ["22222222-2222-4222-8222-222222222222"], idempotent_replay: false } });
    outbox.getDurableOperationStatus
      .mockResolvedValueOnce({ status: "sending" })
      .mockResolvedValueOnce({ status: "rejected", safeReason: "server_rejected" });
    outbox.subscribeToOutbox.mockImplementation((callback) => {
      outboxListener = callback;
      return () => undefined;
    });
    render(<ScanView householdId="33333333-3333-4333-8333-333333333333" />);
    await scan();
    finish();
    fireEvent.click(screen.getByRole("button", { name: /Einkauf/ }));
    await screen.findByText("Auf diesem Gerät gespeichert");
    const rejectedOperationId = outbox.submitDurableRpc.mock.calls[0]?.[0].operationId;

    await act(async () => outboxListener?.());
    await screen.findByText(/gespeicherte Änderung wurde abgelehnt/);
    fireEvent.click(screen.getByRole("button", { name: /Erneut sicher speichern/ }));
    await screen.findByText(/im Vorrat/);
    expect(outbox.submitDurableRpc.mock.calls[1]?.[0].operationId).not.toBe(rejectedOperationId);
    expect(outbox.discardRejectedOperation).toHaveBeenCalledWith(rejectedOperationId);
  });

  it("treats an ACK with a different current entry count as uncertain", async () => {
    let listener: ((outcome: unknown) => void) | undefined;
    outbox.submitDurableRpc.mockResolvedValue({ status: "queued" });
    outbox.subscribeToOperationOutcome.mockImplementation((_id, callback) => {
      listener = callback;
      return () => undefined;
    });
    render(<ScanView householdId="33333333-3333-4333-8333-333333333333" />);
    await scan();
    finish();
    fireEvent.click(screen.getByRole("button", { name: /Einkauf/ }));
    await screen.findByText("Auf diesem Gerät gespeichert");
    const operationId = outbox.submitDurableRpc.mock.calls[0]?.[0].operationId;

    await act(async () => listener?.({
      operationId,
      status: "acked",
      data: {
        item_count: 2,
        batch_ids: ["11111111-1111-4111-8111-111111111111", "44444444-4444-4444-8444-444444444444"],
        product_ids: ["22222222-2222-4222-8222-222222222222", "55555555-5555-4555-8555-555555555555"],
        idempotent_replay: false
      }
    }));
    await screen.findByText("Serverbestätigung unvollständig");
    expect(screen.queryByText(/im Vorrat/)).toBeNull();
  });

  it("cleans both queued listeners and ignores late async work after unmount", async () => {
    let outcomeListener: ((outcome: unknown) => void) | undefined;
    let outboxListener: (() => void) | undefined;
    let resolveStatus: ((status: { status: "queued" }) => void) | undefined;
    const unsubscribeOutcome = vi.fn();
    const unsubscribeOutbox = vi.fn();
    outbox.submitDurableRpc.mockResolvedValue({ status: "queued" });
    outbox.getDurableOperationStatus.mockImplementation(() => new Promise((resolve) => {
      resolveStatus = resolve;
    }));
    outbox.subscribeToOperationOutcome.mockImplementation((_id, callback) => {
      outcomeListener = callback;
      return unsubscribeOutcome;
    });
    outbox.subscribeToOutbox.mockImplementation((callback) => {
      outboxListener = callback;
      return unsubscribeOutbox;
    });
    const onSaved = vi.fn();
    const view = render(<ScanView householdId="33333333-3333-4333-8333-333333333333" onSaved={onSaved} />);
    await scan();
    finish();
    fireEvent.click(screen.getByRole("button", { name: /Einkauf/ }));
    await screen.findByText("Auf diesem Gerät gespeichert");
    const operationId = outbox.submitDurableRpc.mock.calls[0]?.[0].operationId;
    await waitFor(() => expect(outcomeListener).toBeTypeOf("function"));

    view.unmount();
    expect(unsubscribeOutcome).toHaveBeenCalledOnce();
    expect(unsubscribeOutbox).toHaveBeenCalledOnce();
    await act(async () => {
      outcomeListener?.({
        operationId,
        status: "acked",
        data: { item_count: 1, batch_ids: ["11111111-1111-4111-8111-111111111111"], product_ids: ["22222222-2222-4222-8222-222222222222"], idempotent_replay: false }
      });
      outboxListener?.();
      resolveStatus?.({ status: "queued" });
      await Promise.resolve();
    });
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("keeps the session after rejection and uses a fresh operation id for retry", async () => {
    outbox.submitDurableRpc
      .mockResolvedValueOnce({ status: "rejected", reason: "server_rejected", message: "Einkauf abgelehnt." })
      .mockResolvedValueOnce({ status: "acked", data: { item_count: 1, batch_ids: ["11111111-1111-4111-8111-111111111111"], product_ids: ["22222222-2222-4222-8222-222222222222"], idempotent_replay: false } });
    render(<ScanView householdId="33333333-3333-4333-8333-333333333333" />);
    await scan();
    finish();
    fireEvent.click(screen.getByRole("button", { name: /Einkauf/ }));
    await screen.findByText("Einkauf abgelehnt.");
    expect(screen.getByText("1 Packung")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Erneut sicher speichern/ }));
    await screen.findByText(/im Vorrat/);
    expect(outbox.submitDurableRpc.mock.calls[1]?.[0].operationId).not.toBe(outbox.submitDurableRpc.mock.calls[0]?.[0].operationId);
    expect(outbox.discardRejectedOperation).toHaveBeenCalledWith(outbox.submitDurableRpc.mock.calls[0]?.[0].operationId);
  });

  it("locks the visible purchase after a malformed acknowledgement instead of sending again", async () => {
    outbox.submitDurableRpc.mockResolvedValue({
      status: "rejected",
      reason: "acknowledgement_unknown",
      message: "Die Serverbestätigung ist unvollständig."
    });
    const onOpenInventory = vi.fn();
    const onOpenToday = vi.fn();
    render(<ScanView
      householdId="33333333-3333-4333-8333-333333333333"
      onOpenInventory={onOpenInventory}
      onOpenToday={onOpenToday}
    />);
    await scan();
    finish();
    fireEvent.click(screen.getByRole("button", { name: /Einkauf/ }));

    await screen.findByText("Serverbestätigung unvollständig");
    expect(screen.getByText(/bereits gebucht haben/)).toBeTruthy();
    expect(screen.getAllByText("Rühls Bestes Whey").length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "Menge erhöhen" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /Erneut sicher speichern|Einkauf übernehmen/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Vorrat prüfen" }));
    fireEvent.click(screen.getByRole("button", { name: "Heute ansehen" }));
    expect(onOpenInventory).toHaveBeenCalledOnce();
    expect(onOpenToday).toHaveBeenCalledOnce();
    expect(outbox.submitDurableRpc).toHaveBeenCalledOnce();
  });

  it("keeps a manually named product low-confidence and makes acknowledgement reversible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: "unavailable" }) }));
    render(<ScanView preview />);
    fireEvent.change(screen.getByLabelText("Lagerort für kommende Scans"), { target: { value: "pantry" } });
    fireEvent.change(screen.getByPlaceholderText("EAN / UPC / GS1 eingeben"), { target: { value: "4006381333931" } });
    fireEvent.click(screen.getByRole("button", { name: /Pr/ }));
    await screen.findByText("Unbekanntes Produkt");
    finish();

    fireEvent.change(screen.getByLabelText("Produktname"), { target: { value: "Mein Produkt" } });
    fireEvent.click(screen.getByRole("button", { name: "Mit Namen übernehmen" }));
    const confidenceCheck = screen.getByRole("checkbox", { name: /Unsichere Produktquelle geprüft/ });
    expect((screen.getByRole("button", { name: "Preview abschließen" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confidenceCheck);
    expect(screen.getByRole("checkbox", { name: /Unsichere Produktquelle geprüft/ })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Preview abschließen" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confidenceCheck);
    expect((screen.getByRole("button", { name: "Preview abschließen" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps Finish disabled until the active product lookup settles", async () => {
    render(<ScanView preview />);
    await scan();
    let resolveLookup: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveLookup = resolve; }));
    fireEvent.change(screen.getByPlaceholderText("EAN / UPC / GS1 eingeben"), { target: { value: "4006381333931" } });
    fireEvent.click(screen.getByRole("button", { name: /Pr/ }));
    const finishButton = screen.getByRole("button", { name: "Fertig" }) as HTMLButtonElement;
    expect(finishButton.disabled).toBe(true);
    fireEvent.click(finishButton);
    expect(screen.queryByRole("heading", { name: "Nur Unklarheiten prüfen" })).toBeNull();

    await act(async () => resolveLookup?.({ ok: true, status: 200, json: async () => ({
      ...productResponse,
      product: { ...productResponse.product, barcode: "4006381333931", name: "Zweites Produkt" }
    }) } as Response));
    await waitFor(() => expect((screen.getByRole("button", { name: "Fertig" }) as HTMLButtonElement).disabled).toBe(false));
  });
});
