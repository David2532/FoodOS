import { NextResponse } from "next/server";
import { z } from "zod";
import { catalogSearchQuerySchema, catalogSearchResponseSchema, type CatalogSearchItem } from "@/contracts/catalog";
import { searchOpenFoodFacts } from "@/lib/open-food-facts-search";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const cachedRowSchema = z.object({
  barcode: z.string().regex(/^\d{8,14}$/),
  name: z.string(),
  brand: z.string().nullable(),
  image_url: z.string().nullable(),
  quantity: z.string().nullable(),
  nutri_score: z.string().nullable(),
  confidence: z.coerce.number()
});

const globalCatalogRowSchema = z.object({
  barcode: z.string().regex(/^\d{8,14}$/),
  name: z.string(),
  brand: z.string().nullable(),
  image_url: z.string().nullable(),
  quantity: z.string().nullable(),
  nutri_score: z.string().nullable(),
  confidence: z.coerce.number(),
  source_url: z.string().nullable(),
  source_updated_at: z.string().nullable(),
  source_retrieved_at: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  database_license: z.string().nullable(),
  image_license: z.string().nullable()
});

const searchWindows = new Map<string, { startedAt: number; count: number }>();
const PAGE_SIZE = 12;

function allowSearch(key: string, now = Date.now()): boolean {
  const current = searchWindows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    searchWindows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= 8) return false;
  current.count += 1;
  return true;
}

async function searchHouseholdCache(supabase: SupabaseClient | null, query: string, page: number): Promise<CatalogSearchItem[]> {
  if (!supabase || page !== 1) return [];
  const result = await supabase.rpc("search_cached_products", { search_text: query, result_limit: 8 });
  if (result.error) return [];
  return z.array(cachedRowSchema).parse(result.data).map((row) => ({
    barcode: row.barcode,
    name: row.name,
    brand: row.brand ?? undefined,
    imageUrl: row.image_url && z.url().safeParse(row.image_url).success ? row.image_url : undefined,
    quantity: row.quantity ?? undefined,
    nutriScore: row.nutri_score && /^[a-e]$/i.test(row.nutri_score)
      ? row.nutri_score.toLowerCase() as "a" | "b" | "c" | "d" | "e"
      : undefined,
    source: "household-cache",
    confidence: Math.max(0, Math.min(1, row.confidence))
  }));
}

function validUrl(value: string | null): string | undefined {
  return value && z.url().safeParse(value).success ? value : undefined;
}

function validIsoDate(value: string | null): string | undefined {
  if (!value || Number.isNaN(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

async function searchGlobalCatalog(supabase: SupabaseClient | null, query: string, page: number): Promise<{
  items: CatalogSearchItem[];
  status: "live" | "unavailable" | "not-configured";
}> {
  if (!supabase) return { items: [], status: "not-configured" };
  if (page !== 1) return { items: [], status: "live" };

  const result = await supabase.rpc("search_global_catalog_products", { search_text: query, result_limit: 8 });
  if (result.error) return { items: [], status: "unavailable" };

  const parsed = z.array(globalCatalogRowSchema).safeParse(result.data);
  if (!parsed.success) return { items: [], status: "unavailable" };
  return {
    status: "live",
    items: parsed.data.map((row) => ({
      barcode: row.barcode,
      name: row.name,
      brand: row.brand ?? undefined,
      imageUrl: validUrl(row.image_url),
      quantity: row.quantity ?? undefined,
      nutriScore: row.nutri_score && /^[a-e]$/i.test(row.nutri_score)
        ? row.nutri_score.toLowerCase() as "a" | "b" | "c" | "d" | "e"
        : undefined,
      source: "global-catalog",
      confidence: Math.max(0, Math.min(1, row.confidence)),
      sourceUrl: validUrl(row.source_url),
      sourceUpdatedAt: validIsoDate(row.source_updated_at),
      sourceRetrievedAt: validIsoDate(row.source_retrieved_at),
      databaseLicense: row.database_license ?? undefined,
      imageLicense: row.image_license ?? undefined
    }))
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = catalogSearchQuerySchema.safeParse({ query: url.searchParams.get("q") ?? "", page: url.searchParams.get("page") ?? 1 });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Suche." }, {
      status: 400,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const supabase = isSupabaseConfigured() ? await createSupabaseServerClient() : null;
  const userResult = supabase ? await supabase.auth.getUser() : null;
  if (supabase && (userResult?.error || !userResult?.data.user)) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }
  if (supabase) {
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || assurance.data.currentLevel !== "aal2") {
      return NextResponse.json({ error: "Zwei-Faktor-Bestätigung erforderlich." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
  }

  const rateKey = userResult?.data.user?.id ?? "local-preview";
  if (!allowSearch(rateKey)) {
    return NextResponse.json({ error: "Zu viele Katalogsuchen. Warte bitte eine Minute." }, {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" }
    });
  }

  const cached = await searchHouseholdCache(supabase, parsed.data.query, parsed.data.page);
  const globalCatalog = await searchGlobalCatalog(supabase, parsed.data.query, parsed.data.page);
  const localResults = [...cached, ...globalCatalog.items];
  const localBarcodes = new Set<string>();
  const uniqueLocalResults = localResults.filter((item) => {
    if (localBarcodes.has(item.barcode)) return false;
    localBarcodes.add(item.barcode);
    return true;
  });

  if (parsed.data.page === 1 && uniqueLocalResults.length >= PAGE_SIZE) {
    return NextResponse.json(catalogSearchResponseSchema.parse({
      query: parsed.data.query,
      page: parsed.data.page,
      pageSize: PAGE_SIZE,
      providerCount: 0,
      providerCountExact: false,
      cachedCount: cached.length,
      globalCatalogCount: globalCatalog.items.length,
      globalCatalogStatus: globalCatalog.status,
      providerStatus: "not-needed",
      hasMore: false,
      results: uniqueLocalResults.slice(0, PAGE_SIZE)
    }), { headers: { "Cache-Control": "private, no-store", "X-FoodOS-Catalog-Source": "layered" } });
  }

  try {
    const provider = await searchOpenFoodFacts(parsed.data.query, parsed.data.page, PAGE_SIZE);
    const seenBarcodes = new Set<string>();
    const results = [...cached, ...globalCatalog.items, ...provider.items].filter((item) => {
      if (seenBarcodes.has(item.barcode)) return false;
      seenBarcodes.add(item.barcode);
      return true;
    }).slice(0, 20);
    return NextResponse.json(catalogSearchResponseSchema.parse({
      query: parsed.data.query,
      page: parsed.data.page,
      pageSize: PAGE_SIZE,
      providerCount: provider.count,
      providerCountExact: provider.countExact,
      cachedCount: cached.length,
      globalCatalogCount: globalCatalog.items.length,
      globalCatalogStatus: globalCatalog.status,
      providerStatus: "live",
      hasMore: provider.hasMore,
      results
    }), { headers: { "Cache-Control": "private, no-store", "X-FoodOS-Catalog-Source": "layered" } });
  } catch {
    const results = uniqueLocalResults;
    if (results.length) {
      return NextResponse.json(catalogSearchResponseSchema.parse({
        query: parsed.data.query,
        page: parsed.data.page,
        pageSize: PAGE_SIZE,
        providerCount: 0,
        providerCountExact: false,
        cachedCount: cached.length,
        globalCatalogCount: globalCatalog.items.length,
        globalCatalogStatus: globalCatalog.status,
        providerStatus: "unavailable",
        hasMore: false,
        results
      }), { headers: { "Cache-Control": "private, no-store", "X-FoodOS-Catalog-Source": "layered" } });
    }
    return NextResponse.json({ error: "Der öffentliche Lebensmittelkatalog ist gerade nicht erreichbar. Versuche es erneut oder nutze den Barcode." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
