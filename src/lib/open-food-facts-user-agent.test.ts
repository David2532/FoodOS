import { describe, expect, it } from "vitest";
import { getOpenFoodFactsUserAgent, requireOpenFoodFactsUserAgent } from "./open-food-facts-user-agent";

describe("Open Food Facts user agent contract", () => {
  it("accepts a monitored, identifiable application value", () => {
    expect(getOpenFoodFactsUserAgent("FoodOS/0.1 (ops@example.com)")).toBe("FoodOS/0.1 (ops@example.com)");
  });

  it("fails closed instead of sending an invented contact identity", () => {
    expect(getOpenFoodFactsUserAgent("FoodOS/0.1 (food inventory catalog)")).toBeUndefined();
    expect(() => requireOpenFoodFactsUserAgent("FoodOS/0.1 (food inventory catalog)")).toThrow(/identifiable/);
  });
});
