import { z } from "zod";
import type { CatalogSearchItem } from "@/contracts/catalog";
import { hasValidGtinCheckDigit } from "@/domain/gs1";
import { requireOpenFoodFactsUserAgent } from "@/lib/open-food-facts-user-agent";

const externalProductSchema = z.object({
  code: z.string().optional(),
  product_name: z.string().optional(),
  product_name_de: z.string().optional(),
  brands: z.union([z.string(), z.array(z.string())]).optional(),
  quantity: z.string().optional(),
  image_front_small_url: z.string().url().optional(),
  nutriscore_grade: z.string().optional(),
  nutriments: z.record(z.string(), z.unknown()).optional()
});

const externalSearchResponseSchema = z.object({
  hits: z.array(externalProductSchema).max(100),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  page_count: z.number().int().nonnegative(),
  count: z.number().int().nonnegative(),
  is_count_exact: z.boolean().default(false),
  timed_out: z.boolean().default(false)
});

export interface OpenFoodFactsSearchResult {
  items: CatalogSearchItem[];
  count: number;
  countExact: boolean;
  hasMore: boolean;
}

export function normalizeCatalogQuery(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[+\-!(){}\[\]^"~*?:\\/]|&&|\|\|/g, " ")
    .replace(/\b(?:AND|OR|NOT)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstBrand(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value?.split(",")[0];
  return candidate?.trim() || undefined;
}

function nutrient(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function normalizeOpenFoodFactsSearch(raw: unknown, retrievedAt = new Date().toISOString()): OpenFoodFactsSearchResult {
  const response = externalSearchResponseSchema.parse(raw);
  if (response.timed_out) throw new Error("Open Food Facts search timed out");

  const seen = new Set<string>();
  const items: CatalogSearchItem[] = [];
  for (const hit of response.hits) {
    const barcode = hit.code?.trim();
    const name = hit.product_name_de?.trim() || hit.product_name?.trim();
    if (!barcode || !hasValidGtinCheckDigit(barcode) || !name || seen.has(barcode)) continue;
    seen.add(barcode);
    const grade = hit.nutriscore_grade?.toLowerCase();
    items.push({
      barcode,
      name: name.slice(0, 240),
      brand: firstBrand(hit.brands)?.slice(0, 240),
      quantity: hit.quantity?.trim().slice(0, 120) || undefined,
      imageUrl: hit.image_front_small_url,
      nutriScore: grade && /^[a-e]$/.test(grade) ? grade as "a" | "b" | "c" | "d" | "e" : undefined,
      nutrition: {
        kcal100g: nutrient(hit.nutriments?.["energy-kcal_100g"]),
        protein100g: nutrient(hit.nutriments?.proteins_100g),
        carbs100g: nutrient(hit.nutriments?.carbohydrates_100g),
        fat100g: nutrient(hit.nutriments?.fat_100g),
        sugar100g: nutrient(hit.nutriments?.sugars_100g),
        saturatedFat100g: nutrient(hit.nutriments?.["saturated-fat_100g"]),
        fiber100g: nutrient(hit.nutriments?.fiber_100g),
        salt100g: nutrient(hit.nutriments?.salt_100g)
      },
      source: "open-food-facts",
      confidence: hit.product_name_de ? 0.86 : 0.78,
      sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
      sourceRetrievedAt: retrievedAt,
      databaseLicense: "ODbL-1.0"
    });
  }

  return {
    items,
    count: response.count,
    countExact: response.is_count_exact,
    hasMore: response.page < response.page_count
  };
}

export async function searchOpenFoodFacts(
  query: string,
  page: number,
  pageSize: number,
  fetcher: typeof fetch = fetch,
  userAgent = requireOpenFoodFactsUserAgent()
): Promise<OpenFoodFactsSearchResult> {
  const normalizedQuery = normalizeCatalogQuery(query);
  if (normalizedQuery.length < 2) throw new Error("Search query is too short");

  const response = await fetcher("https://search.openfoodfacts.org/search", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": userAgent
    },
    body: JSON.stringify({
      q: normalizedQuery,
      langs: ["de", "en"],
      page,
      page_size: pageSize,
      boost_phrase: true,
      fields: [
        "code",
        "product_name",
        "product_name_de",
        "brands",
        "quantity",
        "image_front_small_url",
        "nutriscore_grade",
        "nutriments"
      ]
    }),
    signal: AbortSignal.timeout(7_000),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Open Food Facts search returned ${response.status}`);
  return normalizeOpenFoodFactsSearch(await response.json() as unknown);
}
