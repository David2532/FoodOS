import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  user: { id: "catalog-user" } as { id: string } | null,
  aal: "aal2" as "aal1" | "aal2",
  cacheRows: [] as unknown[],
  globalRows: [] as unknown[],
  globalError: false,
  provider: vi.fn()
}));

vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: testState.user }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: testState.aal }, error: null }) }
    },
    rpc: async (name: string) => {
      if (name === "search_cached_products") return { data: testState.cacheRows, error: null };
      if (name === "search_global_catalog_products") {
        return testState.globalError
          ? { data: null, error: { message: "global catalog unavailable" } }
          : { data: testState.globalRows, error: null };
      }
      return { data: null, error: { message: "unexpected RPC" } };
    }
  })
}));
vi.mock("@/lib/open-food-facts-search", () => ({
  searchOpenFoodFacts: (...args: unknown[]) => testState.provider(...args)
}));

import { GET } from "./route";

describe("Q-CATALOG-LAYERED-API-004 product catalog search", () => {
  beforeEach(() => {
    testState.user = { id: "catalog-user" };
    testState.aal = "aal2";
    testState.cacheRows = [{
      barcode: "4058172307409", name: "Haushaltsprodukt", brand: null, image_url: null, quantity: null, nutri_score: null, confidence: 1
    }];
    testState.globalRows = [{
      barcode: "3017624010701", name: "Globales Produkt", brand: "Marke", image_url: null, quantity: "100 g", nutri_score: "b", confidence: "0.88",
      source_url: "https://world.openfoodfacts.org/product/3017624010701", source_updated_at: "2026-08-04T09:00:00Z", source_retrieved_at: "2026-08-04T10:00:00Z", database_license: "ODbL-1.0", image_license: "CC-BY-SA-4.0"
    }];
    testState.globalError = false;
    testState.provider.mockReset();
    testState.provider.mockResolvedValue({
      items: [
        { barcode: "3017624010701", name: "Provider-Duplikat", source: "open-food-facts", confidence: 0.8 },
        { barcode: "5449000000996", name: "Provider-Produkt", source: "open-food-facts", confidence: 0.8 }
      ],
      count: 2,
      countExact: true,
      hasMore: false
    });
  });

  it("keeps household cache first, then the global catalog, and deduplicates the live fallback", async () => {
    const response = await GET(new Request("http://localhost/api/products/search?q=Haferflocken&page=1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      cachedCount: 1,
      globalCatalogCount: 1,
      globalCatalogStatus: "live",
      providerStatus: "live",
      results: [
        { barcode: "4058172307409", source: "household-cache" },
        { barcode: "3017624010701", source: "global-catalog", databaseLicense: "ODbL-1.0" },
        { barcode: "5449000000996", source: "open-food-facts" }
      ]
    });
    expect(testState.provider).toHaveBeenCalledOnce();
  });

  it("shows the global catalog as degraded while retaining a live provider fallback", async () => {
    testState.cacheRows = [];
    testState.globalError = true;

    const response = await GET(new Request("http://localhost/api/products/search?q=Haferflocken&page=1"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      globalCatalogCount: 0,
      globalCatalogStatus: "unavailable",
      providerStatus: "live"
    });
    expect(body.results).toContainEqual(expect.objectContaining({ source: "open-food-facts" }));
  });

  it("does not disclose a search to the external provider when private and shared catalog results fill the page", async () => {
    testState.cacheRows = Array.from({ length: 8 }, (_, index) => ({
      barcode: `40000000000${index}`, name: `Haushalt ${index}`, brand: null, image_url: null, quantity: null, nutri_score: null, confidence: 1
    }));
    testState.globalRows = Array.from({ length: 8 }, (_, index) => ({
      barcode: `50000000000${index}`, name: `Katalog ${index}`, brand: null, image_url: null, quantity: null, nutri_score: null, confidence: 0.8,
      source_url: null, source_updated_at: null, source_retrieved_at: "2026-08-04T10:00:00Z", database_license: null, image_license: null
    }));

    const response = await GET(new Request("http://localhost/api/products/search?q=Haferflocken&page=1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      providerStatus: "not-needed",
      cachedCount: 8,
      globalCatalogCount: 8,
      results: expect.arrayContaining([
        expect.objectContaining({ source: "household-cache" }),
        expect.objectContaining({ source: "global-catalog" })
      ])
    });
    expect(testState.provider).not.toHaveBeenCalled();
  });

  it("keeps AAL1 and unauthenticated sessions out of the catalog boundary", async () => {
    testState.user = null;
    expect((await GET(new Request("http://localhost/api/products/search?q=Haferflocken&page=1"))).status).toBe(401);

    testState.user = { id: "catalog-user" };
    testState.aal = "aal1";
    expect((await GET(new Request("http://localhost/api/products/search?q=Haferflocken&page=1"))).status).toBe(403);
  });
});
