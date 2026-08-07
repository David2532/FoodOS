/** @vitest-environment jsdom */

import { webcrypto } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  classifyHouseholdAccessDenial,
  createOperationOutcomeBroadcastMessage,
  emitSanitizedTerminalProviderRejection,
  failClosedInterruptedSendingOperation,
  isOperationEligibleForAutomaticSend,
  isOperationUserDiscardable,
  isRecoverableAal2Failure,
  OFFLINE_OUTBOX_DB_VERSION,
  operationClaimDecision,
  operationAfterExplicitReconciliation,
  operationQueueAdmission,
  OUTBOX_OPERATION_RESULT_EVENT,
  outboxPayloadHash,
  purgeStoredOperationsWhere,
  resolveSuccessfulRpcAcknowledgement,
  subscribeToOperationOutcome
} from "./offline-outbox";

const originalBroadcastChannel = globalThis.BroadcastChannel;

class FakeBroadcastChannel {
  static latest: FakeBroadcastChannel | null = null;
  readonly name: string;
  readonly postMessage = vi.fn();
  private readonly messageListeners = new Set<(event: MessageEvent<unknown>) => void>();

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.latest = this;
  }

  addEventListener(type: string, listener: (event: MessageEvent<unknown>) => void) {
    if (type === "message") this.messageListeners.add(listener);
  }

  emitFromOtherTab(data: unknown) {
    for (const listener of this.messageListeners) listener({ data } as MessageEvent<unknown>);
  }
}

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, value: FakeBroadcastChannel });
});

afterAll(() => {
  Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, value: originalBroadcastChannel });
});

describe("offline outbox payload identity", () => {
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
  it("keeps only exact AAL2 failures recoverable before any inventory retry", () => {
    expect(isRecoverableAal2Failure("AAL2 required")).toBe(true);
    expect(isRecoverableAal2Failure("FOODOS_AAL2_REQUIRED")).toBe(true);
    expect(isRecoverableAal2Failure("AAL2 required after inventory mutation")).toBe(false);
    expect(isRecoverableAal2Failure("server rejected")).toBe(false);
  });

  it("requeues an uncertain operation only after explicit mutation-bound reconciliation", () => {
    const uncertain = {
      state: "UNCERTAIN" as const,
      nextAttemptAt: 0,
      safeError: "acknowledgement_unknown",
      claimId: undefined,
      claimExpiresAt: undefined
    };
    expect(operationAfterExplicitReconciliation(uncertain)).toEqual({
      state: "QUEUED",
      nextAttemptAt: 0,
      safeError: "user_reconciliation",
      claimId: undefined,
      claimExpiresAt: undefined
    });
    expect(operationAfterExplicitReconciliation({ ...uncertain, state: "REJECTED" as const })).toBeNull();
    expect(operationAfterExplicitReconciliation({ ...uncertain, state: "QUEUED" as const })).toBeNull();
  });

  it("retains a malformed purchase acknowledgement as terminal and non-discardable", () => {
    const acknowledgement = resolveSuccessfulRpcAcknowledgement(
      "inventory.commit_purchase",
      { item_count: 2, batch_ids: [], product_ids: [], idempotent_replay: false },
      { capture_items: [{}, {}] }
    );

    expect(acknowledgement).toMatchObject({
      disposition: "retain_uncertain",
      result: { status: "rejected", reason: "acknowledgement_unknown" }
    });
    expect(isOperationEligibleForAutomaticSend({ state: "UNCERTAIN", nextAttemptAt: 0 }, Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(isOperationUserDiscardable({ state: "UNCERTAIN" })).toBe(false);
  });

  it("deletes a purchase operation only after the acknowledgement schema passes", () => {
    const acknowledgement = resolveSuccessfulRpcAcknowledgement(
      "inventory.commit_purchase",
      {
        item_count: 1,
        batch_ids: ["11111111-1111-4111-8111-111111111111"],
        product_ids: ["22222222-2222-4222-8222-222222222222"],
        idempotent_replay: false
      },
      { capture_items: [{}] }
    );

    expect(acknowledgement).toEqual({
      disposition: "delete",
      result: {
        status: "acked",
        data: {
          item_count: 1,
          batch_ids: ["11111111-1111-4111-8111-111111111111"],
          product_ids: ["22222222-2222-4222-8222-222222222222"],
          idempotent_replay: false
        }
      }
    });
  });

  it("retains a valid-shaped acknowledgement when it does not match the requested purchase", () => {
    const acknowledgement = resolveSuccessfulRpcAcknowledgement(
      "inventory.commit_purchase",
      {
        item_count: 1,
        batch_ids: ["11111111-1111-4111-8111-111111111111"],
        product_ids: ["22222222-2222-4222-8222-222222222222"],
        idempotent_replay: false
      },
      { capture_items: [{}, {}] }
    );

    expect(acknowledgement).toMatchObject({
      disposition: "retain_uncertain",
      result: { reason: "acknowledgement_unknown" }
    });
  });

  it("deletes a discard operation only after a strict matching acknowledgement", () => {
    const acknowledgement = resolveSuccessfulRpcAcknowledgement(
      "inventory.discard_batch",
      {
        batch_id: "11111111-1111-4111-8111-111111111111",
        remaining_amount: 325,
        idempotent_replay: false
      },
      { target_batch: "11111111-1111-4111-8111-111111111111" }
    );

    expect(acknowledgement).toEqual({
      disposition: "delete",
      result: {
        status: "acked",
        data: {
          batch_id: "11111111-1111-4111-8111-111111111111",
          remaining_amount: 325,
          idempotent_replay: false
        }
      }
    });
  });

  it.each([
    [{ batch_id: "11111111-1111-4111-8111-111111111111", remaining_amount: 325, idempotent_replay: false, secret: "no" }],
    [{ batch_id: "22222222-2222-4222-8222-222222222222", remaining_amount: 325, idempotent_replay: false }],
    [{ batch_id: "11111111-1111-4111-8111-111111111111", remaining_amount: null, idempotent_replay: false }],
    [{ batch_id: "11111111-1111-4111-8111-111111111111", remaining_amount: false, idempotent_replay: false }],
    [{ batch_id: "11111111-1111-4111-8111-111111111111", remaining_amount: "325", idempotent_replay: false }]
  ])("retains an untrusted or mismatched discard acknowledgement", (data) => {
    expect(resolveSuccessfulRpcAcknowledgement(
      "inventory.discard_batch",
      data,
      { target_batch: "11111111-1111-4111-8111-111111111111" }
    )).toMatchObject({
      disposition: "retain_uncertain",
      result: { status: "rejected", reason: "acknowledgement_unknown" }
    });
  });

  it("claims only due queued operations and fails interrupted sends closed", () => {
    const now = 1_000;
    expect(operationClaimDecision({ state: "QUEUED", nextAttemptAt: now, claimExpiresAt: undefined }, now)).toBe("claim");
    expect(operationClaimDecision({ state: "QUEUED", nextAttemptAt: now + 1, claimExpiresAt: undefined }, now)).toBe("not_due");
    expect(operationClaimDecision({ state: "SENDING", nextAttemptAt: 0, claimExpiresAt: now + 1 }, now)).toBe("busy");
    expect(operationClaimDecision({ state: "SENDING", nextAttemptAt: 0, claimExpiresAt: now }, now)).toBe("uncertain");
    expect(operationClaimDecision({ state: "SENDING", nextAttemptAt: 0, claimExpiresAt: undefined }, now)).toBe("uncertain");
    expect(isOperationEligibleForAutomaticSend({ state: "SENDING", nextAttemptAt: 0, claimExpiresAt: now + 1 }, now)).toBe(false);

    expect(failClosedInterruptedSendingOperation({
      state: "SENDING" as const,
      nextAttemptAt: 99,
      safeError: "transport_unavailable",
      claimId: "claim-a",
      claimExpiresAt: 100
    })).toEqual({
      state: "UNCERTAIN",
      nextAttemptAt: 0,
      safeError: "send_interrupted",
      claimId: undefined,
      claimExpiresAt: undefined
    });
  });

  it("uses the version-2 fail-closed rollback boundary and checks existing IDs before capacity", () => {
    expect(OFFLINE_OUTBOX_DB_VERSION).toBe(2);
    expect(operationQueueAdmission(true, 100)).toBe("existing");
    expect(operationQueueAdmission(false, 100)).toBe("full");
    expect(operationQueueAdmission(false, 99)).toBe("store");
  });

  it("preserves acknowledgement behavior for unrelated operation kinds", () => {
    const data = { batch_id: "not-validated-by-the-purchase-contract" };
    expect(resolveSuccessfulRpcAcknowledgement("inventory.add_batch", data)).toEqual({
      disposition: "delete",
      result: { status: "acked", data }
    });
  });

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

  it("never exposes a non-retryable provider error in the same-tab result or outcome event", () => {
    const operationId = "operation-provider-rejection";
    const providerMessage = "provider token=must-not-leave-the-infrastructure-boundary";
    const listener = vi.fn();
    const unsubscribe = subscribeToOperationOutcome(operationId, listener);

    const result = emitSanitizedTerminalProviderRejection(operationId, providerMessage);

    expect(result).toEqual({
      status: "rejected",
      reason: "server_rejected",
      message: "Der Server hat diese \u00c4nderung abgelehnt."
    });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ operationId, ...result });
    expect(JSON.stringify({ result, localOutcome: listener.mock.calls })).not.toContain(providerMessage);
    unsubscribe();
  });

  it("forwards a strict purchase ACK across tabs without operation secrets", () => {
    const operationId = "11111111-1111-4111-8111-111111111111";
    const message = createOperationOutcomeBroadcastMessage({
      operationId,
      status: "acked",
      data: {
        item_count: 1,
        batch_ids: ["22222222-2222-4222-8222-222222222222"],
        product_ids: ["33333333-3333-4333-8333-333333333333"],
        idempotent_replay: false
      }
    });
    const listener = vi.fn();
    const unsubscribe = subscribeToOperationOutcome(operationId, listener);

    expect(message).toEqual({
      type: "operation-outcome",
      outcome: {
        operationId,
        status: "acked",
        data: {
          item_count: 1,
          batch_ids: ["22222222-2222-4222-8222-222222222222"],
          product_ids: ["33333333-3333-4333-8333-333333333333"],
          idempotent_replay: false
        }
      }
    });
    expect(JSON.stringify(message)).not.toMatch(/capture_items|ciphertext|payloadSha256|secret/i);

    expect(FakeBroadcastChannel.latest?.name).toBe("foodos:outbox-change-v1");
    FakeBroadcastChannel.latest?.emitFromOtherTab(message);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(message?.outcome);
    unsubscribe();
  });

  it("forwards a strict discard ACK across tabs without operation secrets", () => {
    const operationId = "44444444-4444-4444-8444-444444444444";
    const message = createOperationOutcomeBroadcastMessage({
      operationId,
      status: "acked",
      data: {
        batch_id: "11111111-1111-4111-8111-111111111111",
        remaining_amount: 325,
        idempotent_replay: false
      }
    });
    const listener = vi.fn();
    const unsubscribe = subscribeToOperationOutcome(operationId, listener);

    expect(message).toEqual({
      type: "operation-outcome",
      outcome: {
        operationId,
        status: "acked",
        data: {
          batch_id: "11111111-1111-4111-8111-111111111111",
          remaining_amount: 325,
          idempotent_replay: false
        }
      }
    });
    expect(JSON.stringify(message)).not.toMatch(/target_batch|discarded_amount|ciphertext|payloadSha256|secret/i);

    FakeBroadcastChannel.latest?.emitFromOtherTab(message);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(message?.outcome);
    unsubscribe();
  });

  it("drops secret-bearing ACK data and replaces remote rejection text", () => {
    const operationId = "11111111-1111-4111-8111-111111111111";
    expect(createOperationOutcomeBroadcastMessage({
      operationId,
      status: "acked",
      data: {
        item_count: 1,
        batch_ids: ["22222222-2222-4222-8222-222222222222"],
        product_ids: ["33333333-3333-4333-8333-333333333333"],
        idempotent_replay: false,
        capture_items: [{ secret: "must-not-cross-tabs" }]
      }
    })).toBeNull();

    expect(createOperationOutcomeBroadcastMessage({
      operationId,
      status: "acked",
      data: {
        batch_id: "22222222-2222-4222-8222-222222222222",
        remaining_amount: 0,
        idempotent_replay: false,
        discarded_amount: 450
      }
    })).toBeNull();

    const rejection = createOperationOutcomeBroadcastMessage({
      operationId,
      status: "rejected",
      reason: "server_rejected",
      message: "provider token=must-not-cross-tabs"
    });
    expect(rejection).toEqual({
      type: "operation-outcome",
      outcome: {
        operationId,
        status: "rejected",
        reason: "server_rejected",
        message: "Der Server hat diese \u00c4nderung abgelehnt."
      }
    });
    expect(JSON.stringify(rejection)).not.toContain("must-not-cross-tabs");
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
