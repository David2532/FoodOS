import { describe, expect, it } from "vitest";
import { nutritionForAmount, packagesNeeded, weeklyRemaining } from "./food-math";

describe("FoodOS calculation core", () => {
  it("scales nutrition without changing source values", () => {
    expect(nutritionForAmount({ kcal100g: 64, protein100g: 3.4 }, 250)).toEqual({
      kcal: 160,
      protein: 8.5,
      carbs: 0,
      fat: 0,
      sugar: 0,
      salt: 0
    });
  });

  it("calculates a seven-day remainder", () => {
    expect(weeklyRemaining(Array(7).fill(2200), Array(7).fill(2000))).toBe(1400);
  });

  it("rounds a shortage to real packages", () => {
    expect(packagesNeeded(1200, 350, 500)).toBe(2);
  });
});
