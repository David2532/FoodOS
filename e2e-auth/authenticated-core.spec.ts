import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

test("Apple and Google OAuth start with PKCE and a same-origin callback", async ({ page }) => {
  await page.route("http://127.0.0.1:54321/auth/v1/authorize**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/plain", body: "OAuth request captured" });
  });
  await page.goto("/");
  await page.screenshot({ path: "docs/evidence/screenshots/auth-google-desktop.png", fullPage: true });
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
  await expect(page.getByRole("heading", { name: "Hey David" })).toBeVisible();
  await expect(page.getByText("Preview-Modus · Beispieldaten werden nicht gespeichert", { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "QR-Code erzeugen" }).click();
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

  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await page.getByPlaceholder("EAN / UPC / GS1 eingeben").fill("3017624010701");
  await page.getByRole("button", { name: "Prüfen" }).click();
  await expect(page.getByRole("button", { name: /Charge zum Vorrat hinzufügen/ })).toBeVisible();

  await page.context().setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await page.getByRole("button", { name: /Charge zum Vorrat hinzufügen/ }).click();
  await expect(page.getByText(/Auf diesem Gerät verschlüsselt gespeichert/)).toBeVisible();
  await expect(page.getByText(/Offline · auf diesem Gerät gespeichert/)).toBeVisible();
  const persistedOutbox = await page.evaluate(async () => {
    const request = indexedDB.open("foodos-device-v1");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = database.transaction("operations", "readonly").objectStore("operations").getAll();
    const operations = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
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
  await page.getByRole("button", { name: "Vorrat", exact: true }).click();
  await expect(page.getByText(/Nutella/i).first()).toBeVisible();

  const exportResponse = await page.request.get("/api/account/export");
  expect(exportResponse.status()).toBe(200);
  expect(exportResponse.headers()["cache-control"]).toContain("no-store");
  expect(exportResponse.headers()["content-disposition"]).toContain("attachment");
  const exportPayload = await exportResponse.json();
  expect(exportPayload.exportVersion).toBe(1);
  expect(exportPayload.identity.email).toBe(email);
  expect(exportPayload.data.households).toHaveLength(1);
  expect(exportPayload.data.inventoryBatches).toHaveLength(1);
  expect(exportPayload.data.products[0].name).toMatch(/Nutella/i);
});
