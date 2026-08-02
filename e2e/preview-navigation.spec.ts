import { expect, test } from "@playwright/test";
import axe from "axe-core";

test.describe("Q-UX-PRIMARY-ACTION-E2E-001 preview shell", () => {
  test("keeps the five canonical destinations usable without horizontal overflow", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Hey David" })).toBeVisible();

    for (const [label, heading] of [
      ["Vorrat", "Dein Vorrat"],
      ["Scan", "Produkt scannen"],
      ["Plan", "Deine Woche"],
      ["Einkauf", "12 Dinge fehlen"],
      ["Heute", "Hey David"]
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
});
