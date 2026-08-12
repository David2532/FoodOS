import { describe, expect, it } from "vitest";
import { nutritionSummaryRowSchema, nutritionSummaryRowsSchema } from "./nutrition-summary";

const emptyRow = (summaryDate: string) => ({
  summary_date: summaryDate,
  entry_count: "0",
  kcal: null,
  kcal_known_count: "0",
  protein_g: null,
  protein_known_count: "0",
  carbohydrates_g: null,
  carbohydrates_known_count: "0",
  fat_g: null,
  fat_known_count: "0"
});

describe("nutrition summary contract", () => {
  it("accepts PostgreSQL numeric strings without converting missing values to zero", () => {
    expect(nutritionSummaryRowSchema.parse({
      ...emptyRow("2026-08-03"),
      entry_count: "2",
      kcal: "750.000",
      kcal_known_count: "2",
      fat_g: "5.000",
      fat_known_count: "1"
    })).toMatchObject({ entry_count: 2, kcal: 750, fat_g: 5, fat_known_count: 1 });
  });

  it("rejects malformed, negative or over-broad RPC rows", () => {
    expect(nutritionSummaryRowSchema.safeParse({ ...emptyRow("03.08.2026") }).success).toBe(false);
    expect(nutritionSummaryRowSchema.safeParse({ ...emptyRow("2026-08-03"), entry_count: -1 }).success).toBe(false);
    expect(nutritionSummaryRowSchema.safeParse({ ...emptyRow("2026-08-03"), private_note: "must not cross the boundary" }).success).toBe(false);
  });

  it("requires the complete seven-day database response", () => {
    expect(nutritionSummaryRowsSchema.safeParse([emptyRow("2026-08-03")]).success).toBe(false);
  });
});
