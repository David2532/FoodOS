import { describe, expect, it } from "vitest";
import { normalizeCachedProduct } from "./product-cache";

describe("normalized product cache", () => {
  it("reconstructs only allowlisted product metadata", () => {
    const product = normalizeCachedProduct({
      gtin: "3017624010701",
      name: "Produkt",
      brand: "Marke",
      image_url: null,
      ingredients_text: "Milch, Kakao",
      source_updated_at: "2026-08-02T10:00:00Z",
      data_confidence: "0.9",
      product_nutrition: { energy_kcal: "200", protein_g: "10", carbohydrates_g: null, sugars_g: null, fat_g: null, saturated_fat_g: null, fiber_g: null, salt_g: null },
      product_metadata: [
        { field_key: "allergens", value_json: ["Milch"] },
        { field_key: "catalog_details", value_json: { nutri_score: "c", nova_group: 3, unknown_raw: "discarded" } },
        { field_key: "provider_dump", value_json: { secret: "must not surface" } }
      ]
    });

    expect(product.source).toBe("cache");
    expect(product.nutrition.kcal100g).toBe(200);
    expect(product.nutriScore).toBe("c");
    expect(product.assessments[0]).toMatchObject({ name: "Milch", level: "info" });
    expect(product).not.toHaveProperty("provider_dump");
  });

  it("rejects malformed cache rows", () => {
    expect(() => normalizeCachedProduct({ gtin: 123 })).toThrow();
  });
});
