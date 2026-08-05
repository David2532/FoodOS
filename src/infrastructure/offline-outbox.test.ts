/** @vitest-environment jsdom */

import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  OUTBOX_OPERATION_RESULT_EVENT,
  outboxPayloadHash,
  subscribeToOperationOutcome
} from "./offline-outbox";

describe("offline outbox payload identity", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  });

  it("hashes the complete operation identity canonically for schema version 2", async () => {
    const first = await outboxPayloadHash({
      rpc: "add_inventory_batch",
      householdId: "household-a",
      args: { mutation_id: "mutation-a", batch_payload: { amount: 450, unit: "g" } }
    });
    const reordered = await outboxPayloadHash({
      rpc: "add_inventory_batch",
      householdId: "household-a",
      args: { batch_payload: { unit: "g", amount: 450 }, mutation_id: "mutation-a" }
    });
    const changedHousehold = await outboxPayloadHash({
      rpc: "add_inventory_batch",
      householdId: "household-b",
      args: { mutation_id: "mutation-a", batch_payload: { amount: 450, unit: "g" } }
    });
    const changedRpc = await outboxPayloadHash({
      rpc: "consume_inventory_batch_v2",
      householdId: "household-a",
      args: { mutation_id: "mutation-a", batch_payload: { amount: 450, unit: "g" } }
    });
    const changedPayload = await outboxPayloadHash({
      rpc: "add_inventory_batch",
      householdId: "household-a",
      args: { mutation_id: "mutation-a", batch_payload: { amount: 451, unit: "g" } }
    });

    expect(reordered).toBe(first);
    expect(changedHousehold).not.toBe(first);
    expect(changedRpc).not.toBe(first);
    expect(changedPayload).not.toBe(first);
  });

  it("keeps the legacy schema-1 payload hash compatible", async () => {
    const first = await outboxPayloadHash({ rpc: "first_rpc", householdId: "household-a", args: { amount: 450 } }, 1);
    const sameLegacyPayload = await outboxPayloadHash({ rpc: "other_rpc", householdId: "household-b", args: { amount: 450 } }, 1);

    expect(sameLegacyPayload).toBe(first);
  });
});

describe("offline outbox operation outcomes", () => {
  it("delivers only the subscribed operation result and can unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToOperationOutcome("operation-a", listener);

    globalThis.dispatchEvent(new CustomEvent(OUTBOX_OPERATION_RESULT_EVENT, {
      detail: { operationId: "operation-b", status: "acked", data: { batch_id: "batch-b" } }
    }));
    globalThis.dispatchEvent(new CustomEvent(OUTBOX_OPERATION_RESULT_EVENT, {
      detail: { operationId: "operation-a", status: "rejected", message: "Abgelehnt", reason: "server_rejected" }
    }));

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ operationId: "operation-a", status: "rejected" }));

    unsubscribe();
    globalThis.dispatchEvent(new CustomEvent(OUTBOX_OPERATION_RESULT_EVENT, {
      detail: { operationId: "operation-a", status: "acked", data: { batch_id: "batch-a" } }
    }));
    expect(listener).toHaveBeenCalledOnce();
  });
});
