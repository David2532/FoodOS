/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InventoryItem } from "@/lib/types";

const outbox = vi.hoisted(() => ({
  discardRejectedOperation: vi.fn(),
  getDurableOperationStatus: vi.fn(),
  reconcileUncertainOperation: vi.fn(),
  submitDurableRpc: vi.fn(),
  subscribeToOutbox: vi.fn(),
  subscribeToOperationOutcome: vi.fn()
}));

vi.mock("@/infrastructure/offline-outbox", () => outbox);

import { InventoryView } from "./inventory-view";

const savedBatch: InventoryItem = {
  id: "11111111-1111-4111-8111-111111111111",
  productId: "22222222-2222-4222-8222-222222222222",
  gtin: "3017624010701",
  name: "Rühls Bestes Whey",
  brand: "Rühl24",
  imageUrl: "https://images.openfoodfacts.org/images/products/301/762/401/0701/front_de.1.400.jpg",
  remainingLabel: "450 g",
  remainingAmount: 450,
  unit: "g",
  location: "Kühlschrank",
  dateKind: "best_before",
  expiryDate: "30.06.",
  daysUntilExpiry: 329,
  expiryState: "future",
  lotNumber: "LOT-42",
  personalRiskMatches: [],
  recall: { kind: "none", blocksConsumption: false, stale: false, wording: "Kein Rückrufabgleich erforderlich." },
  nutrition: { kcal100g: 380, protein100g: 75, carbs100g: 8, fat100g: 5 }
};

const householdId = "33333333-3333-4333-8333-333333333333";

function openBatch(item = savedBatch) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(item.name) }));
}

function chooseDiscard() {
  fireEvent.click(screen.getByRole("button", { name: "Weggeworfen" }));
}

describe("InventoryView", () => {
  beforeEach(() => {
    outbox.discardRejectedOperation.mockReset();
    outbox.discardRejectedOperation.mockResolvedValue(true);
    outbox.getDurableOperationStatus.mockReset();
    outbox.getDurableOperationStatus.mockResolvedValue({ status: "queued" });
    outbox.reconcileUncertainOperation.mockReset();
    outbox.reconcileUncertainOperation.mockResolvedValue({
      status: "acked",
      data: { batch_id: savedBatch.id, remaining_amount: 350, idempotent_replay: true }
    });
    outbox.submitDurableRpc.mockReset();
    outbox.subscribeToOutbox.mockReset();
    outbox.subscribeToOutbox.mockImplementation(() => () => undefined);
    outbox.subscribeToOperationOutcome.mockReset();
    outbox.subscribeToOperationOutcome.mockImplementation(() => () => undefined);
  });

  afterEach(() => cleanup());

  it("shows the persisted product image, amount, location, MHD and lot in the inventory row", () => {
    render(<InventoryView onScan={vi.fn()} items={[savedBatch]} />);

    const row = screen.getByRole("button", { name: /Rühls Bestes Whey/ });
    expect(within(row).getByText("Kühlschrank")).toBeTruthy();
    expect(within(row).getByText("Rühl24 · 450 g · Charge LOT-42")).toBeTruthy();
    expect(within(row).getByText("MHD")).toBeTruthy();
    expect(within(row).getByText("30.06.")).toBeTruthy();
    expect(row.querySelector("img")?.getAttribute("src")).toContain("front_de.1.400.jpg");
  });

  it("keeps disposal available when a past use-by date blocks consumption", async () => {
    const blockedBatch: InventoryItem = {
      ...savedBatch,
      dateKind: "use_by",
      expiryState: "past_use_by",
      expiryDate: "01.08."
    };
    const onConsumed = vi.fn();
    outbox.submitDurableRpc.mockResolvedValue({
      status: "acked",
      data: { batch_id: blockedBatch.id, remaining_amount: 325, idempotent_replay: false }
    });
    render(<InventoryView onScan={vi.fn()} onConsumed={onConsumed} householdId={householdId} items={[blockedBatch]} />);

    openBatch(blockedBatch);
    expect((screen.getByRole("button", { name: "Verzehrt" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Weggeworfen" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/Wegwerfen kann weiterhin gebucht werden/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Menge wegwerfen in g"), { target: { value: "125" } });
    fireEvent.click(screen.getByRole("button", { name: "Wegwerfen verbindlich buchen" }));

    await screen.findByText("Wegwerfen bestätigt");
    expect(outbox.submitDurableRpc).toHaveBeenCalledWith(expect.objectContaining({
      kind: "inventory.discard_batch",
      rpc: "discard_inventory_batch",
      householdId,
      args: expect.objectContaining({
        target_batch: blockedBatch.id,
        discarded_amount: 125
      })
    }));
    expect(outbox.submitDurableRpc.mock.calls[0]?.[0].args.mutation_id).toBe(outbox.submitDurableRpc.mock.calls[0]?.[0].operationId);
    expect(onConsumed).toHaveBeenCalledOnce();
  });

  it("books the full remaining amount without inventing a replacement value", async () => {
    const onConsumed = vi.fn();
    outbox.submitDurableRpc.mockResolvedValue({
      status: "acked",
      data: { batch_id: savedBatch.id, remaining_amount: 0, idempotent_replay: false }
    });
    const view = render(<InventoryView onScan={vi.fn()} onConsumed={onConsumed} householdId={householdId} items={[savedBatch]} />);

    openBatch();
    chooseDiscard();
    fireEvent.click(screen.getByRole("button", { name: "Gesamte Restmenge" }));
    expect((screen.getByLabelText("Menge wegwerfen in g") as HTMLInputElement).value).toBe("450");
    fireEvent.click(screen.getByRole("button", { name: "Wegwerfen verbindlich buchen" }));

    const successCopy = await screen.findByText(/vollständig aus dem Bestand entfernt/);
    const successStatus = successCopy.closest('[role="status"]');
    expect(successStatus).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(successStatus));
    view.rerender(<InventoryView onScan={vi.fn()} onConsumed={onConsumed} householdId={householdId} items={[]} />);
    expect(outbox.submitDurableRpc.mock.calls[0]?.[0].args.discarded_amount).toBe(450);
    expect(onConsumed).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: new RegExp(savedBatch.name) })).toBeNull();
    expect(document.activeElement).toBe(successStatus);
  });

  it("shows a durable queued state and refreshes exactly once after a later strict acknowledgement", async () => {
    let outcomeListener: ((outcome: unknown) => void) | undefined;
    const unsubscribeOutcome = vi.fn();
    const unsubscribeOutbox = vi.fn();
    const onConsumed = vi.fn();
    outbox.submitDurableRpc.mockResolvedValue({ status: "queued" });
    outbox.subscribeToOperationOutcome.mockImplementation((_operationId, listener) => {
      outcomeListener = listener;
      return unsubscribeOutcome;
    });
    outbox.subscribeToOutbox.mockReturnValue(unsubscribeOutbox);
    render(<InventoryView onScan={vi.fn()} onConsumed={onConsumed} householdId={householdId} items={[savedBatch]} />);

    openBatch();
    chooseDiscard();
    fireEvent.change(screen.getByLabelText("Menge wegwerfen in g"), { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: "Wegwerfen verbindlich buchen" }));
    await screen.findByText("Auf diesem Gerät gespeichert");
    expect((screen.getByLabelText("Menge wegwerfen in g") as HTMLInputElement).value).toBe("75");
    expect((screen.getByRole("button", { name: "Bestandsaktion schließen" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: new RegExp(savedBatch.name) }) as HTMLButtonElement).disabled).toBe(false);
    expect(onConsumed).not.toHaveBeenCalled();
    const operationId = outbox.submitDurableRpc.mock.calls[0]?.[0].operationId;

    await waitFor(() => expect(outcomeListener).toBeTypeOf("function"));
    const acknowledgement = {
      operationId,
      status: "acked",
      data: { batch_id: savedBatch.id, remaining_amount: 375, idempotent_replay: false }
    };
    await act(async () => {
      outcomeListener?.(acknowledgement);
      outcomeListener?.(acknowledgement);
    });

    expect(await screen.findByText("Wegwerfen bestätigt")).toBeTruthy();
    expect(screen.getByText("Restbestand: 375 g.")).toBeTruthy();
    expect(onConsumed).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(unsubscribeOutcome).toHaveBeenCalledOnce();
      expect(unsubscribeOutbox).toHaveBeenCalledOnce();
    });
  });

  it("preserves the amount after a queued rejection and retries with a fresh operation id", async () => {
    let outcomeListener: ((outcome: unknown) => void) | undefined;
    const onConsumed = vi.fn();
    outbox.submitDurableRpc
      .mockResolvedValueOnce({ status: "queued" })
      .mockResolvedValueOnce({
        status: "acked",
        data: { batch_id: savedBatch.id, remaining_amount: 350, idempotent_replay: false }
      });
    outbox.subscribeToOperationOutcome.mockImplementation((_operationId, listener) => {
      outcomeListener = listener;
      return () => undefined;
    });
    render(<InventoryView onScan={vi.fn()} onConsumed={onConsumed} householdId={householdId} items={[savedBatch]} />);

    openBatch();
    chooseDiscard();
    fireEvent.change(screen.getByLabelText("Menge wegwerfen in g"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Wegwerfen verbindlich buchen" }));
    await screen.findByText("Auf diesem Gerät gespeichert");
    const rejectedOperationId = outbox.submitDurableRpc.mock.calls[0]?.[0].operationId;

    await act(async () => outcomeListener?.({
      operationId: rejectedOperationId,
      status: "rejected",
      reason: "server_rejected",
      message: "Der Server hat diese Änderung abgelehnt."
    }));
    await screen.findByText("Wegwerfen abgelehnt.");
    expect((screen.getByLabelText("Menge wegwerfen in g") as HTMLInputElement).value).toBe("100");
    fireEvent.click(screen.getByRole("button", { name: "Erneut sicher buchen" }));

    await screen.findByText("Wegwerfen bestätigt");
    expect(outbox.submitDurableRpc.mock.calls[1]?.[0].operationId).not.toBe(rejectedOperationId);
    expect(outbox.discardRejectedOperation).toHaveBeenCalledWith(rejectedOperationId);
    expect(onConsumed).toHaveBeenCalledOnce();
  });

  it("preserves the amount when secure local persistence fails", async () => {
    outbox.submitDurableRpc.mockRejectedValue(new Error("indexed-db-unavailable"));
    render(<InventoryView onScan={vi.fn()} onConsumed={vi.fn()} householdId={householdId} items={[savedBatch]} />);

    openBatch();
    chooseDiscard();
    fireEvent.change(screen.getByLabelText("Menge wegwerfen in g"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Wegwerfen verbindlich buchen" }));

    await screen.findByText("Wegwerfen nicht gespeichert.");
    expect((screen.getByLabelText("Menge wegwerfen in g") as HTMLInputElement).value).toBe("90");
    expect(screen.getByRole("button", { name: "Erneut sicher buchen" })).toBeTruthy();
  });

  it("prevents a second inventory action while consumption is still saving", async () => {
    let acknowledgeConsumption: ((value: unknown) => void) | undefined;
    outbox.submitDurableRpc.mockImplementation(() => new Promise((resolve) => {
      acknowledgeConsumption = resolve;
    }));
    const onConsumed = vi.fn();
    render(<InventoryView onScan={vi.fn()} onConsumed={onConsumed} householdId={householdId} items={[savedBatch]} />);

    openBatch();
    fireEvent.click(screen.getByRole("button", { name: "Portion verbindlich buchen" }));
    await screen.findByText("Wird gebucht …");

    expect((screen.getByRole("button", { name: "Weggeworfen" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Bestandsaktion schließen" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: new RegExp(savedBatch.name) }) as HTMLButtonElement).disabled).toBe(true);
    expect(outbox.submitDurableRpc).toHaveBeenCalledOnce();

    await act(async () => acknowledgeConsumption?.({
      status: "acked",
      data: { batch_id: savedBatch.id, remaining_amount: 350, idempotent_replay: false }
    }));
    await waitFor(() => expect(onConsumed).toHaveBeenCalledOnce());
  });

  it("keeps an unknown acknowledgement fail-closed but lets the user reload inventory", async () => {
    const onConsumed = vi.fn();
    outbox.submitDurableRpc.mockResolvedValue({
      status: "rejected",
      reason: "acknowledgement_unknown",
      message: "Die Serverbestätigung ist unvollständig."
    });
    render(<InventoryView onScan={vi.fn()} onConsumed={onConsumed} householdId={householdId} items={[savedBatch]} />);

    openBatch();
    chooseDiscard();
    fireEvent.click(screen.getByRole("button", { name: "Wegwerfen verbindlich buchen" }));

    await screen.findByText("Serverbestätigung unvollständig");
    expect(screen.queryByRole("button", { name: "Erneut sicher buchen" })).toBeNull();
    expect((screen.getByRole("button", { name: "Bestandsaktion schließen" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Verzehrt" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Weggeworfen" }) as HTMLButtonElement).disabled).toBe(true);
    const uncertainOperationId = outbox.submitDurableRpc.mock.calls[0]?.[0].operationId;
    fireEvent.click(screen.getByRole("button", { name: "Sicher abgleichen" }));

    await screen.findByText("Wegwerfen bestätigt");
    expect(outbox.reconcileUncertainOperation).toHaveBeenCalledWith(uncertainOperationId);
    expect(onConsumed).toHaveBeenCalledOnce();
    expect(outbox.submitDurableRpc).toHaveBeenCalledOnce();
  });

  it("accepts a strict acknowledgement from another tab while the panel is uncertain", async () => {
    let outcomeListener: ((outcome: unknown) => void) | undefined;
    const onConsumed = vi.fn();
    outbox.submitDurableRpc.mockResolvedValue({
      status: "rejected",
      reason: "acknowledgement_unknown",
      message: "Die Serverbestätigung ist unvollständig."
    });
    outbox.subscribeToOperationOutcome.mockImplementation((_operationId, listener) => {
      outcomeListener = listener;
      return () => undefined;
    });
    render(<InventoryView onScan={vi.fn()} onConsumed={onConsumed} householdId={householdId} items={[savedBatch]} />);

    openBatch();
    chooseDiscard();
    fireEvent.change(screen.getByLabelText("Menge wegwerfen in g"), { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: "Wegwerfen verbindlich buchen" }));

    await screen.findByText("Serverbestätigung unvollständig");
    await waitFor(() => expect(outcomeListener).toBeTypeOf("function"));
    const operationId = outbox.submitDurableRpc.mock.calls[0]?.[0].operationId;
    await act(async () => outcomeListener?.({
      operationId,
      status: "acked",
      data: { batch_id: savedBatch.id, remaining_amount: 375, idempotent_replay: true }
    }));

    expect(await screen.findByText("Wegwerfen bestätigt")).toBeTruthy();
    expect(screen.getByText("Restbestand: 375 g.")).toBeTruthy();
    expect(onConsumed).toHaveBeenCalledOnce();
    expect(outbox.reconcileUncertainOperation).not.toHaveBeenCalled();
  });

  it("keeps listening after a queued send becomes uncertain and accepts the later strict acknowledgement", async () => {
    let outcomeListener: ((outcome: unknown) => void) | undefined;
    const onConsumed = vi.fn();
    outbox.submitDurableRpc.mockResolvedValue({ status: "queued" });
    outbox.subscribeToOperationOutcome.mockImplementation((_operationId, listener) => {
      outcomeListener = listener;
      return () => undefined;
    });
    render(<InventoryView onScan={vi.fn()} onConsumed={onConsumed} householdId={householdId} items={[savedBatch]} />);

    openBatch();
    chooseDiscard();
    fireEvent.click(screen.getByRole("button", { name: "Wegwerfen verbindlich buchen" }));
    await screen.findByText("Auf diesem Gerät gespeichert");
    await waitFor(() => expect(outcomeListener).toBeTypeOf("function"));
    const operationId = outbox.submitDurableRpc.mock.calls[0]?.[0].operationId;

    await act(async () => outcomeListener?.({
      operationId,
      status: "rejected",
      reason: "acknowledgement_unknown",
      message: "Die Serverbestätigung ist unvollständig."
    }));
    await screen.findByText("Serverbestätigung unvollständig");
    await act(async () => outcomeListener?.({
      operationId,
      status: "acked",
      data: { batch_id: savedBatch.id, remaining_amount: 350, idempotent_replay: true }
    }));

    expect(await screen.findByText("Wegwerfen bestätigt")).toBeTruthy();
    expect(onConsumed).toHaveBeenCalledOnce();
  });

  it("does not let a stale reconciliation result overwrite a concurrent strict acknowledgement", async () => {
    let outcomeListener: ((outcome: unknown) => void) | undefined;
    let finishReconciliation: ((value: unknown) => void) | undefined;
    const onConsumed = vi.fn();
    outbox.submitDurableRpc.mockResolvedValue({
      status: "rejected",
      reason: "acknowledgement_unknown",
      message: "Die Serverbestätigung ist unvollständig."
    });
    outbox.reconcileUncertainOperation.mockImplementation(() => new Promise((resolve) => {
      finishReconciliation = resolve;
    }));
    outbox.subscribeToOperationOutcome.mockImplementation((_operationId, listener) => {
      outcomeListener = listener;
      return () => undefined;
    });
    render(<InventoryView onScan={vi.fn()} onConsumed={onConsumed} householdId={householdId} items={[savedBatch]} />);

    openBatch();
    chooseDiscard();
    fireEvent.click(screen.getByRole("button", { name: "Wegwerfen verbindlich buchen" }));
    await screen.findByText("Serverbestätigung unvollständig");
    const operationId = outbox.submitDurableRpc.mock.calls[0]?.[0].operationId;
    fireEvent.click(screen.getByRole("button", { name: "Sicher abgleichen" }));
    await screen.findByText("Wird sicher abgeglichen");

    await act(async () => outcomeListener?.({
      operationId,
      status: "acked",
      data: { batch_id: savedBatch.id, remaining_amount: 350, idempotent_replay: true }
    }));
    await act(async () => finishReconciliation?.({ status: "queued" }));

    expect(await screen.findByText("Wegwerfen bestätigt")).toBeTruthy();
    expect(screen.queryByText("Auf diesem Gerät gespeichert")).toBeNull();
    expect(onConsumed).toHaveBeenCalledOnce();
  });

  it("keeps a pending reconciliation locked when a delayed unknown outcome arrives", async () => {
    let outcomeListener: ((outcome: unknown) => void) | undefined;
    let finishReconciliation: ((value: unknown) => void) | undefined;
    const onConsumed = vi.fn();
    outbox.submitDurableRpc.mockResolvedValue({
      status: "rejected",
      reason: "acknowledgement_unknown",
      message: "Die Serverbestätigung ist unvollständig."
    });
    outbox.reconcileUncertainOperation.mockImplementation(() => new Promise((resolve) => {
      finishReconciliation = resolve;
    }));
    outbox.subscribeToOperationOutcome.mockImplementation((_operationId, listener) => {
      outcomeListener = listener;
      return () => undefined;
    });
    render(<InventoryView onScan={vi.fn()} onConsumed={onConsumed} householdId={householdId} items={[savedBatch]} />);

    openBatch();
    chooseDiscard();
    fireEvent.click(screen.getByRole("button", { name: "Wegwerfen verbindlich buchen" }));
    await screen.findByText("Serverbestätigung unvollständig");
    const operationId = outbox.submitDurableRpc.mock.calls[0]?.[0].operationId;
    fireEvent.click(screen.getByRole("button", { name: "Sicher abgleichen" }));
    await screen.findByText("Wird sicher abgeglichen");

    await act(async () => outcomeListener?.({
      operationId,
      status: "rejected",
      reason: "acknowledgement_unknown",
      message: "Die Serverbestätigung ist unvollständig."
    }));
    expect(screen.getByText("Wird sicher abgeglichen")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Bestandsaktion schließen" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finishReconciliation?.({
      status: "acked",
      data: { batch_id: savedBatch.id, remaining_amount: 350, idempotent_replay: true }
    }));

    expect(await screen.findByText("Wegwerfen bestätigt")).toBeTruthy();
    expect(onConsumed).toHaveBeenCalledOnce();
  });

  it("moves focus into the action panel and returns it to the inventory row on close", async () => {
    render(<InventoryView onScan={vi.fn()} onConsumed={vi.fn()} householdId={householdId} items={[savedBatch]} />);

    const row = screen.getByRole("button", { name: new RegExp(savedBatch.name) });
    fireEvent.click(row);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: savedBatch.name })));
    expect(row.getAttribute("aria-controls")).toBe(`inventory-action-${savedBatch.id}`);

    fireEvent.click(screen.getByRole("button", { name: "Bestandsaktion schließen" }));
    await waitFor(() => expect(document.activeElement).toBe(row));
  });

  it("explains why piece inventory cannot be booked as consumption", () => {
    const pieceBatch = { ...savedBatch, remainingAmount: 3, remainingLabel: "3 Stück", unit: "piece" as const };
    render(<InventoryView onScan={vi.fn()} onConsumed={vi.fn()} householdId={householdId} items={[pieceBatch]} />);

    openBatch(pieceBatch);
    const consumptionButton = screen.getByRole("button", { name: "Verzehrt" });
    expect((consumptionButton as HTMLButtonElement).disabled).toBe(true);
    expect(consumptionButton.getAttribute("aria-describedby")).toBe(`piece-consumption-note-${pieceBatch.id}`);
    expect(screen.getByText(/brauchen für eine Verzehrbuchung zuerst ein bestätigtes Gewicht/)).toBeTruthy();
  });
});
