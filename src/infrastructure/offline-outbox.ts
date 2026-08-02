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

interface StoredOperation {
  id: string;
  kind: OfflineOperationKind;
  schemaVersion: 1;
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
  | { status: "rejected"; message: string };

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
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(OPERATIONS)) db.createObjectStore(OPERATIONS, { keyPath: "id" });
    if (!db.objectStoreNames.contains(METADATA)) db.createObjectStore(METADATA);
  };
  return requestValue(request);
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

async function allOperations(db: IDBDatabase): Promise<StoredOperation[]> {
  return requestValue(db.transaction(OPERATIONS, "readonly").objectStore(OPERATIONS).getAll());
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
    return { status: "rejected", message: "Diese lokale Änderung wird von dieser App-Version nicht unterstützt." };
  }
  const actor = await authenticatedActor(client);
  if (actor !== secret.actorId) {
    await putOperation(db, { ...operation, state: "REJECTED", safeError: "actor_changed" });
    return { status: "rejected", message: "Die lokale Änderung gehört zu einer anderen Sitzung und wurde nicht gesendet." };
  }
  const sending = { ...operation, state: "SENDING" as const, attempts: operation.attempts + 1 };
  await putOperation(db, sending);
  const { data, error } = await client.rpc(secret.rpc, secret.args);
  if (!error) {
    await removeOperation(db, operation.id);
    return { status: "acked", data: data as T };
  }
  const retryable = isRetryableTransportFailure(error.message, navigator.onLine);
  await putOperation(db, {
    ...sending,
    state: retryable ? "QUEUED" : "REJECTED",
    nextAttemptAt: retryable ? Date.now() + nextRetryDelayMs(sending.attempts) : 0,
    safeError: retryable ? "transport_unavailable" : "server_rejected"
  });
  return retryable
    ? { status: "queued" }
    : { status: "rejected", message: error.message };
}

export async function submitDurableRpc<T>(input: {
  kind: OfflineOperationKind;
  rpc: string;
  args: Record<string, unknown>;
  householdId: string;
  operationId: string;
}): Promise<DurableMutationResult<T>> {
  if (!isAllowedOfflineRpc(input.kind, input.rpc)) return { status: "rejected", message: "Offline operation is not allowed" };
  const client = getSupabaseBrowserClient();
  const actorId = await authenticatedActor(client);
  const db = await openDatabase();
  const operations = await allOperations(db);
  if (operations.length >= OFFLINE_QUEUE_CAP) return { status: "rejected", message: "Die Offline-Warteschlange ist voll. Stelle eine Verbindung her, bevor du weitere Änderungen bestätigst." };
  const existing = operations.find((operation) => operation.id === input.operationId);
  if (existing?.state === "REJECTED") return { status: "rejected", message: "Diese Änderung wurde vom Server abgelehnt." };
  if (existing) return navigator.onLine ? sendOperation<T>(db, existing, client) : { status: "queued" };
  const secret: OperationSecret = {
    rpc: input.rpc,
    args: input.args,
    householdId: input.householdId,
    actorId,
    deviceId: await deviceId(db),
    baseRevision: null,
    payloadSha256: await sha256(input.args)
  };
  const operation: StoredOperation = {
    id: input.operationId,
    kind: input.kind,
    schemaVersion: 1,
    state: "QUEUED",
    createdAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: 0,
    ...(await encrypt(db, secret))
  };
  await putOperation(db, operation);
  return navigator.onLine ? sendOperation<T>(db, operation, client) : { status: "queued" };
}

export async function flushQueuedOperations(): Promise<OutboxSummary> {
  const db = await openDatabase();
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
    }
  }
  return getOutboxSummary();
}

export async function getOutboxSummary(): Promise<OutboxSummary> {
  const db = await openDatabase();
  const operations = await allOperations(db);
  return {
    queued: operations.filter((operation) => operation.state === "QUEUED").length,
    sending: operations.filter((operation) => operation.state === "SENDING").length,
    rejected: operations.filter((operation) => operation.state === "REJECTED").length
  };
}

export async function clearOfflineData(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Offline data could not be removed"));
    request.onblocked = () => reject(new Error("Offline data removal is blocked by another tab"));
  });
  emitChange();
}

export async function discardRejectedOperations(): Promise<void> {
  const db = await openDatabase();
  const rejected = (await allOperations(db)).filter((operation) => operation.state === "REJECTED");
  if (!rejected.length) return;
  const transaction = db.transaction(OPERATIONS, "readwrite");
  const store = transaction.objectStore(OPERATIONS);
  rejected.forEach((operation) => store.delete(operation.id));
  await transactionDone(transaction);
  emitChange();
}

export function subscribeToOutbox(listener: () => void): () => void {
  globalThis.addEventListener?.(OUTBOX_EVENT, listener);
  return () => globalThis.removeEventListener?.(OUTBOX_EVENT, listener);
}
