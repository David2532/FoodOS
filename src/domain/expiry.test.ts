import { describe, expect, it } from "vitest";
import { classifyExpiry, isConsumableSuggestionAllowed } from "./expiry";

describe("Q-DATE-USEBY-UNIT-001 expiry safety", () => {
  it("never suggests consumption after a confirmed use-by date", () => {
    expect(classifyExpiry("use_by", "2026-08-01", "2026-08-02")).toEqual({ state: "past_use_by", days: -1 });
    expect(isConsumableSuggestionAllowed("use_by", "2026-08-01", "2026-08-02")).toBe(false);
  });

  it("keeps an exceeded best-before date distinct", () => {
    expect(classifyExpiry("best_before", "2026-08-01", "2026-08-02").state).toBe("past_best_before");
    expect(isConsumableSuggestionAllowed("best_before", "2026-08-01", "2026-08-02")).toBe(true);
  });

  it("classifies unknown, today, soon and future dates without timestamps", () => {
    expect(classifyExpiry("best_before", null, "2026-08-02")).toEqual({ state: "unknown", days: null });
    expect(classifyExpiry("best_before", "not-a-date", "2026-08-02")).toEqual({ state: "unknown", days: null });
    expect(classifyExpiry("best_before", "2026-08-02", "2026-08-02").state).toBe("today");
    expect(classifyExpiry("best_before", "2026-08-09", "2026-08-02").state).toBe("soon");
    expect(classifyExpiry("best_before", "2026-08-10", "2026-08-02").state).toBe("future");
  });
});
