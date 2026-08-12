import { describe, expect, it } from "vitest";
import { buildMealSuggestions, type MealSuggestionInventoryBatch, type MealSuggestionRecipe } from "./meal-suggestions";

const safeRecall = { kind: "none" as const, stale: false };

function batch(overrides: Partial<MealSuggestionInventoryBatch> = {}): MealSuggestionInventoryBatch {
  return {
    productId: "rice",
    name: "Reis",
    remainingAmount: 300,
    unit: "g",
    expiryState: "future",
    personalRiskMatches: [],
    recall: safeRecall,
    ...overrides
  };
}

function recipe(overrides: Partial<MealSuggestionRecipe> = {}): MealSuggestionRecipe {
  return {
    id: "recipe-rice",
    name: "Reisgericht",
    servings: 2,
    isFavorite: false,
    items: [{ productId: "rice", productName: "Reis", amount: 200, unit: "g" }],
    ...overrides
  };
}

describe("buildMealSuggestions", () => {
  it("aggregates only equal units and describes one exact shortage", () => {
    const suggestions = buildMealSuggestions([
      recipe({ items: [
        { productId: "rice", productName: "Reis", amount: 120, unit: "g" },
        { productId: "rice", productName: "Reis", amount: 80, unit: "g" },
        { productId: "tomato", productName: "Tomaten", amount: 150, unit: "g" }
      ] })
    ], [batch({ remainingAmount: 120 }), batch({ remainingAmount: 100 }), batch({ unit: "piece", remainingAmount: 10 })]);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.availability).toBe("one_missing");
    expect(suggestions[0]?.ingredients).toEqual([
      expect.objectContaining({ name: "Reis", availableAmount: 200, missingAmount: 0, status: "available" }),
      expect.objectContaining({ name: "Tomaten", availableAmount: 0, missingAmount: 150, status: "missing" })
    ]);
  });

  it("excludes past use-by, past MHD, exact or possible recalls, and personal avoid matches", () => {
    const unsafe = [
      batch({ expiryState: "past_use_by" }),
      batch({ expiryState: "past_best_before" }),
      batch({ recall: { kind: "exact", stale: false } }),
      batch({ recall: { kind: "possible_gtin", stale: false } }),
      batch({ personalRiskMatches: ["Milch"] })
    ];

    for (const inventory of unsafe) {
      expect(buildMealSuggestions([recipe({ items: [
        { productId: "rice", productName: "Reis", amount: 200, unit: "g" },
        { productId: "tomato", productName: "Tomaten", amount: 1, unit: "piece" }
      ] })], [inventory])).toEqual([]);
    }
  });

  it("ranks complete and use-soon recipes first with a stable limit", () => {
    const suggestions = buildMealSuggestions([
      recipe({ id: "b", name: "B-Rezept", isFavorite: true }),
      recipe({ id: "a", name: "A-Rezept" }),
      recipe({ id: "missing", name: "Fast komplett", items: [{ productId: "tomato", productName: "Tomaten", amount: 1, unit: "piece" }] })
    ], [batch({ expiryState: "soon" })], 2);

    expect(suggestions.map((suggestion) => suggestion.recipeId)).toEqual(["b", "a"]);
    expect(suggestions[0]?.useSoonNames).toEqual(["Reis"]);
  });

  it("keeps incomplete recall or date coverage visible without calling it safe", () => {
    const [suggestion] = buildMealSuggestions([recipe()], [batch({ expiryState: "unknown", recall: { kind: "source_unavailable", stale: true } })]);
    expect(suggestion?.availability).toBe("complete");
    expect(suggestion?.hasUncertainCoverage).toBe(true);
  });
});
