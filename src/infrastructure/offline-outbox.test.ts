/** @vitest-environment jsdom */

import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  classifyHouseholdAccessDenial,
  OUTBOX_OPERATION_RESULT_EVENT,
  outboxPayloadHash,
  purgeStoredOperationsWhere,
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

describe("household-scoped offline purge", () => {
  it("preserves the household queue when only a stale resource is denied", async () => {
    const loadAuthorizedHouseholdIds = vi.fn(async () => ["household-active"]);

    await expect(classifyHouseholdAccessDenial({
      providerMessage: "Meal plan access denied",
      targetHouseholdId: "household-active",
      loadAuthorizedHouseholdIds
    })).resolves.toBe("reject-resource");
    expect(loadAuthorizedHouseholdIds).toHaveBeenCalledOnce();
  });

  it("purges the target household only after successful absence revalidation", async () => {
    await expect(classifyHouseholdAccessDenial({
      providerMessage: "Shopping item access denied",
      targetHouseholdId: "household-removed",
      loadAuthorizedHouseholdIds: async () => ["household-active"]
    })).resolves.toBe("purge-household");
  });

  it("does not purge when live membership revalidation fails", async () => {
    await expect(classifyHouseholdAccessDenial({
      providerMessage: "Batch access denied",
      targetHouseholdId: "household-unknown",
      loadAuthorizedHouseholdIds: async () => { throw new Error("AAL2 session expired"); }
    })).resolves.toBe("revalidation-failed");
  });

  it("deletes every readable target operation and preserves other household queues", async () => {
    const operations = [
      { id: "a-1", householdId: "household-a" },
      { id: "b-1", householdId: "household-b" },
      { id: "a-2", householdId: "household-a" },
      { id: "corrupt", householdId: "unreadable" }
    ];
    const deleteByIds = vi.fn(async () => undefined);

    const result = await purgeStoredOperationsWhere({
      operations,
      householdIdFor: async (operation) => {
        if (operation.id === "corrupt") throw new Error("ciphertext unreadable");
        return operation.householdId;
      },
      shouldPurge: (householdId) => householdId === "household-a",
      deleteByIds
    });

    expect(deleteByIds).toHaveBeenCalledWith(["a-1", "a-2"]);
    expect(result).toEqual({ purged: 2, preserved: 1, unreadable: 1 });
  });

  it("reconciles inactive households without deleting any active household queue", async () => {
    const operations = [
      { id: "active-1", householdId: "household-active" },
      { id: "removed-1", householdId: "household-removed" }
    ];
    const deleteByIds = vi.fn(async () => undefined);
    const active = new Set(["household-active"]);

    const result = await purgeStoredOperationsWhere({
      operations,
      householdIdFor: async (operation) => operation.householdId,
      shouldPurge: (householdId) => !active.has(householdId),
      deleteByIds
    });

    expect(deleteByIds).toHaveBeenCalledWith(["removed-1"]);
    expect(result).toEqual({ purged: 1, preserved: 1, unreadable: 0 });
  });
});
