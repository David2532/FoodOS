export const OFFLINE_OPERATION_KINDS = [
  "inventory.add_batch",
  "inventory.consume_batch",
  "plan.add_product",
  "shopping.add_manual"
] as const;

export type OfflineOperationKind = (typeof OFFLINE_OPERATION_KINDS)[number];
export type OfflineOperationState = "QUEUED" | "SENDING" | "REJECTED";

export const OFFLINE_QUEUE_CAP = 100;

const allowedRpcByKind: Record<OfflineOperationKind, string> = {
  "inventory.add_batch": "add_inventory_batch",
  "inventory.consume_batch": "consume_inventory_batch_v2",
  "plan.add_product": "plan_product",
  "shopping.add_manual": "add_manual_shopping_item"
};

export function isAllowedOfflineRpc(kind: OfflineOperationKind, rpc: string): boolean {
  return allowedRpcByKind[kind] === rpc;
}

export function nextRetryDelayMs(attempts: number, jitter = Math.random()): number {
  const boundedAttempts = Math.max(0, Math.min(attempts, 8));
  const boundedJitter = Math.max(0, Math.min(jitter, 1));
  return Math.min(60_000, Math.round(1_000 * 2 ** boundedAttempts * (0.75 + boundedJitter * 0.5)));
}

export function isRetryableTransportFailure(message: string, online: boolean): boolean {
  if (!online) return true;
  return /failed to fetch|fetch failed|network|timeout|timed out|connection|load failed/i.test(message);
}
