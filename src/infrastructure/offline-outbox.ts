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
import { getSupabaseBrowserClient } from "@/lib/supabase";

const DB_NAME = "foodos-device-v1";
const DB_VERSION = 1;
const OPERATIONS = "operations";
const METADATA = "metadata";
const OUTBOX_EVENT = "foodos:outbox-change";
export const OUTBOX_OPERATION_RESULT_EVENT = "foodos:outbox-operation-result";
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
}

export type DurableMutationResult<T> =
  | { status: "acked"; data: T }
  | { status: "queued" }
  | { status: "rejected"; message: string; reason: DurableMutationRejectionReason };

export type DurableMutationRejectionReason =
  | "precondition"
  | "payload_conflict"
  | "operation_rejected"
  | "server_rejected";

export type DurableOperationOutcome<T> =
  | { operationId: string; status: "acked"; data: T }
  | { operationId: string; status: "rejected"; message: string; reason: DurableMutationRejectionReason };

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
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(OPERATIONS)) db.createObjectStore(OPERATIONS, { keyPath: "id" });
    if (!db.objectStoreNames.contains(METADATA)) db.createObjectStore(METADATA);
  };
  const db = await requestValue(request);
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

function emitChange() {
  globalThis.dispatchEvent?.(new Event(OUTBOX_EVENT));
}

function emitOperationOutcome<T>(outcome: DurableOperationOutcome<T>) {
  globalThis.dispatchEvent?.(new CustomEvent(OUTBOX_OPERATION_RESULT_EVENT, { detail: outcome }));
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

function summarizeOperations(operations: StoredOperation[]): OutboxSummary {
  return {
    queued: operations.filter((operation) => operation.state === "QUEUED").length,
    sending: operations.filter((operation) => operation.state === "SENDING").length,
    rejected: operations.filter((operation) => operation.state === "REJECTED").length
  };
}

async function putOperation(db: IDBDatabase, operation: StoredOperation): Promise<void> {
  const transaction = db.transaction(OPERATIONS, "readwrite");
  transaction.objectStore(OPERATIONS).put(operation);
  await transactionDone(transaction);
  emitChange();
}

async function removeOperation(db: IDBDatabase, id: string): Promise<void> {
  const transaction = db.transaction(OPERATIONS, "readwrite");
  transaction.objectStore(OPERATIONS).delete(id);
  await transactionDone(transaction);
  emitChange();
}

async function authenticatedActor(client: SupabaseClient): Promise<string> {
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data.currentLevel !== "aal2") throw new Error("AAL2 session required");
  const session = await client.auth.getSession();
  if (session.error || !session.data.session?.user) throw new Error("Authenticated user required");
  return session.data.session.user.id;
}

async function sendOperation<T>(db: IDBDatabase, operation: StoredOperation, client: SupabaseClient): Promise<DurableMutationResult<T>> {
  const secret = await decrypt(db, operation);
  if (!isAllowedOfflineRpc(operation.kind, secret.rpc)) {
    await putOperation(db, { ...operation, state: "REJECTED", safeError: "unsupported_operation" });
    const result = { status: "rejected", message: "Diese lokale Änderung wird von dieser App-Version nicht unterstützt.", reason: "precondition" } as const;
    emitOperationOutcome({ operationId: operation.id, ...result });
    return result;
  }
  const actor = await authenticatedActor(client);
  if (actor !== secret.actorId) {
    await putOperation(db, { ...operation, state: "REJECTED", safeError: "actor_changed" });
    const result = { status: "rejected", message: "Die lokale Änderung gehört zu einer anderen Sitzung und wurde nicht gesendet.", reason: "server_rejected" } as const;
    emitOperationOutcome({ operationId: operation.id, ...result });
    return result;
  }
  const sending = { ...operation, state: "SENDING" as const, attempts: operation.attempts + 1 };
  await putOperation(db, sending);
  const { data, error } = await client.rpc(secret.rpc, secret.args);
  if (!error) {
    await removeOperation(db, operation.id);
    const result = { status: "acked", data: data as T } as const;
    emitOperationOutcome({ operationId: operation.id, ...result });
    return result;
  }
  const retryable = isRetryableTransportFailure(error.message, navigator.onLine);
  await putOperation(db, {
    ...sending,
    state: retryable ? "QUEUED" : "REJECTED",
    nextAttemptAt: retryable ? Date.now() + nextRetryDelayMs(sending.attempts) : 0,
    safeError: retryable ? "transport_unavailable" : "server_rejected"
  });
  if (retryable) return { status: "queued" };
  const result = { status: "rejected", message: error.message, reason: "server_rejected" } as const;
  emitOperationOutcome({ operationId: operation.id, ...result });
  return result;
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
    const operations = await allOperations(db);
    if (operations.length >= OFFLINE_QUEUE_CAP) return { status: "rejected", message: "Die Offline-Warteschlange ist voll. Stelle eine Verbindung her, bevor du weitere Änderungen bestätigst.", reason: "precondition" };
    const existing = operations.find((operation) => operation.id === input.operationId);
    if (existing) {
      const secret = await decrypt(db, existing);
      const incomingHash = await outboxPayloadHash(input, existing.schemaVersion);
      if (secret.payloadSha256 !== incomingHash) {
        return {
          status: "rejected",
          message: "Diese Vorgangs-ID gehört bereits zu einer anderen bestätigten Änderung. Die ursprüngliche Änderung bleibt erhalten.",
          reason: "payload_conflict"
        };
      }
      if (existing.state === "REJECTED") {
        return { status: "rejected", message: "Diese Änderung wurde vom Server abgelehnt.", reason: "operation_rejected" };
      }
      return navigator.onLine ? await sendOperation<T>(db, existing, client) : { status: "queued" };
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
    await putOperation(db, operation);
    return navigator.onLine ? await sendOperation<T>(db, operation, client) : { status: "queued" };
  } finally {
    db.close();
  }
}

export async function discardRejectedOperation(operationId: string): Promise<boolean> {
  const db = await openDatabase();
  try {
    const operation = await requestValue(
      db.transaction(OPERATIONS, "readonly").objectStore(OPERATIONS).get(operationId)
    ) as StoredOperation | undefined;
    if (!operation || operation.state !== "REJECTED") return false;
    await removeOperation(db, operationId);
    return true;
  } finally {
    db.close();
  }
}

export async function flushQueuedOperations(): Promise<OutboxSummary> {
  const db = await openDatabase();
  try {
    const client = getSupabaseBrowserClient();
    const operations = (await allOperations(db))
      .filter((operation) => (operation.state === "QUEUED" || operation.state === "SENDING") && operation.nextAttemptAt <= Date.now())
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    for (const operation of operations) {
      if (!navigator.onLine) break;
      try {
        await sendOperation(db, operation, client);
      } catch {
        await putOperation(db, { ...operation, state: "REJECTED", safeError: "session_revalidation_failed" });
        emitOperationOutcome({
          operationId: operation.id,
          status: "rejected",
          message: "Die Sitzung oder Zwei-Faktor-Bestätigung konnte vor der Synchronisierung nicht erneut bestätigt werden.",
          reason: "server_rejected"
        });
      }
    }
    return summarizeOperations(await allOperations(db));
  } finally {
    db.close();
  }
}

export async function getOutboxSummary(): Promise<OutboxSummary> {
  const db = await openDatabase();
  try {
    return summarizeOperations(await allOperations(db));
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
    const rejected = (await allOperations(db)).filter((operation) => operation.state === "REJECTED");
    if (!rejected.length) return;
    const transaction = db.transaction(OPERATIONS, "readwrite");
    const store = transaction.objectStore(OPERATIONS);
    rejected.forEach((operation) => store.delete(operation.id));
    await transactionDone(transaction);
    emitChange();
  } finally {
    db.close();
  }
}

export function subscribeToOutbox(listener: () => void): () => void {
  globalThis.addEventListener?.(OUTBOX_EVENT, listener);
  return () => globalThis.removeEventListener?.(OUTBOX_EVENT, listener);
}

export function subscribeToOperationOutcome<T>(
  operationId: string,
  listener: (outcome: DurableOperationOutcome<T>) => void
): () => void {
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
