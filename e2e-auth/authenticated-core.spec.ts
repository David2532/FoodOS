import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

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
  await page.getByRole("tab", { name: "Registrieren" }).click();
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
});
