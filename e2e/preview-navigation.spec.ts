import { expect, test } from "@playwright/test";
import axe from "axe-core";

test.describe("Q-UX-PRIMARY-ACTION-E2E-001 preview shell", () => {
  test("Q-UX-THEME-E2E-001 changes the appearance with the keyboard and persists it", async ({ page }) => {
    await page.goto("/?demo=1");

    const themeMenuButton = page.getByRole("button", { name: /^Darstellung ändern/ });
    await themeMenuButton.focus();
    await page.keyboard.press("Enter");
    await expect(themeMenuButton).toHaveAttribute("aria-expanded", "true");

    const systemOption = page.getByRole("radio", { name: /^System/ });
    await expect(systemOption).toBeFocused();
    await expect(systemOption).toBeChecked();
    await page.keyboard.press("ArrowDown");

    await expect(themeMenuButton).toHaveAttribute("aria-expanded", "false");
    await expect(themeMenuButton).toBeFocused();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: /Darstellung ändern\. Aktuell: Hell/ })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.addScriptTag({ content: axe.source });
    const accessibility = await page.evaluate(async () => {
      const runner = (window as typeof window & { axe: typeof axe }).axe;
      return runner.run(document, { resultTypes: ["violations"] });
    });
    expect(accessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  });

  test("keeps the five canonical destinations usable without horizontal overflow", async ({ page }, testInfo) => {
    await page.goto("/?demo=1");
    await expect(page.getByRole("heading", { name: "Heute in FoodOS" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Konto erstellen oder anmelden" })).toBeVisible();

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

  test("opens a source-backed protein shake choice and then the existing intake flow", async ({ page }, testInfo) => {
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
            name: "Rühls Bestes Whey Protein",
            brand: "Rühls Bestes",
            quantity: "1 kg",
            imageUrl: "https://images.openfoodfacts.org/images/products/301/762/401/0701/front_de.3.200.jpg",
            source: "open-food-facts",
            sourceUrl: "https://world.openfoodfacts.org/product/3017624010701",
            confidence: 0.82
          }]
        })
      });
    });
    await page.route("**/api/products/3017624010701?*", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          globalCatalogStatus: "not-configured",
          product: {
            barcode: "3017624010701",
            name: "Rühls Bestes Whey Protein",
            brand: "Rühls Bestes",
            quantity: "1 kg",
            imageUrl: "https://images.openfoodfacts.org/images/products/301/762/401/0701/front_de.3.200.jpg",
            categories: ["Protein"],
            countries: ["Deutschland"],
            labels: [],
            ingredientsText: "Molkenprotein",
            structuredIngredients: [],
            allergens: ["Hafer"],
            traces: [],
            additives: [],
            nutrition: { kcal100g: 371, protein100g: 74, carbs100g: 6.6, fat100g: 6.2 },
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
    await page.goto("/?demo=1");
    await page.getByRole("button", { name: /Proteinshake auswählen/ }).click();
    await expect(page.getByRole("heading", { name: "Produkt statt Barcode suchen" })).toBeVisible();

    const firstResult = page.locator(".catalog-result").first();
    await expect(firstResult).toBeVisible({ timeout: 15_000 });
    await expect(firstResult).toContainText("Open Food Facts");
    await expect(firstResult.locator("img")).toHaveAttribute("src", /images\.openfoodfacts\.org/);
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
    await page.goto("/?demo=1");
    await page.addScriptTag({ content: axe.source });
    const result = await page.evaluate(async () => {
      const runner = (window as typeof window & { axe: typeof axe }).axe;
      return runner.run(document, { resultTypes: ["violations"] });
    });
    expect(result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  });

  test("fails closed when the export service is not configured", async ({ request }) => {
    const response = await request.get("/api/account/export");
    expect([401, 503]).toContain(response.status());
    expect(response.headers()["cache-control"]).toContain("no-store");
    await expect(response.json()).resolves.toEqual(response.status() === 503
      ? { error: "SERVICE_UNAVAILABLE" }
      : { error: "AUTHENTICATION_REQUIRED" });
  });

  test("rejects underspecified catalog searches before contacting a provider", async ({ request }) => {
    const response = await request.get("/api/products/search?q=a");
    expect(response.status()).toBe(400);
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("Q-SCAN-PROVIDER-OUTAGE-E2E-003 keeps manual product entry available after a lookup outage", async ({ page }) => {
    await page.route("**/api/products/3017624010701?*", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Produktdaten sind gerade nicht erreichbar." })
      });
    });
    await page.goto("/?demo=1");
    await page.getByRole("button", { name: "Scan", exact: true }).click();
    await page.getByLabel("EAN, UPC oder GS1-Code").fill("3017624010701");
    await page.getByRole("button", { name: "Prüfen", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Produktquelle gerade nicht erreichbar" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Die Suche konnte nicht" })).toContainText("manuelle Eintrag");
    await expect(page.getByLabel("Produktname")).toBeVisible();
  });
});
