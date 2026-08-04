import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeOpenFoodFacts } from "@/lib/open-food-facts";
import { productApiResponseSchema } from "@/contracts/product";
import { normalizeCachedProduct } from "@/lib/product-cache";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { personalizeProductAssessments, type FoodRiskPreference } from "@/domain/ingredient-relevance";
import type { SupabaseClient } from "@supabase/supabase-js";

const barcodeSchema = z.string().regex(/^\d{8,14}$/, "Barcode muss 8 bis 14 Ziffern enthalten.");
const fields = [
  "code", "product_name", "product_name_de", "generic_name_de", "brands", "quantity",
  "image_front_url", "image_front_small_url", "ingredients_text", "ingredients_text_de",
  "serving_size", "ingredients", "allergens_tags", "traces_tags", "additives_tags",
  "labels_tags", "categories_tags", "countries_tags", "nutriscore_grade", "nova_group",
  "lang", "nutriments"
].join(",");

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
  const userAgent = process.env.OPEN_FOOD_FACTS_USER_AGENT ?? "FoodOS/0.1 (personal nutrition inventory app)";
  const endpoints = [
    `https://world.openfoodfacts.org/api/v3.6/product/${barcode}.json?fields=${fields}`,
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

export async function GET(_request: Request, context: { params: Promise<{ barcode: string }> }) {
  const { barcode: rawBarcode } = await context.params;
  const parsed = barcodeSchema.safeParse(rawBarcode);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültiger Barcode." }, { status: 400 });
  }

  try {
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
      const response = productApiResponseSchema.parse({ product: personalizeProductAssessments(cached, preferences) });
      return NextResponse.json(response, {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
          "X-FoodOS-Product-Source": "cache"
        }
      });
    }
    const raw = await fetchProduct(parsed.data);
    if (!raw) return NextResponse.json({ error: "Produkt nicht gefunden.", barcode: parsed.data }, { status: 404 });
    const product = personalizeProductAssessments(normalizeOpenFoodFacts(raw, parsed.data), preferences);
    const response = productApiResponseSchema.parse({ product });
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
