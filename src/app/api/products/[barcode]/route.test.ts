import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "catalog-user" } as { id: string } | null,
  aal: "aal2" as "aal1" | "aal2",
  globalError: false,
  globalRows: [] as unknown[],
  providerNormalizer: vi.fn()
}));

vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: state.aal }, error: null }) }
    },
    from: (table: string) => {
      if (table === "user_food_risk_profiles") {
        return { select: () => ({ order: async () => ({ data: [], error: null }) }) };
      }
      return { select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
    },
    rpc: async (name: string) => name === "lookup_global_catalog_product"
      ? (state.globalError ? { data: null, error: { message: "unavailable" } } : { data: state.globalRows, error: null })
      : { data: null, error: { message: "unexpected RPC" } }
  })
}));
vi.mock("@/lib/open-food-facts", () => ({
  normalizeOpenFoodFacts: (...args: unknown[]) => state.providerNormalizer(...args)
}));

import { GET } from "./route";

const globalProduct = {
  barcode: "3017624010701",
  name: "Globales Testprodukt",
  brand: "FoodOS Marke",
  image_url: null,
  quantity: "500 g",
  nutri_score: "a",
  nova_group: 2,
  serving_size: "50 g",
  categories: ["en:breakfast-cereals"],
  countries: ["en:germany"],
  labels: ["en:organic"],
  ingredients_text: "Haferflocken",
  structured_ingredients: [{ name: "Haferflocken", normalizedName: "en:oats", percentage: 100 }],
  allergens: ["en:oats"],
  traces: ["en:nuts"],
  additives: ["en:e300"],
  nutrition_per_100g: { energy_kcal_100g: 370, proteins_100g: 13, carbohydrates_100g: 60, fat_100g: 7 },
  confidence: 0.9,
  source_url: "https://world.openfoodfacts.org/product/3017624010701",
  source_language: "de",
  source_updated_at: "2026-08-04T09:00:00.000Z",
  source_retrieved_at: "2026-08-04T10:00:00.000Z",
  database_license: "ODbL-1.0; DbCL-1.0",
  image_license: "CC-BY-SA-4.0"
};

describe("Q-CATALOG-LAYERED-LOOKUP-005 global GTIN lookup", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    state.user = { id: "catalog-user" };
    state.aal = "aal2";
    state.globalError = false;
    state.globalRows = [globalProduct];
    state.providerNormalizer.mockReset();
  });

  it("uses the AAL2 global projection before the live provider and preserves source metadata", async () => {
    const response = await GET(new Request("http://localhost/api/products/3017624010701"), {
      params: Promise.resolve({ barcode: "3017624010701" })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("X-FoodOS-Product-Source")).toBe("global-catalog");
    await expect(response.json()).resolves.toMatchObject({
      globalCatalogStatus: "live",
      product: {
        barcode: "3017624010701",
        source: "global-catalog",
        nutrition: { kcal100g: 370, protein100g: 13 },
        ingredientsText: "Haferflocken",
        allergens: ["oats"],
        sourceUpdatedAt: "2026-08-04T09:00:00.000Z",
        retrievedAt: "2026-08-04T10:00:00.000Z",
        databaseLicense: "ODbL-1.0; DbCL-1.0"
      }
    });
    expect(state.providerNormalizer).not.toHaveBeenCalled();
  });

  it("requires authentication and AAL2 before the shared catalog projection", async () => {
    state.user = null;
    expect((await GET(new Request("http://localhost/api/products/3017624010701"), {
      params: Promise.resolve({ barcode: "3017624010701" })
    })).status).toBe(401);

    state.user = { id: "catalog-user" };
    state.aal = "aal1";
    expect((await GET(new Request("http://localhost/api/products/3017624010701"), {
      params: Promise.resolve({ barcode: "3017624010701" })
    })).status).toBe(403);
  });

  it("fails closed to the visible manual path when no monitored provider identity is configured", async () => {
    const originalUserAgent = process.env.OPEN_FOOD_FACTS_USER_AGENT;
    delete process.env.OPEN_FOOD_FACTS_USER_AGENT;
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    state.globalRows = [];

    try {
      const response = await GET(new Request("http://localhost/api/products/3017624010701"), {
        params: Promise.resolve({ barcode: "3017624010701" })
      });
      expect(response.status).toBe(503);
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      if (originalUserAgent === undefined) delete process.env.OPEN_FOOD_FACTS_USER_AGENT;
      else process.env.OPEN_FOOD_FACTS_USER_AGENT = originalUserAgent;
    }
  });

  it("keeps preview lookup public-source-only and away from AAL2 catalog projections", async () => {
    const originalUserAgent = process.env.OPEN_FOOD_FACTS_USER_AGENT;
    process.env.OPEN_FOOD_FACTS_USER_AGENT = "FoodOS/0.1 (ops@example.com)";
    state.user = null;
    state.providerNormalizer.mockReturnValue({
      barcode: "3017624010701",
      name: "Öffentliches Preview-Produkt",
      categories: [],
      countries: [],
      labels: [],
      structuredIngredients: [],
      allergens: [],
      traces: [],
      additives: [],
      nutrition: {},
      assessments: [],
      source: "open-food-facts",
      retrievedAt: "2026-08-04T10:00:00.000Z",
      confidence: 0.8
    });
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ product: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    try {
      const response = await GET(new Request("http://localhost/api/products/3017624010701?preview=1"), {
        params: Promise.resolve({ barcode: "3017624010701" })
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("X-FoodOS-Product-Source")).toBe("public-preview");
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining("/api/v3/product/3017624010701.json?"),
        expect.any(Object)
      );
      expect(fetcher.mock.calls[0]?.[0]).not.toContain("/api/v3.6/");
      await expect(response.json()).resolves.toMatchObject({
        globalCatalogStatus: "not-configured",
        product: { source: "open-food-facts", name: "Öffentliches Preview-Produkt" }
      });
    } finally {
      if (originalUserAgent === undefined) delete process.env.OPEN_FOOD_FACTS_USER_AGENT;
      else process.env.OPEN_FOOD_FACTS_USER_AGENT = originalUserAgent;
    }
  });
});
