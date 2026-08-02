import type { ProductNutrition } from "./types";

export function nutritionForAmount(nutrition: ProductNutrition, grams: number) {
  const factor = grams / 100;
  const scale = (value?: number) => (value == null ? 0 : Math.round(value * factor * 10) / 10);

  return {
    kcal: Math.round(scale(nutrition.kcal100g)),
    protein: scale(nutrition.protein100g),
    carbs: scale(nutrition.carbs100g),
    fat: scale(nutrition.fat100g),
    sugar: scale(nutrition.sugar100g),
    salt: scale(nutrition.salt100g)
  };
}

export function weeklyRemaining(targets: number[], consumed: number[]) {
  if (targets.length !== 7 || consumed.length !== 7) {
    throw new Error("FoodOS weekly calculations require exactly seven days.");
  }
  return targets.reduce((sum, value) => sum + value, 0) - consumed.reduce((sum, value) => sum + value, 0);
}

export function packagesNeeded(required: number, usableInventory: number, packageSize: number) {
  if (required < 0 || usableInventory < 0 || packageSize <= 0) throw new Error("Invalid shopping inputs.");
  return Math.ceil(Math.max(0, required - usableInventory) / packageSize);
}
