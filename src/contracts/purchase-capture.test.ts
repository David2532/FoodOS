import { describe, expect, it } from "vitest";
import { purchaseCaptureItemSchema, purchaseCaptureItemsSchema, purchaseCaptureResultSchema } from "./purchase-capture";

const product = {
  barcode: "3017624010701",
  name: "Testprodukt",
  categories: [], countries: [], labels: [], structuredIngredients: [], allergens: [], traces: [], additives: [],
  nutrition: {}, assessments: [], source: "manual" as const, retrievedAt: "2026-08-06T10:00:00.000Z", confidence: 1
};

const baseItem = {
  item_mutation_id: "11111111-1111-4111-8111-111111111111",
  product_payload: product,
  batch_payload: {
    amount: 1, unit: "piece" as const, location: "pantry" as const,
    best_before_date: null, use_by_date: null, lot_number: null, serial_number: null,
    purchase_price_cents: null, date_source: null, personal_risk_confirmed: false
  }
};

describe("purchase capture boundary", () => {
  it("accepts an honest unknown date and rejects a date without confirmed provenance", () => {
    expect(purchaseCaptureItemSchema.safeParse(baseItem).success).toBe(true);
    expect(purchaseCaptureItemSchema.safeParse({
      ...baseItem,
      batch_payload: { ...baseItem.batch_payload, best_before_date: "2027-06-30" }
    }).success).toBe(false);
  });

  it("accepts at most 100 distinct capture rows at the client boundary", () => {
    expect(purchaseCaptureItemsSchema.safeParse([baseItem]).success).toBe(true);
    expect(purchaseCaptureItemsSchema.safeParse(Array.from({ length: 101 }, () => baseItem)).success).toBe(false);
  });

  it("accepts the atomic result contract", () => {
    expect(purchaseCaptureResultSchema.safeParse({
      item_count: 1,
      batch_ids: ["11111111-1111-4111-8111-111111111111"],
      product_ids: ["22222222-2222-4222-8222-222222222222"],
      idempotent_replay: false
    }).success).toBe(true);
  });

  it("rejects empty, mismatched, or duplicate atomic result identities", () => {
    expect(purchaseCaptureResultSchema.safeParse({
      item_count: 0, batch_ids: [], product_ids: [], idempotent_replay: false
    }).success).toBe(false);
    expect(purchaseCaptureResultSchema.safeParse({
      item_count: 1,
      batch_ids: ["11111111-1111-4111-8111-111111111111"],
      product_ids: [],
      idempotent_replay: false
    }).success).toBe(false);
    expect(purchaseCaptureResultSchema.safeParse({
      item_count: 2,
      batch_ids: ["11111111-1111-4111-8111-111111111111", "11111111-1111-4111-8111-111111111111"],
      product_ids: ["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"],
      idempotent_replay: false
    }).success).toBe(false);
    expect(purchaseCaptureResultSchema.safeParse({
      item_count: 1,
      batch_ids: ["11111111-1111-4111-8111-111111111111"],
      product_ids: ["22222222-2222-4222-8222-222222222222"],
      idempotent_replay: false,
      unexpected: "not part of the acknowledgement contract"
    }).success).toBe(false);
  });
});
