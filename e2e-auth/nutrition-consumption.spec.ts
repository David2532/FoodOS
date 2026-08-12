import { createHmac, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";

const PRODUCT_GTIN = "3017624010701";
const PRODUCT_NAME = "Nutrition E2E Produkt";

function decodeBase32(secret: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = secret.replace(/=+$/g, "").toUpperCase().split("")
    .map((character) => alphabet.indexOf(character).toString(2).padStart(5, "0"))
    .join("");
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)));
}

function currentTotp(secret: string): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

async function createAal2Household(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Privat starten" })).toBeVisible();
  await page.getByLabel(/Ich bin mindestens 16 Jahre alt/).check();
  await page.getByLabel(/Ich habe die Hinweise gelesen/).check();
  await page.getByRole("button", { name: "Nur notwendige verwenden" }).click();
  await page.getByText("Mit E-Mail weitermachen", { exact: true }).click();
  await page.getByRole("tab", { name: "Neu hier" }).click();
  await page.getByLabel("E-Mail-Adresse").fill(`nutrition-e2e-${Date.now()}@example.test`);
  await page.getByLabel("Passwort").fill("FoodOS-Nutrition-E2E-2026!");
  await page.getByRole("button", { name: "Konto erstellen" }).click();

  await expect(page.getByRole("heading", { name: "2FA aktivieren" })).toBeVisible();
  await page.getByRole("button", { name: /QR-Code für Google Authenticator erzeugen/ }).click();
  await page.getByText("Setup-Schlüssel manuell verwenden", { exact: true }).click();
  const secret = (await page.locator(".mfa-secret code").textContent())?.trim();
  expect(secret).toBeTruthy();
  await page.getByLabel("Sechsstelliger Code").fill(currentTotp(secret ?? ""));
  await page.getByRole("button", { name: "2FA bestätigen" }).click();

  await page.getByLabel("Haushaltsname").fill("Nutrition E2E Haushalt");
  await page.getByLabel("Tagesziel kcal · optional").fill("2200");
  await page.getByLabel("Protein g · optional").fill("150");
  await page.getByRole("button", { name: "Haushalt sicher anlegen" }).click();
  await expect(page.getByRole("heading", { name: "Heute", exact: true })).toBeVisible();
}

function requireLocalSupabaseEnvironment() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!rawUrl || !publishableKey) {
    throw new Error("Authenticated E2E requires the local Supabase URL and publishable key.");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Authenticated E2E received an invalid Supabase URL.");
  }

  const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  if (
    url.protocol !== "http:"
    || !loopbackHosts.has(url.hostname)
    || url.port !== "54321"
    || (url.pathname !== "" && url.pathname !== "/")
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error("Authenticated E2E refuses a non-loopback Supabase API URL.");
  }
  if (publishableKey.startsWith("sb_secret_")) {
    throw new Error("Authenticated E2E refuses a Supabase secret key.");
  }

  return { origin: url.origin, projectCookieKey: url.hostname.split(".")[0], publishableKey };
}

async function createLocalAal2SupabaseClient(page: Page) {
  const { origin, projectCookieKey, publishableKey } = requireLocalSupabaseEnvironment();
  const browserCookies = await page.context().cookies(origin);
  const authCookieName = `sb-${projectCookieKey}-auth-token`;
  if (!browserCookies.some(({ name }) => name === authCookieName || name.startsWith(`${authCookieName}.`))) {
    throw new Error("The current browser context has no local Supabase auth cookie.");
  }

  const supabase = createServerClient(origin, publishableKey, {
    cookies: {
      getAll() {
        return browserCookies.map(({ name, value }) => ({ name, value }));
      },
      setAll() {
        throw new Error("The fresh E2E session unexpectedly required an auth-cookie refresh.");
      }
    }
  });
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token;
  if (sessionResult.error || !accessToken) {
    throw new Error("The local Supabase auth cookie did not contain a usable session.");
  }

  const claimsResult = await supabase.auth.getClaims(accessToken);
  if (claimsResult.error || claimsResult.data?.claims.aal !== "aal2") {
    throw new Error("The local Supabase session is not a verified AAL2 session.");
  }
  return supabase;
}

async function seedNutritionBatch(page: Page) {
  const supabase = await createLocalAal2SupabaseClient(page);
  const householdsResult = await supabase.rpc("get_my_households");
  const households = Array.isArray(householdsResult.data) ? householdsResult.data : [];
  const householdId = households[0]?.household_id;
  if (householdsResult.error || households.length !== 1 || typeof householdId !== "string") {
    throw new Error("The local AAL2 user did not resolve to exactly one test household.");
  }

  const mutationResult = await supabase.rpc("add_inventory_batch", {
    target_household: householdId,
    product_payload: {
      barcode: PRODUCT_GTIN,
      name: PRODUCT_NAME,
      quantity: "450 g",
      nutrition: { kcal100g: 539, protein100g: 6.3, carbs100g: 57.5, fat100g: 30.9 },
      source: "manual",
      retrievedAt: new Date().toISOString(),
      confidence: 1
    },
    batch_payload: {
      amount: 450,
      unit: "g",
      location: "pantry",
      purchased_at: new Date().toISOString()
    },
    mutation_id: randomUUID()
  });
  const result = mutationResult.data as { remaining_amount?: unknown; idempotent_replay?: unknown } | null;
  if (mutationResult.error || result?.remaining_amount !== 450 || result.idempotent_replay !== false) {
    throw new Error("The local add_inventory_batch RPC did not create the expected 450 g batch.");
  }
}

test("an AAL2 consumption updates exact daily and weekly nutrition after reload", async ({ page }) => {
  await createAal2Household(page);
  await seedNutritionBatch(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Heute", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Vorrat", exact: true }).click();

  await page.getByRole("button", { name: new RegExp(PRODUCT_NAME) }).click();
  const consumption = page.getByRole("form", { name: `Verzehr von ${PRODUCT_NAME} buchen` });
  await expect(consumption.getByText("539 kcal", { exact: true })).toBeVisible();
  await consumption.getByRole("button", { name: "Portion verbindlich buchen" }).click();
  await page.getByRole("button", { name: "Heute", exact: true }).click();

  await expect(page.getByLabel("Kalorien heute: 539 Kilokalorien")).toBeVisible();
  await expect(page.getByLabel("Protein heute: 6,3 Gramm")).toBeVisible();
  await expect(page.getByLabel("Carbs heute: 57,5 Gramm")).toBeVisible();
  await expect(page.getByLabel("Fett heute: 30,9 Gramm")).toBeVisible();
  await expect(page.getByLabel("Kalorien diese Woche: 539 Kilokalorien")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Kalorien heute: 539 Kilokalorien")).toBeVisible();
  await expect(page.getByLabel("Fett diese Woche: 30,9 Gramm")).toBeVisible();
});
