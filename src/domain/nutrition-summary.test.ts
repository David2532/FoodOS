import { describe, expect, it } from "vitest";
import type { NutritionSummaryRow } from "@/contracts/nutrition-summary";
import { buildNutritionSummary } from "./nutrition-summary";

function row(date: string, values: Partial<NutritionSummaryRow> = {}): NutritionSummaryRow {
  return {
    summary_date: date,
    entry_count: 0,
    kcal: null,
    kcal_known_count: 0,
    protein_g: null,
    protein_known_count: 0,
    carbohydrates_g: null,
    carbohydrates_known_count: 0,
    fat_g: null,
    fat_known_count: 0,
    ...values
  };
}

const week = ["03", "04", "05", "06", "07", "08", "09"].map((day) => row(`2026-08-${day}`));

describe("nutrition summary domain", () => {
  it("keeps missing nutrition distinct from zero and aggregates only known values", () => {
    const rows = week.map((entry) => ({ ...entry }));
    rows[2] = row("2026-08-05", {
      entry_count: 2,
      kcal: 750,
      kcal_known_count: 2,
      protein_g: 70,
      protein_known_count: 2,
      carbohydrates_g: 30,
      carbohydrates_known_count: 2,
      fat_g: 5,
      fat_known_count: 1
    });

    const summary = buildNutritionSummary(rows, "2026-08-05");

    expect(summary.today.fatG).toEqual({ value: 5, knownEntries: 1, totalEntries: 2, status: "partial" });
    expect(summary.today.kcal.status).toBe("known");
    expect(summary.week.totals.kcal.value).toBe(750);
    expect(summary.week.totals.fatG.status).toBe("partial");
    expect(summary.week.days[0].kcal).toEqual({ value: null, knownEntries: 0, totalEntries: 0, status: "empty" });
  });

  it("marks an entirely absent metric as unknown instead of displaying a zero", () => {
    const rows = week.map((entry) => ({ ...entry }));
    rows[2] = row("2026-08-05", { entry_count: 1 });

    expect(buildNutritionSummary(rows, "2026-08-05").today.fatG).toEqual({
      value: null,
      knownEntries: 0,
      totalEntries: 1,
      status: "unknown"
    });
  });

  it("fails closed on inconsistent coverage or non-consecutive dates", () => {
    const inconsistent = week.map((entry) => ({ ...entry }));
    inconsistent[2] = row("2026-08-05", { entry_count: 1, kcal: null, kcal_known_count: 1 });
    expect(() => buildNutritionSummary(inconsistent, "2026-08-05")).toThrow("Inconsistent kcal value");

    const brokenDates = week.map((entry) => ({ ...entry }));
    brokenDates[4] = row("2026-08-10");
    expect(() => buildNutritionSummary(brokenDates, "2026-08-05")).toThrow("dates must be consecutive");
  });
});
