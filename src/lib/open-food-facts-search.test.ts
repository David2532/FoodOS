import { describe, expect, it, vi } from "vitest";
import { normalizeCatalogQuery, normalizeOpenFoodFactsSearch, searchOpenFoodFacts } from "./open-food-facts-search";

describe("Open Food Facts catalog search", () => {
  it("removes Lucene operators from user-entered product names", () => {
    expect(normalizeCatalogQuery('milch OR -brands:"secret" && vegan*')).toBe("milch brands secret vegan");
  });

  it("normalizes real search hits and drops invalid or duplicate products", () => {
    expect(normalizeOpenFoodFactsSearch({
      hits: [
        {
          code: "4058172307409",
          product_name_de: "Haferflocken Feinblatt",
          brands: ["dmBio", "dm Bio"],
          quantity: "1 kg",
          image_front_small_url: "https://images.openfoodfacts.org/images/products/405/817/230/7409/front_de.4.200.jpg",
          nutriscore_grade: "A",
          nutriments: { "energy-kcal_100g": 372, proteins_100g: 13.5, carbohydrates_100g: 58.7, fat_100g: 7 }
        },
        { code: "4058172307409", product_name: "Duplicate" },
        { code: "no-code", product_name: "Invalid" },
        { code: "12345678", product_name: "Invalid check digit" }
      ],
      page: 1,
      page_size: 12,
      page_count: 4,
      count: 37,
      is_count_exact: true,
      timed_out: false
    }, "2026-08-05T12:00:00.000Z")).toEqual({
      items: [{
        barcode: "4058172307409",
        name: "Haferflocken Feinblatt",
        brand: "dmBio",
        quantity: "1 kg",
        imageUrl: "https://images.openfoodfacts.org/images/products/405/817/230/7409/front_de.4.200.jpg",
        nutriScore: "a",
        nutrition: { kcal100g: 372, protein100g: 13.5, carbs100g: 58.7, fat100g: 7 },
        source: "open-food-facts",
        confidence: 0.86,
        sourceUrl: "https://world.openfoodfacts.org/product/4058172307409",
        sourceRetrievedAt: "2026-08-05T12:00:00.000Z",
        databaseLicense: "ODbL-1.0"
      }],
      count: 37,
      countExact: true,
      hasMore: true
    });
  });

  it("uses a bounded POST request and only asks for approved catalog fields", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      hits: [], page: 1, page_size: 12, page_count: 0, count: 0, is_count_exact: true, timed_out: false
    }), { status: 200 }));

    await searchOpenFoodFacts("Haferflocken", 1, 12, fetcher, "FoodOS/0.1 (ops@example.com)");

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://search.openfoodfacts.org/search");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({ q: "Haferflocken", page: 1, page_size: 12, langs: ["de", "en"] });
    expect(JSON.parse(String(init?.body)).fields).not.toContain("ingredients_text");
    expect(JSON.parse(String(init?.body)).fields).toContain("nutriments");
    expect(init?.headers).toMatchObject({ "User-Agent": "FoodOS/0.1 (ops@example.com)" });
  });
});
