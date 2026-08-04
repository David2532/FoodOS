import { describe, expect, it, vi } from "vitest";
import { normalizeCatalogQuery, normalizeOpenFoodFactsSearch, searchOpenFoodFacts } from "./open-food-facts-search";

describe("Open Food Facts catalog search", () => {
  it("removes Lucene operators from user-entered product names", () => {
    expect(normalizeCatalogQuery('milch OR -brands:"secret" && vegan*')).toBe("milch brands secret vegan");
  });

  it("normalizes real search hits and drops invalid or duplicate products", () => {
    expect(normalizeOpenFoodFactsSearch({
      hits: [
        { code: "4058172307409", product_name_de: "Haferflocken Feinblatt", brands: ["dmBio", "dm Bio"], quantity: "1 kg", nutriscore_grade: "A" },
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
    })).toEqual({
      items: [{
        barcode: "4058172307409",
        name: "Haferflocken Feinblatt",
        brand: "dmBio",
        quantity: "1 kg",
        nutriScore: "a",
        source: "open-food-facts",
        confidence: 0.86
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

    await searchOpenFoodFacts("Haferflocken", 1, 12, fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://search.openfoodfacts.org/search");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({ q: "Haferflocken", page: 1, page_size: 12, langs: ["de", "en"] });
    expect(JSON.parse(String(init?.body)).fields).not.toContain("ingredients_text");
  });
});
