export type MealSuggestionUnit = "g" | "ml" | "piece";

export interface MealSuggestionRecipe {
  id: string;
  name: string;
  servings: number;
  isFavorite: boolean;
  items: Array<{
    productId: string;
    productName: string;
    amount: number;
    unit: MealSuggestionUnit;
  }>;
}

export interface MealSuggestionInventoryBatch {
  productId: string;
  name: string;
  remainingAmount: number;
  unit: MealSuggestionUnit;
  expiryState: "future" | "soon" | "today" | "past_best_before" | "past_use_by" | "unknown";
  personalRiskMatches: string[];
  recall: {
    kind: "exact" | "possible_gtin" | "text_candidate" | "none" | "source_unavailable";
    stale: boolean;
  };
}

export interface MealSuggestionIngredient {
  productId: string;
  name: string;
  requiredAmount: number;
  availableAmount: number;
  missingAmount: number;
  unit: MealSuggestionUnit;
  status: "available" | "missing";
}

export interface MealSuggestion {
  recipeId: string;
  name: string;
  servings: number;
  availability: "complete" | "one_missing";
  ingredients: MealSuggestionIngredient[];
  useSoonNames: string[];
  hasUncertainCoverage: boolean;
}

function isBatchEligible(batch: MealSuggestionInventoryBatch): boolean {
  return batch.remainingAmount > 0
    && batch.expiryState !== "past_use_by"
    && batch.expiryState !== "past_best_before"
    && batch.recall.kind !== "exact"
    && batch.recall.kind !== "possible_gtin"
    && batch.personalRiskMatches.length === 0;
}

function isCoverageUncertain(batch: MealSuggestionInventoryBatch): boolean {
  return batch.expiryState === "unknown"
    || batch.recall.kind === "source_unavailable"
    || batch.recall.kind === "text_candidate"
    || batch.recall.stale;
}

function amountFor(
  inventory: MealSuggestionInventoryBatch[],
  productId: string,
  unit: MealSuggestionUnit
): number {
  return inventory
    .filter((batch) => batch.productId === productId && batch.unit === unit && isBatchEligible(batch))
    .reduce((sum, batch) => sum + batch.remainingAmount, 0);
}

export function buildMealSuggestions(
  recipes: MealSuggestionRecipe[],
  inventory: MealSuggestionInventoryBatch[],
  limit = 4
): MealSuggestion[] {
  if (!Number.isInteger(limit) || limit <= 0) return [];
  const favoriteByRecipeId = new Map(recipes.map((recipe) => [recipe.id, recipe.isFavorite]));

  return recipes.flatMap((recipe): MealSuggestion[] => {
    if (!recipe.items.length) return [];
    const normalizedItems = [...recipe.items.reduce((items, item) => {
      const key = `${item.productId}:${item.unit}`;
      const existing = items.get(key);
      items.set(key, existing ? { ...existing, amount: existing.amount + item.amount } : { ...item });
      return items;
    }, new Map<string, MealSuggestionRecipe["items"][number]>()).values()];
    const ingredients = normalizedItems.map((item): MealSuggestionIngredient => {
      const availableAmount = amountFor(inventory, item.productId, item.unit);
      const missingAmount = Math.max(0, item.amount - availableAmount);
      return {
        productId: item.productId,
        name: item.productName,
        requiredAmount: item.amount,
        availableAmount: Math.min(availableAmount, item.amount),
        missingAmount,
        unit: item.unit,
        status: missingAmount > 0 ? "missing" : "available"
      };
    });
    const missingCount = ingredients.filter((ingredient) => ingredient.status === "missing").length;
    if (missingCount > 1) return [];
    const usedProductUnits = new Set(normalizedItems.map((item) => `${item.productId}:${item.unit}`));
    const relevantBatches = inventory.filter((batch) => usedProductUnits.has(`${batch.productId}:${batch.unit}`) && isBatchEligible(batch));
    const useSoonNames = [...new Set(relevantBatches
      .filter((batch) => batch.expiryState === "today" || batch.expiryState === "soon")
      .map((batch) => batch.name))].slice(0, 2);
    return [{
      recipeId: recipe.id,
      name: recipe.name,
      servings: recipe.servings,
      availability: missingCount === 0 ? "complete" : "one_missing",
      ingredients,
      useSoonNames,
      hasUncertainCoverage: relevantBatches.some(isCoverageUncertain)
    }];
  }).sort((left, right) => {
    const availability = Number(left.availability === "one_missing") - Number(right.availability === "one_missing");
    if (availability) return availability;
    const useSoon = right.useSoonNames.length - left.useSoonNames.length;
    if (useSoon) return useSoon;
    const favorite = Number(favoriteByRecipeId.get(right.recipeId) ?? false) - Number(favoriteByRecipeId.get(left.recipeId) ?? false);
    return favorite || left.name.localeCompare(right.name, "de") || left.recipeId.localeCompare(right.recipeId);
  }).slice(0, limit);
}
