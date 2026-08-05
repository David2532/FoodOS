import { describe, expect, it } from "vitest";
import {
  mealPlanDeleteResultSchema,
  mealPlanMutationResultSchema,
  shoppingGenerationResultSchema
} from "./planning-shopping";

const id = "11111111-1111-4111-8111-111111111111";

describe("planning and shopping boundary contracts", () => {
  it("accepts strict revision-bound mutation results", () => {
    expect(mealPlanMutationResultSchema.parse({ id, revision: "2", idempotent_replay: false })).toEqual({
      id,
      revision: 2,
      idempotent_replay: false
    });
    expect(mealPlanDeleteResultSchema.parse({ id, deleted_revision: 2, idempotent_replay: true })).toEqual({
      id,
      deleted_revision: 2,
      idempotent_replay: true
    });
  });

  it("rejects missing, negative, and unversioned results", () => {
    expect(mealPlanMutationResultSchema.safeParse({ id, revision: 0, idempotent_replay: false }).success).toBe(false);
    expect(mealPlanMutationResultSchema.safeParse({ id, revision: 1, idempotent_replay: false, private: "leak" }).success).toBe(false);
    expect(mealPlanDeleteResultSchema.safeParse({ id, idempotent_replay: false }).success).toBe(false);
  });

  it("requires a calculation revision and a SHA-256 payload identity", () => {
    expect(shoppingGenerationResultSchema.safeParse({
      list_id: id,
      calculation_revision: 4,
      calculation_payload_sha256: "a".repeat(64),
      idempotent_replay: false
    }).success).toBe(true);
    expect(shoppingGenerationResultSchema.safeParse({
      list_id: id,
      calculation_revision: 4,
      calculation_payload_sha256: "not-a-hash",
      idempotent_replay: false
    }).success).toBe(false);
  });
});
