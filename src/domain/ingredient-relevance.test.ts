import { describe, expect, it } from "vitest";
import { assessIngredientFacts, criticalFoodRiskMatches, personalizeProductAssessments } from "./ingredient-relevance";

describe("Q-ING-UNKNOWN-UNIT-001 ingredient relevance", () => {
  it("sorts personal exclusions first and preserves unknown evidence", () => {
    const result = assessIngredientFacts([
      { name: "Aromen", allergen: false, confidence: 0.4, sourceLabel: "Testquelle" },
      { name: "Milch", allergen: true, confidence: 0.98, sourceLabel: "Testquelle" },
      { name: "E 330", eNumber: "E330", allergen: false, confidence: 0.95, sourceLabel: "Testquelle" }
    ], [{ key: "Milch", kind: "allergen", severity: "strict_avoid" }]);

    expect(result.map((item) => item.level)).toEqual(["avoid", "ok", "unknown"]);
    expect(result[2].reason).toContain("nicht genug");
    expect(result[1].reason).not.toMatch(/schädlich|giftig/i);
  });

  it("distinguishes notice-level exclusions, declared allergens and unknown evidence", () => {
    const result = assessIngredientFacts([
      { name: "Sellerie", allergen: true, confidence: 0.95, sourceLabel: "Testquelle" },
      { name: "Soja", allergen: true, confidence: 0.95, sourceLabel: "Testquelle" },
      { name: "Gewürze", allergen: false, confidence: 0.3, sourceLabel: "Testquelle" }
    ], [
      { key: "Sellerie", kind: "intolerance", severity: "notice" },
      { key: "Soja", kind: "exclusion", severity: "avoid" }
    ]);

    expect(result.map((item) => item.level)).toEqual(["avoid", "watch", "unknown"]);
    expect(result[0].reason).toContain("ausgeschlossenen");
  });

  it("places profile matches before generic provider assessments", () => {
    const product = personalizeProductAssessments({
      barcode: "4000000000018",
      name: "Testprodukt",
      categories: [], countries: [], labels: [], traces: [], nutrition: {},
      structuredIngredients: [{ name: "Milchpulver", normalizedName: "milch" }],
      allergens: ["Milch"], additives: [],
      assessments: [{ name: "Milch", level: "info", reason: "Allergen deklariert", confidence: .95 }],
      source: "cache", retrievedAt: "2026-08-02T10:00:00.000Z", confidence: .9
    }, [{ key: "milch", kind: "allergen", severity: "strict_avoid" }]);

    expect(product.assessments[0]).toMatchObject({ name: "Milch", level: "avoid" });
    expect(product.assessments.filter((assessment) => assessment.name === "Milch")).toHaveLength(1);
  });

  it("matches provider language prefixes against critical profile keys", () => {
    expect(criticalFoodRiskMatches(["en:milk", "Kakao"], [
      { key: "milk", kind: "allergen", severity: "strict_avoid" },
      { key: "kakao", kind: "exclusion", severity: "notice" }
    ])).toEqual(["en:milk"]);
  });
});
