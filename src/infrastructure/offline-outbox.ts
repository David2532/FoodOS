"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAllowedOfflineRpc,
  isRetryableTransportFailure,
  nextRetryDelayMs,
  OFFLINE_QUEUE_CAP,
  type OfflineOperationKind,
  type OfflineOperationState
} from "@/domain/offline-outbox";
import { discardBatchResultSchema } from "@/contracts/inventory";
import { purchaseCaptureResultSchema } from "@/contracts/purchase-capture";
import { isHouseholdAccessDenied } from "@/domain/household-membership";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const DB_NAME = "foodos-device-v1";
export const OFFLINE_OUTBOX_DB_VERSION = 2;
const OPERATIONS = "operations";
const METADATA = "metadata";
const OUTBOX_EVENT = "foodos:outbox-change";
export const OUTBOX_OPERATION_RESULT_EVENT = "foodos:outbox-operation-result";
const OUTBOX_BROADCAST_CHANNEL = "foodos:outbox-change-v1";
const OUTBOX_CLAIM_LEASE_MS = 120_000;
const OFFLINE_DATA_STATE_EVENT = "foodos:offline-data-state";
const OFFLINE_DATA_PURGED_KEY = "foodos:offline-data-purged-v1";
const OFFLINE_DATA_CLEANUP_OBSERVATION_MS = 1_500;

export type OfflineDataStorageState = "available" | "cleanup-pending" | "cleared";

export type OfflineDataCleanupResult =
  | { status: "cleared" }
  | { status: "pending" }
  | { status: "unconfirmed" };

interface OfflineDataCleanupAttempt {
  completion: Promise<OfflineDataCleanupResult>;
  blocked: Promise<OfflineDataCleanupResult>;
}

let offlineDataStorageStateInThisTab: OfflineDataStorageState = "available";
let activeOfflineDataCleanup: OfflineDataCleanupAttempt | null = null;
let outboxBroadcastChannel: BroadcastChannel | null = null;

interface StoredOperation {
  id: string;
  kind: OfflineOperationKind;
  schemaVersion: 1 | 2;
  state: OfflineOperationState;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
  safeError?: string;
  claimId?: string;
  claimExpiresAt?: number;
}

interface OperationSecret {
  rpc: string;
  args: Record<string, unknown>;
  householdId: string;
  actorId: string;
  deviceId: string;
  baseRevision: null;
  payloadSha256: string;
}

export interface OutboxSummary {
  queued: number;
  sending: number;
  rejected: number;
  uncertain: number;
}

export interface HouseholdScopedOfflinePurgeResult {
  purged: number;
  preserved: number;
  unreadable: number;
}

export type HouseholdAccessDenialAction = "purge-household" | "reject-resource" | "revalidation-failed";

export type DurableMutationResult<T> =
  | { status: "acked"; data: T }
  | { status: "queued" }
  | { status: "rejected"; message: string; reason: DurableMutationRejectionReason };

export type DurableMutationRejectionReason =
  | "acknowledgement_unknown"
  | "precondition"
  | "payload_conflict"
  | "operation_rejected"
  | "server_rejected";

export type DurableOperationOutcome<T> =
  | { operationId: string; status: "acked"; data: T }
  | { operationId: string; status: "rejected"; message: string; reason: DurableMutationRejectionReason };

export type SanitizedDurableOperationOutcome = DurableOperationOutcome<unknown>;

export type OutboxBroadcastMessage =
  | "change"
  | { type: "operation-outcome"; outcome: SanitizedDurableOperationOutcome };

export type DurableOperationStatus =
  | { status: "absent" }
  | { status: "queued" | "sending"; safeReason?: string }
  | { status: "uncertain"; safeReason: "acknowledgement_unknown" }
  | { status: "rejected"; safeReason: string };

type SuccessfulRpcAcknowledgement<T> =
  | { disposition: "delete"; result: { status: "acked"; data: T } }
  | {
    disposition: "retain_uncertain";
    result: {
      status: "rejected";
      message: string;
      reason: "acknowledgement_unknown";
    };
  };

const acknowledgementUnknownMessage = "Die Serverbestätigung ist unvollständig. Die Änderung kann bereits gebucht worden sein. FoodOS bewahrt den Vorgang verschlüsselt auf und sendet ihn nicht erneut, bis der Bestand abgeglichen wurde.";

export function resolveSuccessfulRpcAcknowledgement<T>(
  kind: OfflineOperationKind,
  data: unknown,
  requestArgs?: Record<string, unknown>
): SuccessfulRpcAcknowledgement<T> {
  if (kind === "inventory.commit_purchase") {
    const parsed = purchaseCaptureResultSchema.safeParse(data);
    const captureItems = requestArgs?.capture_items;
    if (
      parsed.success
      && Array.isArray(captureItems)
      && captureItems.length >= 1
      && captureItems.length <= 100
      && parsed.data.item_count === captureItems.length
    ) {
      return { disposition: "delete", result: { status: "acked", data: parsed.data as T } };
    }
  } else if (kind === "inventory.discard_batch") {
    const parsed = discardBatchResultSchema.safeParse(data);
    if (parsed.success && parsed.data.batch_id === requestArgs?.target_batch) {
      return { disposition: "delete", result: { status: "acked", data: parsed.data as T } };
    }
  } else {
    return { disposition: "delete", result: { status: "acked", data: data as T } };
  }
  return {
    disposition: "retain_uncertain",
    result: {
      status: "rejected",
      message: acknowledgementUnknownMessage,
      reason: "acknowledgement_unknown"
    }
  };
}

const sanitizedRejectionMessages: Record<DurableMutationRejectionReason, string> = {
  acknowledgement_unknown: acknowledgementUnknownMessage,
  precondition: "Die lokale \u00c4nderung konnte nicht sicher ausgef\u00fchrt werden.",
  payload_conflict: "Die Vorgangs-ID geh\u00f6rt bereits zu einer anderen \u00c4nderung.",
  operation_rejected: "Diese \u00c4nderung wurde bereits vom Server abgelehnt.",
  server_rejected: "Der Server hat diese \u00c4nderung abgelehnt."
};

function sanitizedOperationId(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) return null;
  return /^[a-z0-9._:-]+$/i.test(value) ? value : null;
}

/**
 * Creates the only outcome payload allowed across tabs. Acknowledgements are reduced
 * to one of the strict allowlisted result contracts; rejection text is replaced with
 * a fixed safe message. Encrypted args, operation secrets and raw provider errors
 * never enter the BroadcastChannel payload.
 */
export function createOperationOutcomeBroadcastMessage<T>(
  outcome: DurableOperationOutcome<T>
): Extract<OutboxBroadcastMessage, { type: "operation-outcome" }> | null {
  const operationId = sanitizedOperationId(outcome.operationId);
  if (!operationId) return null;
  if (outcome.status === "acked") {
    const purchaseAcknowledgement = purchaseCaptureResultSchema.safeParse(outcome.data);
    const discardAcknowledgement = discardBatchResultSchema.safeParse(outcome.data);
    const acknowledgement = purchaseAcknowledgement.success
      ? purchaseAcknowledgement.data
      : discardAcknowledgement.success
        ? discardAcknowledgement.data
        : null;
    if (!acknowledgement) return null;
    return {
      type: "operation-outcome",
      outcome: { operationId, status: "acked", data: acknowledgement }
    };
  }
  const safeMessage = Object.prototype.hasOwnProperty.call(sanitizedRejectionMessages, outcome.reason)
    ? sanitizedRejectionMessages[outcome.reason]
    : undefined;
  if (!safeMessage) return null;
  return {
    type: "operation-outcome",
    outcome: {
      operationId,
      status: "rejected",
      reason: outcome.reason,
      message: safeMessage
    }
  };
}

type OperationStateRecord = {
  state: OfflineOperationState;
  nextAttemptAt: number;
  safeError?: string;
  claimId?: string;
  claimExpiresAt?: number;
};

export function failClosedInterruptedSendingOperation<T extends OperationStateRecord>(operation: T): T {
  if (operation.state !== "SENDING") return operation;
  return {
    ...operation,
    state: "UNCERTAIN",
    nextAttemptAt: 0,
    safeError: "send_interrupted",
    claimId: undefined,
    claimExpiresAt: undefined
  };
}

export type OperationClaimDecision = "claim" | "not_due" | "busy" | "uncertain" | "terminal";

export function operationClaimDecision(
  operation: Pick<StoredOperation, "state" | "nextAttemptAt" | "claimExpiresAt">,
  now = Date.now()
): OperationClaimDecision {
  if (operation.state === "QUEUED") return operation.nextAttemptAt <= now ? "claim" : "not_due";
  if (operation.state === "SENDING") {
    return !operation.claimExpiresAt || operation.claimExpiresAt <= now ? "uncertain" : "busy";
  }
  return "terminal";
}

export function isOperationEligibleForAutomaticSend(
  operation: Pick<StoredOperation, "state" | "nextAttemptAt" | "claimExpiresAt">,
  now = Date.now()
): boolean {
  return operationClaimDecision(operation, now) === "claim";
}

export function isOperationUserDiscardable(operation: Pick<StoredOperation, "state">): boolean {
  return operation.state === "REJECTED";
}

export function isRecoverableAal2Failure(message: string | undefined): boolean {
  const normalized = message?.trim().toUpperCase();
  return normalized === "AAL2 REQUIRED" || normalized === "FOODOS_AAL2_REQUIRED";
}

export function operationAfterExplicitReconciliation<T extends OperationStateRecord>(operation: T): T | null {
  if (operation.state !== "UNCERTAIN") return null;
  return {
    ...operation,
    state: "QUEUED",
    nextAttemptAt: 0,
    safeError: "user_reconciliation",
    claimId: undefined,
    claimExpiresAt: undefined
  };
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("Durable browser storage unavailable");
  if (isOfflineDataPurged()) throw new Error("Offline data has been purged for this browser session");
  const request = indexedDB.open(DB_NAME, OFFLINE_OUTBOX_DB_VERSION);
  request.onupgradeneeded = (event) => {
    const db = request.result;
    if (!db.objectStoreNames.contains(OPERATIONS)) db.createObjectStore(OPERATIONS, { keyPath: "id" });
    if (!db.objectStoreNames.contains(METADATA)) db.createObjectStore(METADATA);
    if (event.oldVersion < 2) {
      const store = request.transaction?.objectStore(OPERATIONS);
      const cursorRequest = store?.openCursor();
      if (cursorRequest) {
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const operation = cursor.value as StoredOperation;
          if (operation.state === "SENDING") cursor.update(failClosedInterruptedSendingOperation(operation));
          cursor.continue();
        };
      }
    }
  };
  const db = await requestValue(request);
  // Version 2 introduces the terminal UNCERTAIN state. An old bundle opening this
  // database with version 1 receives VersionError and therefore fails closed instead
  // of treating an uncertain purchase as a discardable legacy record.
  // A delete/upgrade request from another FoodOS tab must not leave private data
  // locked in this tab. Every caller also closes in a finally block below.
  db.onversionchange = () => db.close();
  return db;
}

async function getOrCreateMetadata<T>(db: IDBDatabase, key: string, create: () => Promise<T> | T): Promise<T> {
  const read = db.transaction(METADATA, "readonly").objectStore(METADATA);
  const existing = await requestValue(read.get(key)) as T | undefined;
  if (existing !== undefined) return existing;
  const value = await create();
  const write = db.transaction(METADATA, "readwrite");
  write.objectStore(METADATA).add(value, key);
  try {
    await transactionDone(write);
    return value;
  } catch {
    const winner = await requestValue(db.transaction(METADATA, "readonly").objectStore(METADATA).get(key)) as T | undefined;
    if (winner !== undefined) return winner;
    throw new Error("Device metadata could not be initialized");
  }
}

async function encryptionKey(db: IDBDatabase): Promise<CryptoKey> {
  return getOrCreateMetadata(db, "encryption-key-v1", () => crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  ));
}

async function deviceId(db: IDBDatabase): Promise<string> {
  return getOrCreateMetadata(db, "device-id-v1", () => crypto.randomUUID());
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function outboxPayloadIdentity(input: {
  rpc: string;
  args: Record<string, unknown>;
  householdId: string;
}, schemaVersion: 1 | 2 = 2): unknown {
  return schemaVersion === 1
    ? input.args
    : { rpc: input.rpc, args: input.args, householdId: input.householdId };
}

export async function outboxPayloadHash(input: {
  rpc: string;
  args: Record<string, unknown>;
  householdId: string;
}, schemaVersion: 1 | 2 = 2): Promise<string> {
  return sha256(outboxPayloadIdentity(input, schemaVersion));
}

async function encrypt(db: IDBDatabase, value: OperationSecret): Promise<Pick<StoredOperation, "iv" | "ciphertext">> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(db),
    new TextEncoder().encode(JSON.stringify(value))
  );
  return { iv: iv.buffer, ciphertext };
}

async function decrypt(db: IDBDatabase, operation: StoredOperation): Promise<OperationSecret> {
  const cleartext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(operation.iv) },
    await encryptionKey(db),
    operation.ciphertext
  );
  return JSON.parse(new TextDecoder().decode(cleartext)) as OperationSecret;
}

function dispatchLocalOutboxChange() {
  globalThis.dispatchEvent?.(new Event(OUTBOX_EVENT));
}

function dispatchLocalOperationOutcome(outcome: SanitizedDurableOperationOutcome) {
  globalThis.dispatchEvent?.(new CustomEvent(OUTBOX_OPERATION_RESULT_EVENT, { detail: outcome }));
}

export function receiveOutboxBroadcastMessage(message: unknown): void {
  if (message === "change") {
    dispatchLocalOutboxChange();
    return;
  }
  if (!message || typeof message !== "object") return;
  const candidate = message as { type?: unknown; outcome?: unknown };
  if (candidate.type !== "operation-outcome" || !candidate.outcome || typeof candidate.outcome !== "object") return;
  const sanitized = createOperationOutcomeBroadcastMessage(
    candidate.outcome as DurableOperationOutcome<unknown>
  );
  if (sanitized) dispatchLocalOperationOutcome(sanitized.outcome);
}

function getOutboxBroadcastChannel(): BroadcastChannel | null {
  if (outboxBroadcastChannel) return outboxBroadcastChannel;
  if (typeof BroadcastChannel === "undefined") return null;
  outboxBroadcastChannel = new BroadcastChannel(OUTBOX_BROADCAST_CHANNEL);
  outboxBroadcastChannel.addEventListener("message", (event: MessageEvent<unknown>) => {
    receiveOutboxBroadcastMessage(event.data);
  });
  return outboxBroadcastChannel;
}

function emitChange() {
  dispatchLocalOutboxChange();
  getOutboxBroadcastChannel()?.postMessage("change");
}

function emitOperationOutcome<T>(outcome: DurableOperationOutcome<T>) {
  dispatchLocalOperationOutcome(outcome);
  const message = createOperationOutcomeBroadcastMessage(outcome);
  if (message) getOutboxBroadcastChannel()?.postMessage(message);
}

export function emitSanitizedTerminalProviderRejection(
  operationId: string,
  providerMessage: string
): DurableMutationResult<never> {
  // Provider diagnostics can contain implementation details or secrets. They are
  // deliberately accepted at this boundary only to make non-disclosure testable.
  void providerMessage;
  const result = {
    status: "rejected",
    message: sanitizedRejectionMessages.server_rejected,
    reason: "server_rejected"
  } as const;
  emitOperationOutcome({ operationId, ...result });
  return result;
}

function emitOfflineDataStorageState() {
  globalThis.dispatchEvent?.(new Event(OFFLINE_DATA_STATE_EVENT));
}

export function getOfflineDataStorageState(): OfflineDataStorageState {
  try {
    const marker = localStorage.getItem(OFFLINE_DATA_PURGED_KEY);
    // "1" was used by the first safe-cleanup implementation. Treat it as pending
    // instead of assuming the older request actually completed.
    offlineDataStorageStateInThisTab = marker === "cleared"
      ? "cleared"
      : marker === "pending" || marker === "1"
        ? "cleanup-pending"
        : "available";
  } catch {
    // Storage-restricted browsers cannot notify another tab, but this tab still keeps
    // its conservative state and never silently recreates the database.
  }
  return offlineDataStorageStateInThisTab;
}

function setOfflineDataStorageState(state: OfflineDataStorageState): void {
  const changed = offlineDataStorageStateInThisTab !== state;
  offlineDataStorageStateInThisTab = state;
  try {
    // This is a non-sensitive lifecycle marker, never an account or payload value.
    if (state === "available") localStorage.removeItem(OFFLINE_DATA_PURGED_KEY);
    else localStorage.setItem(OFFLINE_DATA_PURGED_KEY, state === "cleared" ? "cleared" : "pending");
  } catch {
    // The in-memory marker still prevents this tab from recreating the database.
  }
  if (changed) emitOfflineDataStorageState();
}

function isOfflineDataPurged(): boolean {
  return getOfflineDataStorageState() !== "available";
}

function allowOfflineDataForAuthenticatedMutation(): boolean {
  if (getOfflineDataStorageState() === "cleanup-pending") return false;
  // A confirmed cleanup can be followed by a new AAL2-verified offline mutation. An
  // unresolved delete request cannot be cancelled, so reopening the database while it
  // is pending could let that old request later delete newly written local data.
  setOfflineDataStorageState("available");
  return true;
}

async function allOperations(db: IDBDatabase): Promise<StoredOperation[]> {
  return requestValue(db.transaction(OPERATIONS, "readonly").objectStore(OPERATIONS).getAll());
}

async function storedOperation(db: IDBDatabase, operationId: string): Promise<StoredOperation | undefined> {
  return requestValue(db.transaction(OPERATIONS, "readonly").objectStore(OPERATIONS).get(operationId)) as Promise<StoredOperation | undefined>;
}

async function recoverInterruptedSendingOperations(db: IDBDatabase, now = Date.now()): Promise<number> {
  const transaction = db.transaction(OPERATIONS, "readwrite");
  const store = transaction.objectStore(OPERATIONS);
  const recoveredOperationIds: string[] = [];
  const request = store.getAll();
  request.onsuccess = () => {
    for (const operation of request.result as StoredOperation[]) {
      if (operationClaimDecision(operation, now) !== "uncertain") continue;
      store.put(failClosedInterruptedSendingOperation(operation));
      recoveredOperationIds.push(operation.id);
    }
  };
  await transactionDone(transaction);
  if (recoveredOperationIds.length > 0) {
    emitChange();
    for (const operationId of recoveredOperationIds) {
      emitOperationOutcome({ operationId, ...acknowledgementUnknownResult() });
    }
  }
  return recoveredOperationIds.length;
}

type EnqueueOperationResult =
  | { status: "stored"; operation: StoredOperation }
  | { status: "existing"; operation: StoredOperation }
  | { status: "full" };

export function operationQueueAdmission(hasExistingOperation: boolean, operationCount: number): "existing" | "store" | "full" {
  if (hasExistingOperation) return "existing";
  return operationCount >= OFFLINE_QUEUE_CAP ? "full" : "store";
}

async function enqueueOperationAtomically(db: IDBDatabase, candidate: StoredOperation): Promise<EnqueueOperationResult> {
  const transaction = db.transaction(OPERATIONS, "readwrite");
  const store = transaction.objectStore(OPERATIONS);
  let outcome: EnqueueOperationResult | undefined;
  const existingRequest = store.get(candidate.id);
  existingRequest.onsuccess = () => {
    const existing = existingRequest.result as StoredOperation | undefined;
    if (operationQueueAdmission(Boolean(existing), 0) === "existing" && existing) {
      outcome = { status: "existing", operation: existing };
      return;
    }
    const countRequest = store.count();
    countRequest.onsuccess = () => {
      if (operationQueueAdmission(false, countRequest.result) === "full") {
        outcome = { status: "full" };
        return;
      }
      store.add(candidate);
      outcome = { status: "stored", operation: candidate };
    };
  };
  await transactionDone(transaction);
  if (!outcome) throw new Error("Offline operation could not be enqueued");
  if (outcome.status === "stored") emitChange();
  return outcome;
}

type ClaimOperationResult =
  | { status: "claimed"; operation: StoredOperation }
  | { status: "absent" | "busy" | "not_due" | "uncertain" | "rejected" };

async function claimOperationForSend(
  db: IDBDatabase,
  operationId: string,
  now = Date.now()
): Promise<ClaimOperationResult> {
  const transaction = db.transaction(OPERATIONS, "readwrite");
  const store = transaction.objectStore(OPERATIONS);
  let outcome: ClaimOperationResult | undefined;
  let changed = false;
  const request = store.get(operationId);
  request.onsuccess = () => {
    const operation = request.result as StoredOperation | undefined;
    if (!operation) {
      outcome = { status: "absent" };
      return;
    }
    const decision = operationClaimDecision(operation, now);
    if (decision === "uncertain") {
      store.put(failClosedInterruptedSendingOperation(operation));
      changed = true;
      outcome = { status: "uncertain" };
      return;
    }
    if (decision !== "claim") {
      outcome = {
        status: decision === "terminal"
          ? operation.state === "REJECTED" ? "rejected" : "uncertain"
          : decision
      };
      return;
    }
    const claimed: StoredOperation = {
      ...operation,
      state: "SENDING",
      attempts: operation.attempts + 1,
      claimId: crypto.randomUUID(),
      claimExpiresAt: now + OUTBOX_CLAIM_LEASE_MS
    };
    store.put(claimed);
    changed = true;
    outcome = { status: "claimed", operation: claimed };
  };
  await transactionDone(transaction);
  if (!outcome) throw new Error("Offline operation could not be claimed");
  if (changed) emitChange();
  if (changed && outcome.status === "uncertain") {
    emitOperationOutcome({ operationId, ...acknowledgementUnknownResult() });
  }
  return outcome;
}

type ClaimSettlement =
  | { action: "delete" }
  | {
    action: "retain";
    state: "QUEUED" | "REJECTED" | "UNCERTAIN";
    nextAttemptAt: number;
    safeError: string;
  };

async function settleClaimedOperation(
  db: IDBDatabase,
  claimed: StoredOperation,
  settlement: ClaimSettlement,
  notifyChange = true
): Promise<boolean> {
  const transaction = db.transaction(OPERATIONS, "readwrite");
  const store = transaction.objectStore(OPERATIONS);
  let settled = false;
  const request = store.get(claimed.id);
  request.onsuccess = () => {
    const current = request.result as StoredOperation | undefined;
    if (!current || current.state !== "SENDING" || current.claimId !== claimed.claimId) return;
    if (settlement.action === "delete") {
      store.delete(current.id);
    } else {
      store.put({
        ...current,
        state: settlement.state,
        nextAttemptAt: settlement.nextAttemptAt,
        safeError: settlement.safeError,
        claimId: undefined,
        claimExpiresAt: undefined
      });
    }
    settled = true;
  };
  await transactionDone(transaction);
  if (settled && notifyChange) emitChange();
  return settled;
}

async function rejectUnreadableOperationBeforeClaim(db: IDBDatabase, operationId: string): Promise<boolean> {
  const transaction = db.transaction(OPERATIONS, "readwrite");
  const store = transaction.objectStore(OPERATIONS);
  let rejected = false;
  const request = store.get(operationId);
  request.onsuccess = () => {
    const current = request.result as StoredOperation | undefined;
    if (!current || current.state !== "QUEUED") return;
    store.put({
      ...current,
      state: "REJECTED",
      nextAttemptAt: 0,
      safeError: "encrypted_payload_unreadable",
      claimId: undefined,
      claimExpiresAt: undefined
    });
    rejected = true;
  };
  await transactionDone(transaction);
  if (rejected) emitChange();
  return rejected;
}

async function requeueUncertainOperation(db: IDBDatabase, operationId: string): Promise<boolean> {
  const transaction = db.transaction(OPERATIONS, "readwrite");
  const store = transaction.objectStore(OPERATIONS);
  let requeued = false;
  const request = store.get(operationId);
  request.onsuccess = () => {
    const current = request.result as StoredOperation | undefined;
    if (!current) return;
    const next = operationAfterExplicitReconciliation(current);
    if (!next) return;
    store.put(next);
    requeued = true;
  };
  await transactionDone(transaction);
  if (requeued) emitChange();
  return requeued;
}

function durableOperationStatus(operation: StoredOperation | undefined): DurableOperationStatus {
  if (!operation) return { status: "absent" };
  if (operation.state === "QUEUED") return { status: "queued", ...(operation.safeError ? { safeReason: operation.safeError } : {}) };
  if (operation.state === "SENDING") return { status: "sending", ...(operation.safeError ? { safeReason: operation.safeError } : {}) };
  if (operation.state === "UNCERTAIN") return { status: "uncertain", safeReason: "acknowledgement_unknown" };
  return { status: "rejected", safeReason: operation.safeError ?? "operation_rejected" };
}

function summarizeOperations(operations: StoredOperation[]): OutboxSummary {
  return {
    queued: operations.filter((operation) => operation.state === "QUEUED").length,
    sending: operations.filter((operation) => operation.state === "SENDING").length,
    rejected: operations.filter((operation) => operation.state === "REJECTED").length,
    uncertain: operations.filter((operation) => operation.state === "UNCERTAIN").length
  };
}

async function removeOperations(db: IDBDatabase, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const transaction = db.transaction(OPERATIONS, "readwrite");
  const store = transaction.objectStore(OPERATIONS);
  ids.forEach((id) => store.delete(id));
  await transactionDone(transaction);
  emitChange();
}

/**
 * Applies a household-scoped deletion at the storage boundary. Callers provide
 * the encrypted-record reader so this algorithm remains independently testable:
 * readable operations from another household are always preserved, while an
 * unreadable record is reported rather than guessed to belong to the target.
 */
export async function purgeStoredOperationsWhere<T extends { id: string }>(input: {
  operations: T[];
  householdIdFor: (operation: T) => Promise<string>;
  shouldPurge: (householdId: string) => boolean;
  deleteByIds: (ids: string[]) => Promise<void>;
}): Promise<HouseholdScopedOfflinePurgeResult> {
  const purgeIds: string[] = [];
  let preserved = 0;
  let unreadable = 0;
  for (const operation of input.operations) {
    try {
      const householdId = await input.householdIdFor(operation);
      if (input.shouldPurge(householdId)) purgeIds.push(operation.id);
      else preserved += 1;
    } catch {
      unreadable += 1;
    }
  }
  await input.deleteByIds(purgeIds);
  return { purged: purgeIds.length, preserved, unreadable };
}

async function purgeOperationsInDatabase(
  db: IDBDatabase,
  shouldPurge: (householdId: string) => boolean
): Promise<HouseholdScopedOfflinePurgeResult> {
  return purgeStoredOperationsWhere({
    operations: await allOperations(db),
    householdIdFor: async (operation) => (await decrypt(db, operation)).householdId,
    shouldPurge,
    deleteByIds: (ids) => removeOperations(db, ids)
  });
}

export async function classifyHouseholdAccessDenial(input: {
  providerMessage: string | undefined;
  targetHouseholdId: string;
  loadAuthorizedHouseholdIds: () => Promise<string[]>;
}): Promise<HouseholdAccessDenialAction | null> {
  if (!isHouseholdAccessDenied(input.providerMessage)) return null;
  try {
    const authorized = await input.loadAuthorizedHouseholdIds();
    return authorized.includes(input.targetHouseholdId) ? "reject-resource" : "purge-household";
  } catch {
    return "revalidation-failed";
  }
}

async function loadAuthorizedHouseholdIds(client: SupabaseClient): Promise<string[]> {
  const result = await client.rpc("get_my_households");
  if (result.error || !Array.isArray(result.data)) throw new Error("Household access revalidation failed");
  return result.data.map((row) => {
    if (!row || typeof row !== "object" || typeof (row as { household_id?: unknown }).household_id !== "string") {
      throw new Error("Household access revalidation returned an invalid shape");
    }
    return assertHouseholdId((row as { household_id: string }).household_id);
  });
}

async function authenticatedActor(client: SupabaseClient): Promise<string> {
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data.currentLevel !== "aal2") throw new Error("AAL2 session required");
  const session = await client.auth.getSession();
  if (session.error || !session.data.session?.user) throw new Error("Authenticated user required");
  return session.data.session.user.id;
}

function acknowledgementUnknownResult<T>(): Extract<DurableMutationResult<T>, { status: "rejected" }> {
  return { status: "rejected", message: acknowledgementUnknownMessage, reason: "acknowledgement_unknown" };
}

async function resultForCurrentOperation<T>(db: IDBDatabase, operationId: string): Promise<DurableMutationResult<T>> {
  const status = durableOperationStatus(await storedOperation(db, operationId));
  if (status.status === "queued" || status.status === "sending") return { status: "queued" };
  if (status.status === "rejected") {
    return { status: "rejected", message: "Diese Änderung wurde vom Server abgelehnt.", reason: "operation_rejected" };
  }
  return acknowledgementUnknownResult<T>();
}

async function attemptOperationSend<T>(
  db: IDBDatabase,
  operationId: string,
  client: SupabaseClient
): Promise<DurableMutationResult<T>> {
  const candidate = await storedOperation(db, operationId);
  if (!candidate) return acknowledgementUnknownResult<T>();
  let secret: OperationSecret;
  try {
    // Decrypt before claiming. A corrupt local payload cannot possibly have reached
    // the server and must be rejected as a local precondition, never as UNCERTAIN.
    secret = await decrypt(db, candidate);
  } catch {
    const rejected = await rejectUnreadableOperationBeforeClaim(db, operationId);
    if (!rejected) return resultForCurrentOperation<T>(db, operationId);
    const result = {
      status: "rejected",
      message: "Die verschlüsselte lokale Änderung kann nicht sicher gelesen und wurde nicht gesendet.",
      reason: "precondition"
    } as const;
    emitOperationOutcome({ operationId, ...result });
    return result;
  }
  // Authenticate before claiming. If assurance was downgraded while this write was
  // queued, no RPC has been attempted and the operation must remain recoverable.
  let actorId: string;
  try {
    actorId = await authenticatedActor(client);
  } catch {
    return { status: "queued" };
  }
  const claim = await claimOperationForSend(db, operationId);
  if (claim.status === "busy" || claim.status === "not_due") return { status: "queued" };
  if (claim.status === "rejected") {
    return { status: "rejected", message: "Diese Änderung wurde vom Server abgelehnt.", reason: "operation_rejected" };
  }
  if (claim.status !== "claimed") return acknowledgementUnknownResult<T>();
  try {
    return await sendClaimedOperation<T>(db, claim.operation, client, actorId, secret);
  } catch {
    const settled = await settleClaimedOperation(db, claim.operation, {
      action: "retain",
      state: "UNCERTAIN",
      nextAttemptAt: 0,
      safeError: "send_interrupted"
    });
    const result = settled
      ? acknowledgementUnknownResult<T>()
      : await resultForCurrentOperation<T>(db, operationId);
    if (result.status === "rejected") emitOperationOutcome({ operationId, ...result });
    return result;
  }
}

async function sendClaimedOperation<T>(
  db: IDBDatabase,
  claimed: StoredOperation,
  client: SupabaseClient,
  actorId: string,
  secret: OperationSecret
): Promise<DurableMutationResult<T>> {
  const operation = claimed;
  if (!isAllowedOfflineRpc(claimed.kind, secret.rpc)) {
    const settled = await settleClaimedOperation(db, claimed, {
      action: "retain",
      state: "REJECTED",
      nextAttemptAt: 0,
      safeError: "unsupported_operation"
    });
    if (!settled) return resultForCurrentOperation<T>(db, claimed.id);
    const result = { status: "rejected", message: "Diese lokale Änderung wird von dieser App-Version nicht unterstützt.", reason: "precondition" } as const;
    emitOperationOutcome({ operationId: operation.id, ...result });
    return result;
  }
  if (actorId !== secret.actorId) {
    const settled = await settleClaimedOperation(db, claimed, {
      action: "retain",
      state: "REJECTED",
      nextAttemptAt: 0,
      safeError: "actor_changed"
    });
    if (!settled) return resultForCurrentOperation<T>(db, claimed.id);
    const result = { status: "rejected", message: "Die lokale Änderung gehört zu einer anderen Sitzung und wurde nicht gesendet.", reason: "server_rejected" } as const;
    emitOperationOutcome({ operationId: operation.id, ...result });
    return result;
  }
  const { data, error } = await client.rpc(secret.rpc, secret.args);
  if (!error) {
    const acknowledgement = resolveSuccessfulRpcAcknowledgement<T>(operation.kind, data, secret.args);
    if (acknowledgement.disposition === "retain_uncertain") {
      const settled = await settleClaimedOperation(db, claimed, {
        action: "retain",
        state: "UNCERTAIN",
        nextAttemptAt: 0,
        safeError: "acknowledgement_unknown"
      });
      if (!settled) return resultForCurrentOperation<T>(db, claimed.id);
    } else {
      // The strict ACK must cross tabs before the generic "change" message. If the
      // deletion notification wins the race, a receiver can observe an absent
      // record and incorrectly freeze the already-confirmed mutation as uncertain.
      const settled = await settleClaimedOperation(db, claimed, { action: "delete" }, false);
      if (!settled) return resultForCurrentOperation<T>(db, claimed.id);
      emitOperationOutcome({ operationId: operation.id, ...acknowledgement.result });
      emitChange();
      return acknowledgement.result;
    }
    emitOperationOutcome({ operationId: operation.id, ...acknowledgement.result });
    return acknowledgement.result;
  }
  if (isRecoverableAal2Failure(error.message)) {
    const settled = await settleClaimedOperation(db, claimed, {
      action: "retain",
      state: "QUEUED",
      nextAttemptAt: 0,
      safeError: "aal2_required"
    });
    if (!settled) return resultForCurrentOperation<T>(db, claimed.id);
    return { status: "queued" };
  }
  const accessDenialAction = await classifyHouseholdAccessDenial({
    providerMessage: error.message,
    targetHouseholdId: secret.householdId,
    loadAuthorizedHouseholdIds: () => loadAuthorizedHouseholdIds(client)
  });
  if (accessDenialAction === "purge-household") {
    const cleanup = await purgeOperationsInDatabase(db, (householdId) => householdId === secret.householdId);
    const result = {
      status: "rejected",
      message: cleanup.unreadable === 0
        ? "Dein Zugriff auf diesen Haushalt wurde beendet. Seine lokalen Offline-Änderungen wurden entfernt."
        : "Dein Zugriff auf diesen Haushalt wurde beendet. Lesbare lokale Offline-Änderungen wurden entfernt; beschädigte Browserdaten konnten nicht sicher zugeordnet werden.",
      reason: "server_rejected"
    } as const;
    emitOperationOutcome({ operationId: operation.id, ...result });
    return result;
  }
  if (accessDenialAction) {
    const settled = await settleClaimedOperation(db, claimed, {
      action: "retain",
      state: "REJECTED",
      nextAttemptAt: 0,
      safeError: accessDenialAction === "reject-resource" ? "resource_access_denied" : "membership_revalidation_failed"
    });
    if (!settled) return resultForCurrentOperation<T>(db, claimed.id);
    const result = {
      status: "rejected",
      message: accessDenialAction === "reject-resource"
        ? "Diese lokale Änderung verweist auf einen nicht mehr verfügbaren Datensatz. Andere Änderungen des Haushalts bleiben erhalten."
        : "Der Haushaltszugriff konnte nicht sicher neu bestätigt werden. Die einzelne Änderung bleibt angehalten; andere Haushaltsdaten wurden nicht gelöscht.",
      reason: "server_rejected"
    } as const;
    emitOperationOutcome({ operationId: operation.id, ...result });
    return result;
  }
  const retryable = isRetryableTransportFailure(error.message, navigator.onLine);
  const settled = await settleClaimedOperation(db, claimed, {
    action: "retain",
    state: retryable ? "QUEUED" : "REJECTED",
    nextAttemptAt: retryable ? Date.now() + nextRetryDelayMs(claimed.attempts) : 0,
    safeError: retryable ? "transport_unavailable" : "server_rejected"
  });
  if (!settled) return resultForCurrentOperation<T>(db, claimed.id);
  if (retryable) return { status: "queued" };
  return emitSanitizedTerminalProviderRejection(operation.id, error.message);
}

export async function submitDurableRpc<T>(input: {
  kind: OfflineOperationKind;
  rpc: string;
  args: Record<string, unknown>;
  householdId: string;
  operationId: string;
}): Promise<DurableMutationResult<T>> {
  if (!isAllowedOfflineRpc(input.kind, input.rpc)) return { status: "rejected", message: "Offline operation is not allowed", reason: "precondition" };
  const client = getSupabaseBrowserClient();
  const actorId = await authenticatedActor(client);
  if (!allowOfflineDataForAuthenticatedMutation()) {
    return { status: "rejected", message: "Die sichere Entfernung lokaler Offline-Daten ist noch nicht bestätigt. Schließe weitere FoodOS-Tabs oder beende die sichere Abmeldung, bevor du neue Offline-Änderungen speicherst.", reason: "precondition" };
  }
  const db = await openDatabase();
  try {
    const existingBeforeCapacity = await storedOperation(db, input.operationId);
    const existing = existingBeforeCapacity;
    if (existing) {
      const secret = await decrypt(db, existing);
      const incomingHash = await outboxPayloadHash(input, existing.schemaVersion);
      if (existing.kind !== input.kind || secret.payloadSha256 !== incomingHash) {
        return {
          status: "rejected",
          message: "Diese Vorgangs-ID gehört bereits zu einer anderen bestätigten Änderung. Die ursprüngliche Änderung bleibt erhalten.",
          reason: "payload_conflict"
        };
      }
      if (existing.state === "REJECTED") {
        return { status: "rejected", message: "Diese Änderung wurde vom Server abgelehnt.", reason: "operation_rejected" };
      }
      if (existing.state === "UNCERTAIN") {
        return { status: "rejected", message: acknowledgementUnknownMessage, reason: "acknowledgement_unknown" };
      }
      if (operationClaimDecision(existing) === "uncertain") {
        await claimOperationForSend(db, existing.id);
        return acknowledgementUnknownResult<T>();
      }
      return navigator.onLine ? await attemptOperationSend<T>(db, existing.id, client) : { status: "queued" };
    }
    const secret: OperationSecret = {
      rpc: input.rpc,
      args: input.args,
      householdId: input.householdId,
      actorId,
      deviceId: await deviceId(db),
      baseRevision: null,
      payloadSha256: await outboxPayloadHash(input)
    };
    const operation: StoredOperation = {
      id: input.operationId,
      kind: input.kind,
      schemaVersion: 2,
      state: "QUEUED",
      createdAt: new Date().toISOString(),
      attempts: 0,
      nextAttemptAt: 0,
      ...(await encrypt(db, secret))
    };
    const enqueued = await enqueueOperationAtomically(db, operation);
    if (enqueued.status === "full") {
      return { status: "rejected", message: "Die Offline-Warteschlange ist voll. Stelle eine Verbindung her, bevor du weitere Änderungen bestätigst.", reason: "precondition" };
    }
    const stored = enqueued.operation;
    if (enqueued.status === "existing") {
      const storedSecret = await decrypt(db, stored);
      const incomingHash = await outboxPayloadHash(input, stored.schemaVersion);
      if (stored.kind !== input.kind || storedSecret.payloadSha256 !== incomingHash) {
        return {
          status: "rejected",
          message: "Diese Vorgangs-ID gehört bereits zu einer anderen bestätigten Änderung. Die ursprüngliche Änderung bleibt erhalten.",
          reason: "payload_conflict"
        };
      }
      if (stored.state === "REJECTED") {
        return { status: "rejected", message: "Diese Änderung wurde vom Server abgelehnt.", reason: "operation_rejected" };
      }
      if (stored.state === "UNCERTAIN" || operationClaimDecision(stored) === "uncertain") {
        if (stored.state === "SENDING") await claimOperationForSend(db, stored.id);
        return acknowledgementUnknownResult<T>();
      }
    }
    return navigator.onLine ? await attemptOperationSend<T>(db, stored.id, client) : { status: "queued" };
  } finally {
    db.close();
  }
}

export async function discardRejectedOperation(operationId: string): Promise<boolean> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(OPERATIONS, "readwrite");
    const store = transaction.objectStore(OPERATIONS);
    let discarded = false;
    const request = store.get(operationId);
    request.onsuccess = () => {
      const operation = request.result as StoredOperation | undefined;
      if (!operation || !isOperationUserDiscardable(operation)) return;
      store.delete(operationId);
      discarded = true;
    };
    await transactionDone(transaction);
    if (discarded) emitChange();
    return discarded;
  } finally {
    db.close();
  }
}

export async function reconcileUncertainOperation<T>(operationId: string): Promise<DurableMutationResult<T>> {
  const db = await openDatabase();
  try {
    if (!await requeueUncertainOperation(db, operationId)) {
      return resultForCurrentOperation<T>(db, operationId);
    }
    return await attemptOperationSend<T>(db, operationId, getSupabaseBrowserClient());
  } finally {
    db.close();
  }
}

export async function reconcileUncertainOperations(): Promise<OutboxSummary> {
  const db = await openDatabase();
  try {
    const client = getSupabaseBrowserClient();
    const operationIds = (await allOperations(db))
      .filter((operation) => operation.state === "UNCERTAIN")
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((operation) => operation.id);
    for (const operationId of operationIds) {
      if (!await requeueUncertainOperation(db, operationId)) continue;
      await attemptOperationSend(db, operationId, client);
    }
    return summarizeOperations(await allOperations(db));
  } finally {
    db.close();
  }
}

export async function flushQueuedOperations(): Promise<OutboxSummary> {
  const db = await openDatabase();
  try {
    const client = getSupabaseBrowserClient();
    await recoverInterruptedSendingOperations(db);
    const operations = (await allOperations(db))
      .filter((operation) => isOperationEligibleForAutomaticSend(operation))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    for (const operation of operations) {
      if (!navigator.onLine) break;
      try {
        // A prior household denial may have atomically removed this operation
        // together with every sibling operation for the same household.
        const current = await requestValue(
          db.transaction(OPERATIONS, "readonly").objectStore(OPERATIONS).get(operation.id)
        ) as StoredOperation | undefined;
        if (!current) continue;
        await attemptOperationSend(db, current.id, client);
      } catch {
        // Never repair a failed claim from this stale queue snapshot. The current
        // IndexedDB record remains authoritative and cannot be overwritten here.
      }
    }
    return summarizeOperations(await allOperations(db));
  } finally {
    db.close();
  }
}

function assertHouseholdId(value: string): string {
  const householdId = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(householdId)) {
    throw new Error("Valid household id required for offline cleanup");
  }
  return householdId;
}

/**
 * Deletes only private queued operations belonging to one household. Device
 * identity and encryption metadata are shared across households and are kept.
 */
export async function purgeOfflineHouseholdData(householdId: string): Promise<HouseholdScopedOfflinePurgeResult> {
  const target = assertHouseholdId(householdId);
  const db = await openDatabase();
  try {
    return await purgeOperationsInDatabase(db, (candidate) => candidate === target);
  } finally {
    db.close();
  }
}

/**
 * Reconciles encrypted offline operations with a freshly server-authorized set
 * of households. It never deletes queues for an active household.
 */
export async function reconcileOfflineHouseholdAccess(
  activeHouseholdIds: string[]
): Promise<HouseholdScopedOfflinePurgeResult> {
  const active = new Set(activeHouseholdIds.map(assertHouseholdId));
  const db = await openDatabase();
  try {
    return await purgeOperationsInDatabase(db, (candidate) => !active.has(candidate));
  } finally {
    db.close();
  }
}

export async function getOutboxSummary(): Promise<OutboxSummary> {
  const db = await openDatabase();
  try {
    await recoverInterruptedSendingOperations(db);
    return summarizeOperations(await allOperations(db));
  } finally {
    db.close();
  }
}

export async function getDurableOperationStatus(operationId: string): Promise<DurableOperationStatus> {
  const db = await openDatabase();
  try {
    await recoverInterruptedSendingOperations(db);
    // "absent" is deliberately not an acknowledgement. A tab that subscribed too
    // late must treat it as unknown unless it observed the live ACK outcome event.
    return durableOperationStatus(await storedOperation(db, operationId));
  } finally {
    db.close();
  }
}

function startOfflineDataCleanup(): OfflineDataCleanupAttempt {
  let resolveCompletion: (result: OfflineDataCleanupResult) => void;
  let resolveBlocked: (result: OfflineDataCleanupResult) => void;
  const completion = new Promise<OfflineDataCleanupResult>((resolve) => {
    resolveCompletion = resolve;
  });
  const blocked = new Promise<OfflineDataCleanupResult>((resolve) => {
    resolveBlocked = resolve;
  });
  const attempt: OfflineDataCleanupAttempt = { completion, blocked };
  activeOfflineDataCleanup = attempt;

  const finish = (result: OfflineDataCleanupResult) => {
    if (activeOfflineDataCleanup === attempt) activeOfflineDataCleanup = null;
    resolveCompletion(result);
  };

  try {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      setOfflineDataStorageState("cleared");
      finish({ status: "cleared" });
    };
    request.onerror = () => finish({ status: "unconfirmed" });
    // Crucially, onblocked is an observation, not a cancellation. The request remains
    // live and may succeed once the last tab releases its database connection.
    request.onblocked = () => resolveBlocked({ status: "pending" });
  } catch {
    finish({ status: "unconfirmed" });
  }
  return attempt;
}

function observeOfflineDataCleanup(attempt: OfflineDataCleanupAttempt): Promise<OfflineDataCleanupResult> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: OfflineDataCleanupResult) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      resolve(result);
    };
    const timeout = globalThis.setTimeout(() => settle({ status: "pending" }), OFFLINE_DATA_CLEANUP_OBSERVATION_MS);
    void attempt.completion.then(settle);
    void attempt.blocked.then(settle);
  });
}

export async function clearOfflineData(): Promise<OfflineDataCleanupResult> {
  const state = getOfflineDataStorageState();
  if (state === "cleared") return { status: "cleared" };
  if (state === "available") setOfflineDataStorageState("cleanup-pending");
  if (typeof indexedDB === "undefined") return { status: "unconfirmed" };
  const attempt = activeOfflineDataCleanup ?? startOfflineDataCleanup();
  return observeOfflineDataCleanup(attempt);
}

/**
 * Wait for the deletion request already started by `clearOfflineData` to settle.
 * This deliberately does not start a new deletion request: callers use it only after
 * a user has explicitly begun secure sign-out and the initial observation was blocked.
 */
export async function waitForOfflineDataCleanupCompletion(): Promise<OfflineDataCleanupResult> {
  const attempt = activeOfflineDataCleanup;
  if (attempt) return attempt.completion;
  return getOfflineDataStorageState() === "cleared" ? { status: "cleared" } : { status: "unconfirmed" };
}

export async function discardRejectedOperations(): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(OPERATIONS, "readwrite");
    const store = transaction.objectStore(OPERATIONS);
    let discarded = 0;
    const request = store.getAll();
    request.onsuccess = () => {
      for (const operation of request.result as StoredOperation[]) {
        if (!isOperationUserDiscardable(operation)) continue;
        store.delete(operation.id);
        discarded += 1;
      }
    };
    await transactionDone(transaction);
    if (discarded > 0) emitChange();
  } finally {
    db.close();
  }
}

export function subscribeToOutbox(listener: () => void): () => void {
  getOutboxBroadcastChannel();
  globalThis.addEventListener?.(OUTBOX_EVENT, listener);
  return () => globalThis.removeEventListener?.(OUTBOX_EVENT, listener);
}

export function subscribeToOperationOutcome<T>(
  operationId: string,
  listener: (outcome: DurableOperationOutcome<T>) => void
): () => void {
  getOutboxBroadcastChannel();
  const handleOutcome = (event: Event) => {
    const outcome = (event as CustomEvent<DurableOperationOutcome<T>>).detail;
    if (outcome?.operationId === operationId) listener(outcome);
  };
  globalThis.addEventListener?.(OUTBOX_OPERATION_RESULT_EVENT, handleOutcome);
  return () => globalThis.removeEventListener?.(OUTBOX_OPERATION_RESULT_EVENT, handleOutcome);
}

export function subscribeToOfflineDataStorageState(listener: (state: OfflineDataStorageState) => void): () => void {
  const notify = () => listener(getOfflineDataStorageState());
  const handleStorage = (event: StorageEvent) => {
    if (event.key === OFFLINE_DATA_PURGED_KEY || event.key === null) notify();
  };
  globalThis.addEventListener?.(OFFLINE_DATA_STATE_EVENT, notify);
  globalThis.addEventListener?.("storage", handleStorage);
  return () => {
    globalThis.removeEventListener?.(OFFLINE_DATA_STATE_EVENT, notify);
    globalThis.removeEventListener?.("storage", handleStorage);
  };
}
