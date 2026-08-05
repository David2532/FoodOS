import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

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
  await expect(page.getByRole("heading", { name: "Heute" })).toBeVisible();
}

test("an AAL2 consumption updates exact daily and weekly nutrition after reload", async ({ page }) => {
  await page.route("**/api/products/3017624010701", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        globalCatalogStatus: "not-configured",
        product: {
          barcode: "3017624010701",
          name: "Nutrition E2E Produkt",
          brand: "FoodOS Testquelle",
          quantity: "450 g",
          categories: ["Testprodukt"],
          countries: ["Deutschland"],
          labels: [],
          structuredIngredients: [],
          allergens: [],
          traces: [],
          additives: [],
          nutrition: { kcal100g: 539, protein100g: 6.3, carbs100g: 57.5, fat100g: 30.9 },
          assessments: [],
          source: "open-food-facts",
          sourceUrl: "https://world.openfoodfacts.org/product/3017624010701",
          sourceLanguage: "de",
          retrievedAt: "2026-08-04T10:00:00.000Z",
          confidence: 0.82
        }
      })
    });
  });

  await createAal2Household(page);
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await page.getByPlaceholder("EAN / UPC / GS1 eingeben").fill("3017624010701");
  await page.getByRole("button", { name: "Prüfen" }).click();
  await expect(page.getByRole("button", { name: /Charge zum Vorrat hinzufügen/ })).toBeVisible();
  await page.getByLabel("Menge").fill("450");
  await page.getByLabel("Einheit").selectOption("g");
  await page.getByLabel("Lagerort").selectOption("pantry");
  await page.getByRole("button", { name: /Charge zum Vorrat hinzufügen/ }).click();
  await expect(page.getByText("Vom Server bestätigt")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Vorrat ansehen" }).click();

  await page.getByRole("button", { name: /Nutrition E2E Produkt/ }).click();
  const consumption = page.getByRole("form", { name: "Verzehr von Nutrition E2E Produkt buchen" });
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
