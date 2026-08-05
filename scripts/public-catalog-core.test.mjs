import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalJson, normalizePublicCatalogProduct, sha256 } from "./public-catalog-core.mjs";
import {
  activateProductCatalogImport,
  assertIntegrity,
  parseSealBatchResult,
  readLines,
  sourceDescriptor,
  sourceStream
} from "./import-public-catalog.mjs";

const germanyProduct = {
  code: "4006381333931",
  product_name_de: "Testprodukt",
  brands: "FoodOS Test",
  countries_tags: ["en:germany"],
  ingredients_text_de: "Wasser, Hafer",
  allergens_tags: ["en:oats"],
  nutriments: { "energy-kcal_100g": 90, proteins_100g: 3.2, carbohydrates_100g: 12 },
  last_modified_t: 1_700_000_000
};

describe("public catalog dump normalizer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("allowlists a real dump shape without retaining unknown fields", () => {
    const normalized = normalizePublicCatalogProduct({ ...germanyProduct, internal_unknown: "never persist" });
    expect(normalized.kind).toBe("accepted");
    if (normalized.kind !== "accepted") return;
    expect(normalized.product).toMatchObject({ gtin: "4006381333931", name: "Testprodukt", source_provider: "open-food-facts" });
    expect(normalized.product).not.toHaveProperty("internal_unknown");
    expect(normalized.product.nutrition_per_100g).toEqual(expect.objectContaining({ energy_kcal_100g: 90 }));
    expect(normalized.product.source_updated_at).toBe("2023-11-14T22:13:20.000Z");
    expect(normalized.product.normalized_content_sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps missing facts unknown instead of estimating them", () => {
    const normalized = normalizePublicCatalogProduct({ code: "4006381333931", product_name: "Ohne Fakten", countries_tags: ["en:germany"] });
    expect(normalized.kind).toBe("accepted");
    if (normalized.kind !== "accepted") return;
    expect(normalized.product.nutrition_per_100g).toEqual({});
    expect(normalized.product.completeness).toBeUndefined();
    expect(normalized.product).not.toHaveProperty("ingredients_text");
  });

  it("retains the documented bulk-image field without inventing an image", () => {
    const normalized = normalizePublicCatalogProduct({
      ...germanyProduct,
      image_url: "https://images.openfoodfacts.org/images/products/400/638/133/3931/front_de.3.400.jpg"
    });
    expect(normalized).toMatchObject({ kind: "accepted" });
    if (normalized.kind !== "accepted") return;
    expect(normalized.product).toMatchObject({
      image_url: "https://images.openfoodfacts.org/images/products/400/638/133/3931/front_de.3.400.jpg",
      image_license: "CC-BY-SA-4.0 (verify image-specific rights before reuse)"
    });
  });

  it("filters non-Germany records and rejects invalid GTINs and impossible nutrition", () => {
    expect(normalizePublicCatalogProduct({ ...germanyProduct, countries_tags: ["en:france"] })).toMatchObject({ kind: "filtered" });
    expect(normalizePublicCatalogProduct({ ...germanyProduct, code: "4006381333932" })).toMatchObject({ kind: "rejected", reason: "invalid-gtin" });
    expect(normalizePublicCatalogProduct({ ...germanyProduct, nutriments: { fat_100g: -1 } })).toMatchObject({ kind: "rejected", reason: "invalid-nutrition" });
  });

  it("omits invalid constrained provider values and invalid source timestamps", () => {
    const normalized = normalizePublicCatalogProduct({
      ...germanyProduct,
      nutriscore_grade: "unknown",
      nova_group: 0,
      last_modified_datetime: "not-a-timestamp",
      last_modified_t: "also-not-a-timestamp"
    });
    expect(normalized.kind).toBe("accepted");
    if (normalized.kind !== "accepted") return;
    expect(normalized.product).not.toHaveProperty("nutri_score");
    expect(normalized.product).not.toHaveProperty("nova_group");
    expect(normalized.product).not.toHaveProperty("source_updated_at");
  });

  it("hashes semantically identical records deterministically without import-time retrieval noise", () => {
    expect(canonicalJson({ b: [2, 1], a: "x" })).toBe(canonicalJson({ a: "x", b: [2, 1] }));
    expect(sha256({ b: 1, a: 2 })).toBe(sha256({ a: 2, b: 1 }));
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-04T10:00:00Z"));
      const first = normalizePublicCatalogProduct(germanyProduct);
      vi.setSystemTime(new Date("2026-08-04T10:01:00Z"));
      const second = normalizePublicCatalogProduct(germanyProduct);
      expect(first).toMatchObject({ kind: "accepted" });
      expect(second).toMatchObject({ kind: "accepted" });
      if (first.kind === "accepted" && second.kind === "accepted") {
        expect(first.product.source_retrieved_at).not.toBe(second.product.source_retrieved_at);
        expect(first.product.normalized_content_sha256).toBe(second.product.normalized_content_sha256);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("calls the activation RPC with its database argument contract", async () => {
    const rpc = vi.fn(async () => ({ data: 1, error: null }));
    await activateProductCatalogImport({ rpc }, "00000000-0000-4000-8000-000000000001");
    expect(rpc).toHaveBeenCalledWith("activate_product_catalog_import", {
      target_import_run_id: "00000000-0000-4000-8000-000000000001"
    });
  });

  it("accepts only a bounded catalog seal RPC result", () => {
    expect(parseSealBatchResult({ sealed_product_count: 1_000, is_complete: false }))
      .toEqual({ sealed_product_count: 1_000, is_complete: false });
    expect(() => parseSealBatchResult({ sealed_product_count: -1, is_complete: false }))
      .toThrow("catalog-import-seal-invalid");
    expect(() => parseSealBatchResult({ sealed_product_count: 1_000, is_complete: "yes" }))
      .toThrow("catalog-import-seal-invalid");
  });

  it("allows only reviewed source hosts and follows an allowed redirect once", async () => {
    expect(sourceDescriptor("https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz")).toMatchObject({
      isRemote: true,
      compressed: true
    });
    expect(() => sourceDescriptor("https://untrusted.example/products.jsonl.gz")).toThrow("unapproved-source-host");

    const fetcher = vi.fn(async () => fetcher.mock.calls.length === 1
      ? new Response(null, {
        status: 302,
        headers: { location: "https://openfoodfacts-ds.s3.eu-west-3.amazonaws.com/openfoodfacts-products.jsonl.gz" }
      })
      : new Response("{\"code\":\"4006381333931\"}\n", {
        status: 200,
        headers: { etag: '"reviewed-revision"' }
      }));
    vi.stubGlobal("fetch", fetcher);

    const input = await sourceStream({
      value: "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz",
      isRemote: true,
      compressed: false
    }, new AbortController().signal, "FoodOS/0.1 (ops@example.com)");
    const chunks = [];
    for await (const chunk of input.stream) chunks.push(String(chunk));

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(chunks.join("")).toContain("4006381333931");
    expect(input.sourceRevision).toBe("reviewed-revision");
  });

  it("fails closed on an oversized JSONL line and rejects inconsistent importer counters", async () => {
    const lines = readLines(Readable.from([`${"x".repeat(512 * 1024 + 1)}\n`]), false);
    await expect((async () => {
      for await (const line of lines) {
        // Iteration is only used to surface the transform's bounded-line contract.
        void line;
      }
    })()).rejects.toThrow("catalog-line-too-large");

    const integrity = {
      persisted_product_count: 25_000,
      invalid_gtin_count: 0,
      mismatched_product_hash_count: 0,
      nutrition_evidence_count: 100,
      ingredients_evidence_count: 100,
      allergen_evidence_count: 100,
      provenance_evidence_count: 25_000,
      normalized_content_sha256: "a".repeat(64)
    };
    expect(assertIntegrity(integrity, {
      attempted: 25_004,
      rejected: 1,
      filtered: 1,
      candidates: 25_002,
      minimumAccepted: 25_000,
      minimumRatio: 0.001
    })).toEqual({ persisted: 25_000, duplicates: 2 });
    expect(() => assertIntegrity(integrity, {
      attempted: 25_003,
      rejected: 1,
      filtered: 1,
      candidates: 25_002,
      minimumAccepted: 25_000,
      minimumRatio: 0.001
    })).toThrow("catalog-import-counter-integrity-failed");
  });
});
