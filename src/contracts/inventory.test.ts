import { describe, expect, it } from "vitest";
import { discardBatchResultSchema, discardInputSchema } from "./inventory";

describe("inventory discard boundary", () => {
  it("accepts a bounded positive discard amount", () => {
    expect(discardInputSchema.safeParse({
      batchId: "11111111-1111-4111-8111-111111111111",
      amount: "125.5"
    })).toMatchObject({ success: true });

    expect(discardInputSchema.safeParse({
      batchId: "11111111-1111-4111-8111-111111111111",
      amount: 0
    }).success).toBe(false);
  });

  it("accepts only the strict server acknowledgement shape", () => {
    const acknowledgement = {
      batch_id: "11111111-1111-4111-8111-111111111111",
      remaining_amount: 324.5,
      idempotent_replay: false
    };

    expect(discardBatchResultSchema.safeParse(acknowledgement).success).toBe(true);
    expect(discardBatchResultSchema.safeParse({
      ...acknowledgement,
      operation_secret: "must-not-cross-the-boundary"
    }).success).toBe(false);

    for (const remainingAmount of [null, false, "", "324.5"]) {
      expect(discardBatchResultSchema.safeParse({
        ...acknowledgement,
        remaining_amount: remainingAmount
      }).success).toBe(false);
    }
  });
});
