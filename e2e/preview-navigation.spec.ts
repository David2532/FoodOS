import { expect, test } from "@playwright/test";
import axe from "axe-core";

test.describe("Q-UX-PRIMARY-ACTION-E2E-001 preview shell", () => {
  test("keeps the five canonical destinations usable without horizontal overflow", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Heute in FoodOS" })).toBeVisible();

    for (const [label, heading] of [
      ["Vorrat", "Dein Vorrat"],
      ["Scan", "Finden & erfassen"],
      ["Plan", "Deine Woche"],
      ["Einkauf", "Dein Einkauf"],
      ["Heute", "Heute in FoodOS"]
    ] as const) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `docs/evidence/screenshots/preview-${testInfo.project.name}.png`,
      fullPage: true
    });
  });

  test("uses a deterministic provider-shaped result and opens the existing intake flow", async ({ page }, testInfo) => {
    await page.route("**/api/products/search?*", async (route) => {
      const query = new URL(route.request().url()).searchParams.get("q");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          query,
          page: 1,
          pageSize: 12,
          providerCount: 1,
          providerCountExact: true,
          cachedCount: 0,
          globalCatalogCount: 0,
          globalCatalogStatus: "not-configured",
          providerStatus: "live",
          hasMore: false,
          results: [{
            barcode: "3017624010701",
            name: "Deterministische Haferflocken",
            brand: "FoodOS Testquelle",
            quantity: "500 g",
            nutriScore: "a",
            source: "open-food-facts",
            sourceUrl: "https://world.openfoodfacts.org/product/3017624010701",
            confidence: 0.82
          }]
        })
      });
    });
    await page.route("**/api/products/3017624010701", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          globalCatalogStatus: "not-configured",
          product: {
            barcode: "3017624010701",
            name: "Deterministische Haferflocken",
            brand: "FoodOS Testquelle",
            quantity: "500 g",
            categories: ["Getreide"],
            countries: ["Deutschland"],
            labels: [],
            ingredientsText: "Haferflocken",
            structuredIngredients: [],
            allergens: ["Hafer"],
            traces: [],
            additives: [],
            nutrition: { kcal100g: 370, protein100g: 13, carbs100g: 60, fat100g: 7 },
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
    await page.goto("/");
    await page.getByRole("button", { name: "Scan", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Produkt statt Barcode suchen" })).toBeVisible();

    await page.getByRole("button", { name: "Haferflocken", exact: true }).click();
    const firstResult = page.locator(".catalog-result").first();
    await expect(firstResult).toBeVisible({ timeout: 15_000 });
    await expect(firstResult).toContainText("Open Food Facts");
    await page.addScriptTag({ content: axe.source });
    const catalogAccessibility = await page.evaluate(async () => {
      const runner = (window as typeof window & { axe: typeof axe }).axe;
      return runner.run(document, { resultTypes: ["violations"] });
    });
    expect(catalogAccessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
    const productName = (await firstResult.getByRole("heading", { level: 3 }).textContent())?.trim();
    expect(productName).toBeTruthy();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `docs/evidence/screenshots/catalog-${testInfo.project.name}.png`,
      fullPage: true
    });

    await firstResult.getByRole("button", { name: /Prüfen/ }).click();
    await expect(page.locator(".product-hero h2")).toHaveText(productName ?? "", { timeout: 15_000 });
    await expect(page.getByText("Open Food Facts", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Charge zum Vorrat hinzufügen/ })).toHaveCount(0);
    await expect(page.getByText(/Preview-Modus: Produktdaten können geprüft/)).toBeVisible();
  });

  test("has no automatically detectable serious accessibility violation on Today", async ({ page }) => {
    await page.goto("/");
    await page.addScriptTag({ content: axe.source });
    const result = await page.evaluate(async () => {
      const runner = (window as typeof window & { axe: typeof axe }).axe;
      return runner.run(document, { resultTypes: ["violations"] });
    });
    expect(result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  });

  test("fails closed when the export service is not configured", async ({ request }) => {
    const response = await request.get("/api/account/export");
    expect(response.status()).toBe(503);
    expect(response.headers()["cache-control"]).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ error: "SERVICE_UNAVAILABLE" });
  });

  test("rejects underspecified catalog searches before contacting a provider", async ({ request }) => {
    const response = await request.get("/api/products/search?q=a");
    expect(response.status()).toBe(400);
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("Q-SCAN-PROVIDER-OUTAGE-E2E-003 keeps manual product entry available after a lookup outage", async ({ page }) => {
    await page.route("**/api/products/3017624010701", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Produktdaten sind gerade nicht erreichbar." })
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Scan", exact: true }).click();
    await page.getByLabel("EAN, UPC oder GS1-Code").fill("3017624010701");
    await page.getByRole("button", { name: "Prüfen", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Produktquelle gerade nicht erreichbar" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Die Suche konnte nicht" })).toContainText("manuelle Eintrag");
    await expect(page.getByLabel("Produktname")).toBeVisible();
  });
});
