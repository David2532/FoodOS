import { describe, expect, it } from "vitest";
import { isAllowedOfflineRpc, isRetryableTransportFailure, nextRetryDelayMs, OFFLINE_QUEUE_CAP } from "./offline-outbox";

describe("offline outbox policy", () => {
  it("allows only the RPC bound to a declared operation kind", () => {
    expect(isAllowedOfflineRpc("inventory.add_batch", "add_inventory_batch")).toBe(true);
    expect(isAllowedOfflineRpc("inventory.add_batch", "consume_inventory_batch_v2")).toBe(false);
    expect(isAllowedOfflineRpc("plan.add_product_v2", "plan_product_v2")).toBe(true);
    expect(isAllowedOfflineRpc("plan.add_product_v2", "plan_product")).toBe(false);
    expect(isAllowedOfflineRpc("shopping.add_manual", "set_shopping_item_checked")).toBe(false);
  });

  it("bounds exponential retry work and jitter", () => {
    expect(nextRetryDelayMs(0, 0)).toBe(750);
    expect(nextRetryDelayMs(1, 1)).toBe(2_500);
    expect(nextRetryDelayMs(99, 1)).toBe(60_000);
  });

  it("retries transport failures but not server validation failures", () => {
    expect(isRetryableTransportFailure("anything", false)).toBe(true);
    expect(isRetryableTransportFailure("Failed to fetch", true)).toBe(true);
    expect(isRetryableTransportFailure("Use-by date exceeded", true)).toBe(false);
    expect(OFFLINE_QUEUE_CAP).toBe(100);
  });
});
