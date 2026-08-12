import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function acceptNecessaryPrivacy(page: Page) {
  await expect(page.getByRole("heading", { name: "Privat starten" })).toBeVisible();
  await page.getByLabel(/Ich bin mindestens 16 Jahre alt/).check();
  await page.getByLabel(/Ich habe die Hinweise gelesen/).check();
  await page.getByRole("button", { name: "Nur notwendige verwenden" }).click();
  await expect(page.getByRole("heading", { name: "Einfach loslegen" })).toBeVisible();
}

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

async function createVerifiedHousehold(page: Page) {
  const email = `foodos-e2e-offline-cleanup-${Date.now()}@example.test`;
  const password = "FoodOS-E2E-Offline-Cleanup-2026!";

  await page.goto("/");
  await acceptNecessaryPrivacy(page);
  await page.getByText("Mit E-Mail weitermachen", { exact: true }).click();
  await page.getByRole("tab", { name: "Neu hier" }).click();
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Konto erstellen" }).click();

  await expect(page.getByRole("heading", { name: "2FA aktivieren" })).toBeVisible();
  await page.getByRole("button", { name: /QR-Code für Google Authenticator erzeugen/ }).click();
  await page.getByText("Setup-Schlüssel manuell verwenden", { exact: true }).click();
  const secret = (await page.locator(".mfa-secret code").textContent())?.trim();
  expect(secret).toBeTruthy();
  await page.getByLabel("Sechsstelliger Code").fill(currentTotp(secret ?? ""));
  await page.getByRole("button", { name: "2FA bestätigen" }).click();

  await expect(page.getByRole("heading", { name: "Deinen Haushalt anlegen" })).toBeVisible();
  await page.getByLabel("Haushaltsname").fill("Offline-Cleanup E2E");
  await page.getByRole("button", { name: "Haushalt sicher anlegen" }).click();
  await expect(page.getByRole("heading", { name: "Heute", exact: true })).toBeVisible();
}

test("blocked offline cleanup remains pending, updates both tabs, and confirms deletion after the blocker closes", async ({ page }) => {
  await createVerifiedHousehold(page);
  await page.getByRole("button", { name: "Konto und Einstellungen öffnen" }).click();
  const settings = page.locator(".settings-view");
  const signOut = settings.getByRole("button", { name: /Sicher abmelden/ });
  await expect(signOut).toBeVisible();

  const blocker = await page.context().newPage();
  try {
    await blocker.goto("/");
    await expect(blocker.getByRole("button", { name: "Konto und Einstellungen öffnen" })).toBeVisible();
    const heldDatabase = await blocker.evaluate(async () => {
      const request = indexedDB.open("foodos-device-v1");
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      (window as typeof window & { __foodosOfflineCleanupBlocker?: IDBDatabase }).__foodosOfflineCleanupBlocker = database;
      return { name: database.name, hasOperationsStore: database.objectStoreNames.contains("operations") };
    });
    expect(heldDatabase).toEqual({ name: "foodos-device-v1", hasOperationsStore: true });

    await signOut.click();
    const cleanupAlert = settings.getByRole("alert");
    await expect(cleanupAlert).toContainText("Die Löschung lokaler Offline-Daten ist noch nicht bestätigt");
    await expect(cleanupAlert).toContainText("die Abmeldung wird automatisch fortgesetzt");
    await expect(cleanupAlert).toContainText("Du bleibst bis dahin angemeldet");
    await expect(signOut).toBeDisabled();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("foodos:offline-data-purged-v1"))).toBe("pending");

    // A `storage` event updates the other live tab. It must not reopen the database or
    // present an empty outbox while deletion remains unconfirmed.
    await expect(blocker.locator(".outbox-status[role='alert']")).toContainText("Lokale Offline-Daten werden noch entfernt");

    await blocker.evaluate(() => {
      (window as typeof window & { __foodosOfflineCleanupBlocker?: IDBDatabase }).__foodosOfflineCleanupBlocker?.close();
    });
    await blocker.close();

    // The first delete request remains live after `onblocked`; the user-initiated
    // secure sign-out resumes automatically once that request confirms deletion.
    await expect.poll(() => page.evaluate(() => localStorage.getItem("foodos:offline-data-purged-v1"))).toBe("cleared");
    await expect.poll(async () => page.evaluate(async () => {
      const databases = await indexedDB.databases();
      return databases.some((database) => database.name === "foodos-device-v1");
    })).toBe(false);
    await expect(page.getByRole("heading", { name: "Privat starten" })).toBeVisible();
  } finally {
    if (!blocker.isClosed()) {
      await blocker.evaluate(() => {
        (window as typeof window & { __foodosOfflineCleanupBlocker?: IDBDatabase }).__foodosOfflineCleanupBlocker?.close();
      }).catch(() => undefined);
      await blocker.close().catch(() => undefined);
    }
  }
});
