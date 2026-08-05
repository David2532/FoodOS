/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const scanner = vi.hoisted(() => ({
  decode: vi.fn(),
  stop: vi.fn()
}));

const outbox = vi.hoisted(() => ({
  discardRejectedOperation: vi.fn(),
  submitDurableRpc: vi.fn(),
  subscribeToOperationOutcome: vi.fn((operationId: string, listener: (...args: unknown[]) => void) => {
    void operationId;
    void listener;
    return () => undefined;
  })
}));

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: class {
    decodeFromConstraints(...args: unknown[]) {
      return scanner.decode(...args);
    }
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
    categories: ["Proteinshakes"],
    countries: ["Deutschland"],
    labels: [],
    structuredIngredients: [],
    allergens: [],
    traces: [],
    additives: [],
    nutrition: { kcal100g: 380, protein100g: 75, carbs100g: 8, fat100g: 5 },
    assessments: [],
    source: "open-food-facts",
    sourceUrl: "https://world.openfoodfacts.org/product/3017624010701",
    databaseLicense: "ODbL 1.0",
    imageLicense: "CC BY-SA",
    retrievedAt: "2026-08-05T12:00:00.000Z",
    confidence: 0.94
  }
};

async function loadProduct(code = "3017624010701") {
  fireEvent.change(screen.getByPlaceholderText("EAN / UPC / GS1 eingeben"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Prüfen" }));
  await screen.findByRole("heading", { name: "Rühls Bestes Whey" });
}

function fillBatch() {
  fireEvent.click(screen.getByLabelText("MHD"));
  fireEvent.change(screen.getByLabelText("Mindestens haltbar bis"), { target: { value: "2027-06-30" } });
  fireEvent.change(screen.getByLabelText("Menge"), { target: { value: "450" } });
  fireEvent.change(screen.getByLabelText("Einheit"), { target: { value: "g" } });
  fireEvent.change(screen.getByLabelText("Lagerort"), { target: { value: "fridge" } });
  fireEvent.change(screen.getByLabelText("Charge · optional"), { target: { value: "LOT-42" } });
}

describe("ScanView camera", () => {
  beforeEach(() => {
    scanner.decode.mockReset();
    scanner.stop.mockReset();
    scanner.decode.mockResolvedValue({ stop: scanner.stop });
    outbox.discardRejectedOperation.mockReset();
    outbox.discardRejectedOperation.mockResolvedValue(true);
    outbox.submitDurableRpc.mockReset();
    outbox.subscribeToOperationOutcome.mockReset();
    outbox.subscribeToOperationOutcome.mockImplementation((operationId, listener) => {
      void operationId;
      void listener;
      return () => undefined;
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => productResponse }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("prefers the rear camera and exposes a visible stop action", async () => {
    render(<ScanView preview />);

    fireEvent.click(screen.getByRole("button", { name: "Kamera starten" }));

    await waitFor(() => expect(scanner.decode).toHaveBeenCalledOnce());
    expect(scanner.decode.mock.calls[0]?.[0]).toMatchObject({
      audio: false,
      video: { facingMode: { ideal: "environment" } }
    });

    fireEvent.click(await screen.findByRole("button", { name: "Kamera beenden" }));
    expect(scanner.stop).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Kamera starten" })).toBeTruthy();
  });

  it("shows an authoritative ACK with the confirmed batch and explicit next actions", async () => {
    const onSaved = vi.fn();
    const onOpenInventory = vi.fn();
    outbox.submitDurableRpc.mockResolvedValue({
      status: "acked",
      data: { batch_id: "11111111-1111-4111-8111-111111111111", product_id: "22222222-2222-4222-8222-222222222222", remaining_amount: 450, idempotent_replay: false }
    });
    render(<ScanView householdId="33333333-3333-4333-8333-333333333333" onSaved={onSaved} onOpenInventory={onOpenInventory} />);
    await loadProduct();
    fillBatch();

    fireEvent.click(screen.getByRole("button", { name: "Charge zum Vorrat hinzufügen" }));

    await screen.findByText("Vom Server bestätigt");
    expect(screen.getByText("450 g · Kühlschrank · MHD 30.6.2027 · Charge LOT-42")).toBeTruthy();
    expect(outbox.submitDurableRpc).toHaveBeenCalledWith(expect.objectContaining({
      kind: "inventory.add_batch",
      rpc: "add_inventory_batch",
      householdId: "33333333-3333-4333-8333-333333333333",
      args: expect.objectContaining({
        batch_payload: expect.objectContaining({ amount: 450, unit: "g", location: "fridge", best_before_date: "2027-06-30", lot_number: "LOT-42" })
      })
    }));
    expect(outbox.submitDurableRpc.mock.calls[0]?.[0].args.batch_payload.date_source).toBe("manual_confirmed");
    expect(onSaved).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Vorrat ansehen" }));
    expect(onOpenInventory).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Weiter scannen" })).toBeTruthy();
  });

  it("retains inputs and uses a fresh mutation id only after an authoritative rejection", async () => {
    outbox.submitDurableRpc
      .mockResolvedValueOnce({ status: "rejected", message: "Server lehnt die Charge ab.", reason: "server_rejected" })
      .mockResolvedValueOnce({ status: "acked", data: { batch_id: "11111111-1111-4111-8111-111111111111", remaining_amount: 450, idempotent_replay: false } });
    render(<ScanView householdId="33333333-3333-4333-8333-333333333333" />);
    await loadProduct();
    fillBatch();

    fireEvent.click(screen.getByRole("button", { name: "Charge zum Vorrat hinzufügen" }));
    await screen.findByRole("alert");

    expect((screen.getByLabelText("Menge") as HTMLInputElement).value).toBe("450");
    expect((screen.getByLabelText("Mindestens haltbar bis") as HTMLInputElement).value).toBe("2027-06-30");
    expect((screen.getByLabelText("Lagerort") as HTMLSelectElement).value).toBe("fridge");
    expect((screen.getByLabelText("Charge · optional") as HTMLInputElement).value).toBe("LOT-42");

    fireEvent.click(screen.getByRole("button", { name: "Erneut sicher speichern" }));
    await screen.findByText("Vom Server bestätigt");

    const firstOperationId = outbox.submitDurableRpc.mock.calls[0]?.[0].operationId;
    const secondOperationId = outbox.submitDurableRpc.mock.calls[1]?.[0].operationId;
    expect(secondOperationId).not.toBe(firstOperationId);
    expect(outbox.discardRejectedOperation).toHaveBeenCalledWith(firstOperationId);
  });

  it("recovers a payload conflict with a fresh mutation id without discarding the original operation", async () => {
    outbox.submitDurableRpc
      .mockResolvedValueOnce({ status: "rejected", message: "Die ursprüngliche Änderung bleibt erhalten.", reason: "payload_conflict" })
      .mockResolvedValueOnce({ status: "acked", data: { batch_id: "11111111-1111-4111-8111-111111111111", remaining_amount: 450, idempotent_replay: false } });
    render(<ScanView householdId="33333333-3333-4333-8333-333333333333" />);
    await loadProduct();
    fillBatch();

    fireEvent.click(screen.getByRole("button", { name: "Charge zum Vorrat hinzufügen" }));
    await screen.findByText("Die ursprüngliche Änderung bleibt erhalten.");
    fireEvent.click(screen.getByRole("button", { name: "Erneut sicher speichern" }));
    await screen.findByText("Vom Server bestätigt");

    expect(outbox.submitDurableRpc.mock.calls[1]?.[0].operationId).not.toBe(outbox.submitDurableRpc.mock.calls[0]?.[0].operationId);
    expect(outbox.discardRejectedOperation).not.toHaveBeenCalled();
  });

  it.each([
    { label: "unchanged", changedDate: undefined, expectedSource: "gs1_confirmed" },
    { label: "manually changed", changedDate: "2027-07-01", expectedSource: "manual_confirmed" }
  ])("marks a $label GS1 date with the correct provenance", async ({ changedDate, expectedSource }) => {
    outbox.submitDurableRpc.mockResolvedValue({
      status: "acked",
      data: { batch_id: "11111111-1111-4111-8111-111111111111", remaining_amount: 1, idempotent_replay: false }
    });
    render(<ScanView householdId="33333333-3333-4333-8333-333333333333" />);
    await loadProduct("(01)04012345123456(15)270630(10)LOT-42");
    if (changedDate) fireEvent.change(screen.getByLabelText("Mindestens haltbar bis"), { target: { value: changedDate } });

    fireEvent.click(screen.getByRole("button", { name: "Charge zum Vorrat hinzufügen" }));
    await screen.findByText("Vom Server bestätigt");

    expect(outbox.submitDurableRpc.mock.calls[0]?.[0].args.batch_payload.date_source).toBe(expectedSource);
  });

  it("updates a queued operation only when its later server ACK arrives", async () => {
    let resolveOperation: ((outcome: { operationId: string; status: "acked"; data: unknown }) => void) | undefined;
    outbox.submitDurableRpc.mockResolvedValue({ status: "queued" });
    outbox.subscribeToOperationOutcome.mockImplementation((_operationId, listener) => {
      resolveOperation = listener as typeof resolveOperation;
      return () => undefined;
    });
    const onSaved = vi.fn();
    render(<ScanView householdId="33333333-3333-4333-8333-333333333333" onSaved={onSaved} />);
    await loadProduct();
    fillBatch();

    fireEvent.click(screen.getByRole("button", { name: "Charge zum Vorrat hinzufügen" }));
    await screen.findByText("Sicher vorgemerkt");
    expect(onSaved).not.toHaveBeenCalled();
    const operationId = outbox.submitDurableRpc.mock.calls[0]?.[0].operationId;

    await act(async () => {
      resolveOperation?.({
        operationId,
        status: "acked",
        data: { batch_id: "11111111-1111-4111-8111-111111111111", remaining_amount: 450, idempotent_replay: false }
      });
    });

    expect(await screen.findByText("Vom Server bestätigt")).toBeTruthy();
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
