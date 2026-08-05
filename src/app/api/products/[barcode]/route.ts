import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeOpenFoodFacts } from "@/lib/open-food-facts";
import { requireOpenFoodFactsUserAgent } from "@/lib/open-food-facts-user-agent";
import { productApiResponseSchema } from "@/contracts/product";
import { isPublicCatalogPreviewRequest } from "@/lib/catalog-preview";
import { normalizeCachedProduct } from "@/lib/product-cache";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assessIngredientFacts, personalizeProductAssessments, type FoodRiskPreference } from "@/domain/ingredient-relevance";
import type { Product } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const barcodeSchema = z.string().regex(/^\d{8,14}$/, "Barcode muss 8 bis 14 Ziffern enthalten.");
const fields = [
  "code", "product_name", "product_name_de", "generic_name_de", "brands", "quantity",
  "image_front_url", "image_front_small_url", "ingredients_text", "ingredients_text_de",
  "serving_size", "ingredients", "allergens_tags", "traces_tags", "additives_tags",
  "labels_tags", "categories_tags", "countries_tags", "nutriscore_grade", "nova_group",
  "lang", "nutriments"
].join(",");

const catalogTimestampSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)));
const catalogNutritionNumber = z.coerce.number().finite().nonnegative();
const globalCatalogRowSchema = z.object({
  barcode: z.string().regex(/^\d{8,14}$/),
  name: z.string().min(1).max(240),
  brand: z.string().nullable(),
  image_url: z.string().nullable(),
  quantity: z.string().nullable(),
  nutri_score: z.string().nullable(),
  nova_group: z.coerce.number().int().min(1).max(4).nullable(),
  serving_size: z.string().nullable(),
  categories: z.array(z.string().min(1).max(160)).max(100),
  countries: z.array(z.string().min(1).max(160)).max(100),
  labels: z.array(z.string().min(1).max(160)).max(100),
  ingredients_text: z.string().nullable(),
  structured_ingredients: z.array(z.object({
    name: z.string().min(1).max(500),
    normalizedName: z.string().max(240).optional(),
    percentage: z.coerce.number().finite().min(0).max(100).optional()
  })).max(500),
  allergens: z.array(z.string().min(1).max(160)).max(100),
  traces: z.array(z.string().min(1).max(160)).max(100),
  additives: z.array(z.string().min(1).max(80)).max(100),
  nutrition_per_100g: z.object({
    energy_kcal_100g: catalogNutritionNumber.max(1_200).optional(),
    proteins_100g: catalogNutritionNumber.max(100).optional(),
    carbohydrates_100g: catalogNutritionNumber.max(100).optional(),
    sugars_100g: catalogNutritionNumber.max(100).optional(),
    fat_100g: catalogNutritionNumber.max(100).optional(),
    "saturated-fat_100g": catalogNutritionNumber.max(100).optional(),
    fiber_100g: catalogNutritionNumber.max(100).optional(),
    salt_100g: catalogNutritionNumber.max(100).optional()
  }),
  confidence: z.coerce.number(),
  source_url: z.string().nullable(),
  source_language: z.string().nullable(),
  source_updated_at: z.string().nullable(),
  source_retrieved_at: catalogTimestampSchema,
  database_license: z.string().nullable(),
  image_license: z.string().nullable()
});

const lookupWindows = new Map<string, { startedAt: number; count: number }>();
let providerFailures = 0;
let providerOpenUntil = 0;

function allowLookup(key: string, now = Date.now()): boolean {
  const current = lookupWindows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    lookupWindows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= 7) return false;
  current.count += 1;
  return true;
}

function retryDelay(attempt: number) {
  return new Promise((resolve) => setTimeout(resolve, 120 * 2 ** attempt));
}

async function fetchProduct(barcode: string) {
  if (Date.now() < providerOpenUntil) throw new Error("Product provider circuit is open");
  const userAgent = requireOpenFoodFactsUserAgent();
  const endpoints = [
    `https://world.openfoodfacts.org/api/v3/product/${barcode}.json?fields=${fields}`,
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`
  ];

  try {
    for (const endpoint of endpoints) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(endpoint, {
          headers: { "User-Agent": userAgent, Accept: "application/json" },
          signal: AbortSignal.timeout(6_000),
          next: { revalidate: 60 * 60 * 24 * 7 }
        });
        if (response.ok) {
          providerFailures = 0;
          const body: unknown = await response.json();
          if (body && typeof body === "object" && "product" in body) return body;
          break;
        }
        if (response.status !== 429 && response.status < 500) break;
        if (attempt === 0) await retryDelay(attempt);
      }
    }
    providerFailures = 0;
  } catch (error) {
    providerFailures += 1;
    if (providerFailures >= 4) providerOpenUntil = Date.now() + 30_000;
    throw error;
  }
  return null;
}

async function findCachedProduct(supabase: SupabaseClient | null, barcode: string) {
  if (!supabase) return null;
  const result = await supabase
    .from("products")
    .select("gtin, name, brand, image_url, ingredients_text, source_updated_at, data_confidence, product_nutrition(energy_kcal, protein_g, carbohydrates_g, sugars_g, fat_g, saturated_fat_g, fiber_g, salt_g), product_metadata(field_key, value_json)")
    .eq("gtin", barcode)
    .limit(1)
    .maybeSingle();
  if (result.error || !result.data) return null;
  return normalizeCachedProduct(result.data);
}

function validUrl(value: string | null): string | undefined {
  return value && z.url().safeParse(value).success ? value : undefined;
}

function catalogTimestamp(value: string): string {
  return new Date(value).toISOString();
}

function cleanCatalogTag(value: string): string {
  return value.replace(/^[a-z]{2}:/i, "").replaceAll("-", " ").trim();
}

async function findGlobalCatalogProduct(supabase: SupabaseClient | null, barcode: string): Promise<{
  product: Product | null;
  status: "live" | "unavailable" | "not-configured";
}> {
  if (!supabase) return { product: null, status: "not-configured" };
  const result = await supabase.rpc("lookup_global_catalog_product", { target_gtin: barcode });
  if (result.error) return { product: null, status: "unavailable" };
  const parsed = z.array(globalCatalogRowSchema).max(1).safeParse(result.data);
  if (!parsed.success) return { product: null, status: "unavailable" };
  const row = parsed.data[0];
  if (!row) return { product: null, status: "live" };
  return {
    status: "live",
    product: {
      barcode: row.barcode,
      name: row.name,
      brand: row.brand ?? undefined,
      imageUrl: validUrl(row.image_url),
      quantity: row.quantity ?? undefined,
      categories: row.categories.map(cleanCatalogTag).slice(0, 40),
      countries: row.countries.map(cleanCatalogTag).slice(0, 40),
      ingredientsText: row.ingredients_text ?? undefined,
      structuredIngredients: row.structured_ingredients,
      allergens: row.allergens.map(cleanCatalogTag),
      traces: row.traces.map(cleanCatalogTag),
      additives: row.additives.map(cleanCatalogTag),
      labels: row.labels.map(cleanCatalogTag).slice(0, 40),
      nutriScore: row.nutri_score && /^[a-e]$/i.test(row.nutri_score)
        ? row.nutri_score.toLowerCase()
        : undefined,
      novaGroup: row.nova_group ?? undefined,
      servingSize: row.serving_size ?? undefined,
      nutrition: {
        kcal100g: row.nutrition_per_100g.energy_kcal_100g,
        protein100g: row.nutrition_per_100g.proteins_100g,
        carbs100g: row.nutrition_per_100g.carbohydrates_100g,
        sugar100g: row.nutrition_per_100g.sugars_100g,
        fat100g: row.nutrition_per_100g.fat_100g,
        saturatedFat100g: row.nutrition_per_100g["saturated-fat_100g"],
        fiber100g: row.nutrition_per_100g.fiber_100g,
        salt100g: row.nutrition_per_100g.salt_100g
      },
      assessments: assessIngredientFacts([
        ...row.allergens.map((name) => ({ name: cleanCatalogTag(name), normalizedName: name, allergen: true, confidence: .95, sourceLabel: "Produktkennzeichnung" })),
        ...row.structured_ingredients.map((ingredient) => ({ name: ingredient.name, normalizedName: ingredient.normalizedName, allergen: false, confidence: .82, sourceLabel: "Zutatenliste" })),
        ...row.additives.map((name) => ({ name: cleanCatalogTag(name), normalizedName: name, eNumber: cleanCatalogTag(name).toUpperCase(), allergen: false, confidence: .82, sourceLabel: "Zusatzstoffkennzeichnung" }))
      ], []),
      source: "global-catalog",
      sourceUrl: validUrl(row.source_url),
      sourceLanguage: row.source_language ?? undefined,
      sourceUpdatedAt: row.source_updated_at ? catalogTimestamp(row.source_updated_at) : undefined,
      retrievedAt: catalogTimestamp(row.source_retrieved_at),
      confidence: Math.max(0, Math.min(1, row.confidence)),
      databaseLicense: row.database_license ?? undefined,
      imageLicense: row.image_license ?? undefined
    }
  };
}

async function loadFoodRiskPreferences(supabase: SupabaseClient | null): Promise<FoodRiskPreference[]> {
  if (!supabase) return [];
  const result = await supabase
    .from("user_food_risk_profiles")
    .select("canonical_key, kind, severity")
    .order("severity", { ascending: false });
  if (result.error) throw new Error("Food risk profile unavailable");
  return z.array(z.object({
    canonical_key: z.string(),
    kind: z.enum(["allergen", "intolerance", "exclusion", "medical"]),
    severity: z.enum(["notice", "avoid", "strict_avoid"])
  })).parse(result.data).map((preference) => ({
    key: preference.canonical_key,
    kind: preference.kind,
    severity: preference.severity
  }));
}

export async function GET(request: Request, context: { params: Promise<{ barcode: string }> }) {
  const { barcode: rawBarcode } = await context.params;
  const parsed = barcodeSchema.safeParse(rawBarcode);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültiger Barcode." }, { status: 400 });
  }

  try {
    if (isPublicCatalogPreviewRequest(request.url)) {
      if (!allowLookup("public-preview")) {
        return NextResponse.json({ error: "Zu viele Produktabfragen. Versuche es in einer Minute erneut." }, {
          status: 429,
          headers: { "Retry-After": "60", "Cache-Control": "no-store" }
        });
      }
      const raw = await fetchProduct(parsed.data);
      if (!raw) return NextResponse.json({ error: "Produkt nicht gefunden.", barcode: parsed.data }, { status: 404 });
      const product = personalizeProductAssessments(normalizeOpenFoodFacts(raw, parsed.data), []);
      return NextResponse.json(productApiResponseSchema.parse({ product, globalCatalogStatus: "not-configured" }), {
        headers: { "Cache-Control": "no-store", "X-FoodOS-Product-Source": "public-preview" }
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
        return NextResponse.json({ error: "Zwei-Faktor-Bestätigung erforderlich." }, {
          status: 403,
          headers: { "Cache-Control": "no-store" }
        });
      }
    }
    const rateKey = userResult?.data.user?.id ?? "local-preview";
    if (!allowLookup(rateKey)) {
      return NextResponse.json({ error: "Zu viele Produktabfragen. Versuche es in einer Minute erneut." }, {
        status: 429,
        headers: { "Retry-After": "60", "Cache-Control": "no-store" }
      });
    }
    const preferences = await loadFoodRiskPreferences(supabase);
    const cached = await findCachedProduct(supabase, parsed.data);
    if (cached) {
      const response = productApiResponseSchema.parse({
        product: personalizeProductAssessments(cached, preferences),
        globalCatalogStatus: supabase ? "live" : "not-configured"
      });
      return NextResponse.json(response, {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
          "X-FoodOS-Product-Source": "cache"
        }
      });
    }
    const globalCatalog = await findGlobalCatalogProduct(supabase, parsed.data);
    if (globalCatalog.product) {
      const response = productApiResponseSchema.parse({
        product: personalizeProductAssessments(globalCatalog.product, preferences),
        globalCatalogStatus: globalCatalog.status
      });
      return NextResponse.json(response, {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
          "X-FoodOS-Product-Source": "global-catalog"
        }
      });
    }
    const raw = await fetchProduct(parsed.data);
    if (!raw) return NextResponse.json({ error: "Produkt nicht gefunden.", barcode: parsed.data }, { status: 404 });
    const product = personalizeProductAssessments(normalizeOpenFoodFacts(raw, parsed.data), preferences);
    const response = productApiResponseSchema.parse({ product, globalCatalogStatus: globalCatalog.status });
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
        "X-FoodOS-Product-Source": "open-food-facts"
      }
    });
  } catch {
    return NextResponse.json({ error: "Produktdaten sind gerade nicht erreichbar." }, { status: 503 });
  }
}
