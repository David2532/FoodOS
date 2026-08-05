import { describe, expect, it } from "vitest";
import { normalizeOpenFoodFacts } from "./open-food-facts";

describe("Q-SCAN-OFF-CONTRACT-001 Open Food Facts allowlist", () => {
  it("normalizes only validated purpose-bound metadata with provenance", () => {
    const product = normalizeOpenFoodFacts({
      product: {
        product_name_de: "Fiktive Haferflocken",
        brands: "Testmarke",
        image_front_small_url: "https://images.openfoodfacts.org/test.jpg",
        ingredients_text_de: "Haferflocken",
        ingredients: [{ id: "de:haferflocken", text: "Haferflocken", percent_estimate: 100 }],
        allergens_tags: ["de:gluten"],
        categories_tags: ["de:getreide"],
        countries_tags: ["en:germany"],
        nutriments: { "energy-kcal_100g": 370, proteins_100g: 13 },
        unexpected_private_field: "must not survive"
      }
    }, "4000000000018", "2026-08-02T12:00:00.000Z");

    expect(product.name).toBe("Fiktive Haferflocken");
    expect(product.structuredIngredients[0]).toEqual({
      name: "Haferflocken",
      normalizedName: "haferflocken",
      percentage: 100
    });
    expect(product.retrievedAt).toBe("2026-08-02T12:00:00.000Z");
    expect(product.databaseLicense).toBe("ODbL-1.0; DbCL-1.0");
    expect(product.imageLicense).toBe("CC-BY-SA-4.0");
    expect(product).not.toHaveProperty("unexpected_private_field");
  });

  it("rejects malformed provider shapes instead of inventing a product", () => {
    expect(() => normalizeOpenFoodFacts({ product: { allergens_tags: "milk" } }, "4000000000018")).toThrow();
  });

  it("keeps absent catalog values unknown and additive notes informational", () => {
    const product = normalizeOpenFoodFacts({
      product: {
        generic_name_de: "Fiktives Getränk",
        additives_tags: ["en:e102", "en:e999"],
        labels_tags: ["de:vegan"]
      }
    }, "4000000000018", "2026-08-02T12:00:00.000Z");

    expect(product.name).toBe("Fiktives Getränk");
    expect(product.nutrition.kcal100g).toBeUndefined();
    expect(product.assessments.map((item) => item.level)).toEqual(["info", "ok"]);
    expect(product.assessments[1].reason).toContain("kein scheinpräziser Risiko-Score");
  });

  it("uses an explicit unknown name when the provider has no identity", () => {
    expect(normalizeOpenFoodFacts({ product: {} }, "4000000000018").name).toBe("Unbekanntes Produkt");
  });
});
