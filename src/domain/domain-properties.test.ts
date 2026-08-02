import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { classifyExpiry, isConsumableSuggestionAllowed } from "./expiry";

describe("FoodOS domain properties", () => {
  it("Q-DATE-USEBY-PROPERTY-002 never recommends a past use-by date", () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 3650 }),
      (daysAgo) => {
        const today = "2030-01-01";
        const past = new Date(Date.UTC(2030, 0, 1) - daysAgo * 86_400_000).toISOString().slice(0, 10);
        expect(classifyExpiry("use_by", past, today).state).toBe("past_use_by");
        expect(isConsumableSuggestionAllowed("use_by", past, today)).toBe(false);
      }
    ), { seed: 20260802, numRuns: 300 });
  });
});
