import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/types";
import {
  addCalendarDays,
  calendarDateInTimeZone,
  isCalendarDate,
  suggestBestBeforeDate
} from "./expiry-suggestion";

const catalogProduct = (categories: string[], source: Product["source"] = "open-food-facts") => ({ categories, source });

describe("best-before review suggestion", () => {
  it("proposes seven calendar days for a source-backed refrigerated yogurt category", () => {
    expect(suggestBestBeforeDate({
      product: catalogProduct(["Dairy products", "Joghurts"]),
      location: "fridge",
      baseDate: "2026-08-07"
    })).toEqual({
      kind: "best_before_proposal",
      date: "2026-08-14",
      baseDate: "2026-08-07",
      dayOffset: 7,
      ruleId: "refrigerated-yogurt-v1",
      source: "category_heuristic",
      matchedCategory: "Joghurts"
    });
  });

  it("uses date-only arithmetic across month, year, and leap-day boundaries", () => {
    expect(addCalendarDays("2026-12-29", 7)).toBe("2027-01-05");
    expect(addCalendarDays("2028-02-25", 7)).toBe("2028-03-03");
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2027-02-29")).toBe(false);
  });

  it("abstains for product-name-like category fragments, manual data, other storage, and existing package dates", () => {
    expect(suggestBestBeforeDate({ product: catalogProduct(["Joghurtgetränke mit Frucht"]), location: "fridge", baseDate: "2026-08-07" })).toBeNull();
    expect(suggestBestBeforeDate({ product: catalogProduct(["Joghurts"], "manual"), location: "fridge", baseDate: "2026-08-07" })).toBeNull();
    expect(suggestBestBeforeDate({ product: catalogProduct(["Joghurts"]), location: "freezer", baseDate: "2026-08-07" })).toBeNull();
    expect(suggestBestBeforeDate({ product: catalogProduct(["Joghurts"]), location: "fridge", baseDate: "2026-08-07", existingBestBeforeDate: "2026-08-20" })).toBeNull();
    expect(suggestBestBeforeDate({ product: catalogProduct(["Joghurts"]), location: "fridge", baseDate: "2026-08-07", existingUseByDate: "2026-08-09" })).toBeNull();
  });

  it("derives a stable Berlin calendar day at DST boundaries", () => {
    expect(calendarDateInTimeZone(new Date("2026-03-29T22:30:00.000Z"))).toBe("2026-03-30");
    expect(calendarDateInTimeZone(new Date("2026-10-25T00:30:00.000Z"))).toBe("2026-10-25");
  });
});
