import { describe, expect, it } from "vitest";
import { getOpenFoodFactsUserAgent, requireOpenFoodFactsUserAgent } from "./open-food-facts-user-agent";

describe("Open Food Facts user agent contract", () => {
  it("accepts a monitored, identifiable application value", () => {
    expect(getOpenFoodFactsUserAgent("FoodOS/0.1 (ops@example.com)")).toBe("FoodOS/0.1 (ops@example.com)");
    expect(getOpenFoodFactsUserAgent("FoodOS/0.1 (https://github.com/David2532/FoodOS)")).toBe("FoodOS/0.1 (https://github.com/David2532/FoodOS)");
  });

  it("fails closed instead of sending an invented contact identity", () => {
    expect(getOpenFoodFactsUserAgent("FoodOS/0.1 (food inventory catalog)")).toBeUndefined();
    expect(getOpenFoodFactsUserAgent("FoodOS/0.1 (http://example.com)")).toBeUndefined();
    expect(() => requireOpenFoodFactsUserAgent("FoodOS/0.1 (food inventory catalog)")).toThrow(/identifiable/);
  });
});
