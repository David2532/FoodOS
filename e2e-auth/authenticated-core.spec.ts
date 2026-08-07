import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function acceptNecessaryPrivacy(page: Page) {
  await expect(page.getByRole("heading", { name: "Privat starten" })).toBeVisible();
  await page.getByLabel(/Ich bin mindestens 16 Jahre alt/).check();
  await page.getByLabel(/Ich habe die Hinweise gelesen/).check();
  await page.getByRole("button", { name: "Nur notwendige verwenden" }).click();
  await expect(page.getByRole("heading", { name: "Einfach loslegen" })).toBeVisible();
}

test("Apple and Google OAuth start with PKCE and a same-origin callback", async ({ page }) => {
  const externalRequests = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") externalRequests.add(url.origin);
  });
  await page.route("http://127.0.0.1:54321/auth/v1/authorize**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/plain", body: "OAuth request captured" });
  });
  await page.goto("/");
  await acceptNecessaryPrivacy(page);
  expect([...externalRequests]).toEqual([]);
  await page.screenshot({ path: "docs/evidence/screenshots/auth-google-desktop.png", fullPage: true });
  await expect(page.getByRole("group", { name: "Mit einem Konto anmelden" })).toBeVisible();
  await expect(page.locator(".oauth-button")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Mit Apple fortfahren" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mit Google fortfahren" })).toBeVisible();

  for (const provider of [
    { name: "Apple", value: "apple", scopes: "name email" },
    { name: "Google", value: "google", scopes: "openid email profile" }
  ]) {
    await page.getByRole("button", { name: `Mit ${provider.name} fortfahren` }).click();
    await page.waitForURL(/\/auth\/v1\/authorize/);
    const authorizationUrl = new URL(page.url());
    expect(authorizationUrl.searchParams.get("provider")).toBe(provider.value);
    expect(authorizationUrl.searchParams.get("redirect_to")).toBe("http://127.0.0.1:3101/auth/confirm?next=%2F");
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe("s256");
    expect(authorizationUrl.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(authorizationUrl.searchParams.get("scopes")).toBe(provider.scopes);
    await page.goto("/");
  }

  const providerError = await page.request.get(
    "/auth/confirm?error=access_denied&error_description=provider-secret-detail",
    { maxRedirects: 0 }
  );
  expect(providerError.status()).toBe(307);
  const safeErrorLocation = new URL(providerError.headers().location);
  expect(`${safeErrorLocation.pathname}${safeErrorLocation.search}`).toBe("/?auth_error=oauth");
  expect(providerError.headers().location).not.toContain("provider-secret-detail");

  await page.goto("/?demo=1");
  const accountEntry = page.getByRole("link", { name: "Konto erstellen oder anmelden" });
  await expect(accountEntry).toHaveAttribute("href", "/");
  await expect(page.getByRole("heading", { name: "Heute in FoodOS" })).toBeVisible();
  await expect(page.getByText("Preview-Modus · Beispieldaten werden nicht gespeichert", { exact: true })).toBeVisible();
  await accountEntry.click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Einfach loslegen" })).toBeVisible();
});

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
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, "0");
}

test("real local user must enroll TOTP before atomic household onboarding", async ({ page }) => {
  const email = `foodos-e2e-${Date.now()}@example.test`;
  const password = "FoodOS-E2E-Only-2026!";

  await page.goto("/");
  await acceptNecessaryPrivacy(page);
  const unsafeRedirect = await page.request.get("/auth/confirm?next=%2F%5Cevil.example", { maxRedirects: 0 });
  expect(unsafeRedirect.status()).toBe(307);
  expect(new URL(unsafeRedirect.headers().location).pathname).toBe("/");
  const deniedExport = await page.request.get("/api/account/export");
  expect(deniedExport.status()).toBe(401);
  expect(deniedExport.headers()["cache-control"]).toContain("no-store");
  await page.getByText("Mit E-Mail weitermachen", { exact: true }).click();
  await page.getByRole("tab", { name: "Neu hier" }).click();
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Konto erstellen" }).click();

  await expect(page.getByRole("heading", { name: "2FA aktivieren" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deinen Haushalt anlegen" })).not.toBeVisible();
  await page.getByRole("button", { name: /QR-Code für Google Authenticator erzeugen/ }).click();
  await page.getByText("Setup-Schlüssel manuell verwenden", { exact: true }).click();
  const secret = (await page.locator(".mfa-secret code").textContent())?.trim();
  expect(secret).toBeTruthy();
  await page.getByLabel("Sechsstelliger Code").fill(currentTotp(secret ?? ""));
  await page.getByRole("button", { name: "2FA bestätigen" }).click();

  await expect(page.getByRole("heading", { name: "Deinen Haushalt anlegen" })).toBeVisible();
  await page.getByLabel("Haushaltsname").fill("E2E Haushalt");
  await page.getByLabel("Dein Anzeigename · optional").fill("E2E Person");
  await page.getByLabel("Tagesziel kcal · optional").fill("2200");
  await page.getByLabel("Protein g · optional").fill("150");
  await page.getByRole("button", { name: "Haushalt sicher anlegen" }).click();

  await expect(page.getByRole("heading", { name: "Heute" })).toBeVisible();
  await expect(page.getByText("E2E Haushalt", { exact: true })).toBeVisible();
  await expect(page.getByText("Rückrufprüfung nicht verfügbar", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Konto und Einstellungen öffnen" }).click();
  const initialSettings = page.locator(".settings-view");
  await expect(initialSettings.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
  await initialSettings.getByRole("button", { name: "Datenschutz verwalten" }).click();
  const privacyDialog = page.getByRole("dialog");
  await privacyDialog.getByLabel(/Nutzungsanalyse/).check();
  await privacyDialog.getByRole("button", { name: "Auswahl speichern" }).click();
  await expect(privacyDialog.getByRole("status")).toContainText("wurde gespeichert");
  await privacyDialog.getByRole("button", { name: "Alle optionalen Zwecke zurückziehen" }).click();
  await expect(privacyDialog.getByLabel(/Nutzungsanalyse/)).not.toBeChecked();
  await privacyDialog.getByRole("button", { name: "Datenschutz schließen" }).click();

  // The authenticated inventory/outbox flow must be deterministic and must not disclose
  // a test barcode to a third-party provider. The fixture mirrors the validated API
  // contract; the real provider fallback is covered separately by unit/API contracts.
  await page.route("**/api/products/3017624010701", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        globalCatalogStatus: "not-configured",
        product: {
          barcode: "3017624010701",
          name: "Nutella E2E-Testprodukt",
          brand: "FoodOS Testquelle",
          imageUrl: "https://images.openfoodfacts.org/images/products/301/762/401/0701/front_de.1.400.jpg",
          quantity: "450 g",
          categories: ["Süßaufstriche"],
          countries: ["Deutschland"],
          labels: [],
          ingredientsText: "Zucker, Haselnüsse",
          structuredIngredients: [],
          allergens: ["Haselnüsse"],
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
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await page.getByLabel("Lagerort für kommende Scans").selectOption("pantry");
  await page.getByPlaceholder("EAN / UPC / GS1 eingeben").fill("3017624010701");
  await page.getByRole("button", { name: "Prüfen" }).click();
  const capturedPurchaseItem = page.locator(".capture-list li").filter({ hasText: "Nutella E2E-Testprodukt" });
  await expect(capturedPurchaseItem).toBeVisible();
  await expect(capturedPurchaseItem.locator("img")).toHaveAttribute("src", /front_de\.1\.400\.jpg/);
  await expect(page.getByLabel("Menge", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Fertig" }).click();
  await expect(page.getByText(/Keine zusätzlichen Formulare/)).toBeVisible();

  await page.context().setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await page.getByRole("button", { name: /Einkauf übernehmen/ }).click();
  await expect(page.getByText("Auf diesem Gerät gespeichert", { exact: true })).toBeVisible();
  await expect(page.getByText(/Offline · auf diesem Gerät gespeichert/)).toBeVisible();
  const persistedOutbox = await page.evaluate(async () => {
    const request = indexedDB.open("foodos-device-v1");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("operations", "readonly");
    const read = transaction.objectStore("operations").getAll();
    const [operations] = await Promise.all([
      new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        read.onsuccess = () => resolve(read.result);
        read.onerror = () => reject(read.error);
      }),
      new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
    ]);
    database.close();
    const operation = operations[0];
    return {
      count: operations.length,
      state: operation?.state,
      hasCiphertext: operation?.ciphertext instanceof ArrayBuffer && operation.ciphertext.byteLength > 0,
      ivBytes: operation?.iv instanceof ArrayBuffer ? operation.iv.byteLength : 0,
      leaksPayloadFields: Boolean(operation && ("args" in operation || "householdId" in operation || "actorId" in operation))
    };
  });
  expect(persistedOutbox).toEqual({ count: 1, state: "QUEUED", hasCiphertext: true, ivBytes: 12, leaksPayloadFields: false });

  await page.context().setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  await expect(page.getByText(/Offline · auf diesem Gerät gespeichert/)).not.toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/1 Packung im Vorrat/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Vorrat ansehen" }).click();
  const persistedBatch = page.getByRole("button", { name: /Nutella E2E-Testprodukt/ });
  await expect(persistedBatch).toBeVisible();
  await expect(persistedBatch).toContainText("FoodOS Testquelle · 1 Stück");
  await expect(persistedBatch).toContainText("Vorrat");
  await expect(persistedBatch.locator("img")).toHaveAttribute("src", /front_de\.1\.400\.jpg/);

  await page.reload();
  await page.getByRole("button", { name: "Vorrat", exact: true }).click();
  const reloadedBatch = page.getByRole("button", { name: /Nutella E2E-Testprodukt/ });
  await expect(reloadedBatch).toContainText("FoodOS Testquelle · 1 Stück");
  await expect(reloadedBatch).toContainText("Vorrat");
  await expect(reloadedBatch.locator("img")).toHaveAttribute("src", /front_de\.1\.400\.jpg/);

  const exportResponse = await page.request.get("/api/account/export");
  expect(exportResponse.status()).toBe(200);
  expect(exportResponse.headers()["cache-control"]).toContain("no-store");
  expect(exportResponse.headers()["content-disposition"]).toContain("attachment");
  const exportPayload = await exportResponse.json();
  expect(exportPayload.exportVersion).toBe(2);
  expect(exportPayload.identity.email).toBe(email);
  expect(exportPayload.data.households).toHaveLength(1);
  expect(exportPayload.data.inventoryBatches).toHaveLength(1);
  expect(exportPayload.data.inventoryBatches[0]).toEqual(expect.objectContaining({
    initial_amount: 1,
    remaining_amount: 1,
    unit: "piece",
    location: "pantry",
    best_before_date: null,
    lot_number: null
  }));
  expect(exportPayload.data.products[0].name).toMatch(/Nutella/i);
  expect(exportPayload.data.privacyChoiceEvents).toHaveLength(3);
  expect(exportPayload.data.privacyChoiceEvents.at(-1).analytics).toBe(false);

  // Account settings intentionally live outside the five primary navigation destinations.
  // The real Supabase session is AAL2 here, so this verifies the password-change contract
  // against Auth rather than stubbing a client response.
  await page.getByRole("button", { name: "Konto und Einstellungen öffnen" }).click();
  const settings = page.locator(".settings-view");
  await expect(settings.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
  await expect(settings.getByText(email, { exact: true })).toBeVisible();

  await settings.getByRole("radio", { name: /^Hell/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({ path: "docs/evidence/screenshots/account-settings-authenticated-desktop.png", fullPage: true });

  const changedPassword = "FoodOS-E2E-Changed-2026!";
  const passwordForm = settings.locator(".password-change-form");
  await passwordForm.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "docs/evidence/screenshots/account-security-authenticated-desktop.png", fullPage: true });
  await passwordForm.getByLabel("Aktuelles Passwort").fill(password);
  await passwordForm.getByLabel("Neues Passwort", { exact: true }).fill(changedPassword);
  await passwordForm.getByLabel("Neues Passwort wiederholen").fill(changedPassword);
  await passwordForm.getByRole("button", { name: "Passwort ändern" }).click();
  await expect(passwordForm.getByRole("status")).toContainText("Dein Passwort wurde geändert.");
  await expect(passwordForm.getByRole("status")).toContainText("Andere angemeldete Geräte wurden abgemeldet.");

  const signedOutHeading = page.getByRole("heading", { name: "Privat starten" });
  await settings.getByRole("button", { name: "Sicher abmelden" }).click();
  await expect(signedOutHeading).toBeVisible();
  await acceptNecessaryPrivacy(page);
  await page.getByText("Mit E-Mail weitermachen", { exact: true }).click();

  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.locator(".auth-message.error")).toContainText("Anmeldung fehlgeschlagen");

  await page.getByLabel("Passwort").fill(changedPassword);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Anmeldung bestätigen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Heute" })).not.toBeVisible();
});
