import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";

async function waitForPreviewHydration(page: Page) {
  await page.waitForFunction(() => {
    const navigationButton = document.querySelector<HTMLButtonElement>(".bottom-nav button");
    return Boolean(navigationButton && Object.keys(navigationButton).some((key) => key.startsWith("__reactProps$")));
  });
}

test.describe("Q-UX-PRIMARY-ACTION-E2E-001 preview shell", () => {
  test("Q-UX-THEME-E2E-001 changes the appearance with the keyboard and persists it", async ({ page }) => {
    await page.goto("/?demo=1");
    await waitForPreviewHydration(page);

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
    await waitForPreviewHydration(page);
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
    await waitForPreviewHydration(page);
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
            barcode: "4255773600520",
            name: "Rühls Bestes Whey Protein",
            brand: "Rühls Bestes",
            quantity: "1 kg",
            imageUrl: "https://images.openfoodfacts.org/images/products/425/577/360/0520/front_en.18.400.jpg",
            source: "open-food-facts",
            sourceUrl: "https://world.openfoodfacts.org/product/4255773600520",
            nutrition: { kcal100g: 371, protein100g: 74, carbs100g: 6.6, fat100g: 6.2 },
            confidence: 0.82
          }]
        })
      });
    });
    await page.route("**/api/products/4255773600520?*", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          globalCatalogStatus: "not-configured",
          product: {
            barcode: "4255773600520",
            name: "Rühls Bestes Whey Protein",
            brand: "Rühls Bestes",
            quantity: "1 kg",
            imageUrl: "https://images.openfoodfacts.org/images/products/425/577/360/0520/front_en.18.400.jpg",
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
            sourceUrl: "https://world.openfoodfacts.org/product/4255773600520",
            sourceLanguage: "de",
            retrievedAt: "2026-08-04T10:00:00.000Z",
            confidence: 0.82
          }
        })
      });
    });
    await page.goto("/?demo=1");
    await waitForPreviewHydration(page);
    await page.getByRole("button", { name: /Proteinshake auswählen/ }).click();
    await expect(page.getByRole("heading", { name: "Produkt statt Barcode suchen" })).toBeVisible();
    await page.getByLabel("Lagerort für kommende Scans").selectOption("pantry");

    const firstResult = page.locator(".catalog-result").first();
    await expect(firstResult).toBeVisible({ timeout: 15_000 });
    await expect(firstResult).toContainText("Open Food Facts");
    await expect(firstResult).toContainText("371");
    await expect(firstResult).toContainText("74 g");
    const sourceBackedImage = firstResult.locator("img");
    await expect(sourceBackedImage).toHaveAttribute("src", /images\.openfoodfacts\.org/);
    await expect.poll(() => sourceBackedImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
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
    const capturedItem = page.locator(".capture-list li").filter({ hasText: productName ?? "" });
    await expect(capturedItem).toBeVisible({ timeout: 15_000 });
    await expect(capturedItem.locator("img")).toHaveAttribute("src", /images\.openfoodfacts\.org/);
    await expect(capturedItem.locator(".capture-quantity")).toBeVisible();
    await expect(page.getByLabel("Produktname")).toHaveCount(0);
    await page.getByRole("button", { name: "Fertig" }).click();
    await expect(page.getByText(/Keine zusätzlichen Formulare/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Preview abschließen/ })).toBeVisible();
    await page.screenshot({
      path: `docs/evidence/screenshots/capture-review-${testInfo.project.name}.png`,
      fullPage: true
    });
    for (const viewport of [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 430, height: 932 }
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole("button", { name: /Preview abschließen/ })).toBeVisible();
      const captureOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(captureOverflow).toBeLessThanOrEqual(1);
    }
  });

  test("has no automatically detectable serious accessibility violation on Today", async ({ page }) => {
    await page.goto("/?demo=1");
    await waitForPreviewHydration(page);
    await page.addScriptTag({ content: axe.source });
    const result = await page.evaluate(async () => {
      const runner = (window as typeof window & { axe: typeof axe }).axe;
      return runner.run(document, { resultTypes: ["violations"] });
    });
    expect(result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  });

  test("offers a responsive yogurt MHD input proposal without silently confirming it", async ({ page }, testInfo) => {
    await page.addInitScript(() => window.localStorage.setItem("foodos:theme-preference:v1", "light"));
    await page.route("**/api/products/3017624010701?*", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          globalCatalogStatus: "live",
          product: {
            barcode: "3017624010701",
            name: "Naturjoghurt E2E",
            brand: "FoodOS Molkerei",
            quantity: "500 g",
            categories: ["Milchprodukte", "Joghurts"],
            countries: ["Deutschland"],
            labels: [],
            ingredientsText: "Joghurt",
            structuredIngredients: [],
            allergens: ["Milch"],
            traces: [],
            additives: [],
            nutrition: { kcal100g: 62, protein100g: 3.5, carbs100g: 4.7, fat100g: 3.5 },
            assessments: [],
            source: "open-food-facts",
            sourceUrl: "https://world.openfoodfacts.org/product/3017624010701",
            sourceLanguage: "de",
            retrievedAt: "2026-08-07T10:00:00.000Z",
            confidence: 0.91
          }
        })
      });
    });
    await page.goto("/?demo=1");
    await waitForPreviewHydration(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Scan", exact: true }).click();
    await page.getByLabel("Lagerort für kommende Scans").selectOption("fridge");
    const purchaseDate = await page.getByLabel("Einkaufstag").inputValue();
    const expectedDate = new Date(`${purchaseDate}T12:00:00.000Z`);
    expectedDate.setUTCDate(expectedDate.getUTCDate() + 7);
    const expectedValue = expectedDate.toISOString().slice(0, 10);

    await page.getByPlaceholder("EAN / UPC / GS1 eingeben").fill("3017624010701");
    await page.getByRole("button", { name: "Prüfen" }).click();
    await expect(page.getByText(/MHD-Vorschlag .*Packung prüfen/)).toBeVisible();
    await page.getByRole("button", { name: "Fertig" }).click();
    await expect(page.getByRole("heading", { name: "MHD-Vorschläge prüfen" })).toBeVisible();
    await expect(page.getByLabel("MHD-Vorschlag mit Packung abgleichen")).toHaveValue(expectedValue);
    await expect(page.getByText(/nicht von der Packung/)).toBeVisible();
    await expect(page.getByText(/Ohne Packungsabgleich speichert FoodOS kein MHD/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview abschließen" })).toBeEnabled();

    await page.addScriptTag({ content: axe.source });
    const accessibility = await page.evaluate(async () => {
      const runner = (window as typeof window & { axe: typeof axe }).axe;
      return runner.run(document, { resultTypes: ["violations"] });
    });
    expect(accessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
    await page.screenshot({ path: `docs/evidence/screenshots/mhd-proposal-${testInfo.project.name}.png`, fullPage: true });

    for (const viewport of [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 430, height: 932 }
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole("button", { name: "Stimmt mit Packung überein" })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const touchTargets = await page.locator(".capture-exception-card .capture-quantity button").evaluateAll((buttons) => buttons.map((button) => {
        const box = button.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }));
      expect(touchTargets.every((target) => target.width >= 48 && target.height >= 48)).toBe(true);
      const viewportAccessibility = await page.evaluate(async () => {
        const runner = (window as typeof window & { axe: typeof axe }).axe;
        return runner.run(document, { resultTypes: ["violations"] });
      });
      expect(viewportAccessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
    }

    await page.getByRole("button", { name: "Stimmt mit Packung überein" }).click();
    await expect(page.getByLabel("Mit der Packung abgeglichen")).toBeChecked();
    await expect(page.getByLabel("Verbrauchsdatum")).toHaveCount(0);
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
    await waitForPreviewHydration(page);
    await page.getByRole("button", { name: "Scan", exact: true }).click();
    await page.getByLabel("Lagerort für kommende Scans").selectOption("pantry");
    await page.getByLabel("EAN, UPC oder GS1-Code").fill("3017624010701");
    await page.getByRole("button", { name: "Prüfen", exact: true }).click();

    await expect(page.getByText("Unbekanntes Produkt")).toBeVisible();
    await expect(page.locator(".capture-last.warning")).toContainText(/Verbindung fehlgeschlagen|Produktquelle nicht erreichbar/);
    await page.getByRole("button", { name: "Fertig" }).click();
    await expect(page.getByText(/Produktidentität unklar/)).toBeVisible();
    await expect(page.getByLabel("Produktname")).toBeVisible();
  });
});
