import { describe, expect, it } from "vitest";
import { formatPlanningAmount, isSupportedMonday, weekDatesFromMonday } from "./planning-shopping";

describe("planning and shopping domain rules", () => {
  it("accepts only real supported Mondays", () => {
    expect(isSupportedMonday("2026-08-03")).toBe(true);
    expect(isSupportedMonday("2026-08-04")).toBe(false);
    expect(isSupportedMonday("2026-02-30")).toBe(false);
    expect(isSupportedMonday("1999-12-27")).toBe(false);
  });

  it("builds exactly one Monday-to-Sunday range", () => {
    expect(weekDatesFromMonday("2026-08-03")).toEqual([
      "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06",
      "2026-08-07", "2026-08-08", "2026-08-09"
    ]);
    expect(() => weekDatesFromMonday("2026-08-05")).toThrow(/Monday/);
  });

  it("formats explicit quantities without inventing unit conversions", () => {
    expect(formatPlanningAmount(450, "g")).toBe("450 g");
    expect(formatPlanningAmount(2, "piece")).toBe("2 Stück");
    expect(() => formatPlanningAmount(0, "ml")).toThrow(/positive/);
  });
});
