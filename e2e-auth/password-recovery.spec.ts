import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const mailpitBaseUrl = "http://127.0.0.1:54324/api/v1";

async function acceptNecessaryPrivacy(page: Page) {
  await expect(page.getByRole("heading", { name: "Privat starten" })).toBeVisible();
  await page.getByLabel(/Ich bin mindestens 16 Jahre alt/).check();
  await page.getByLabel(/Ich habe die Hinweise gelesen/).check();
  await page.getByRole("button", { name: "Nur notwendige verwenden" }).click();
  await expect(page.getByRole("heading", { name: "Einfach loslegen" })).toBeVisible();
}

function mailpitMessageId(payload: unknown, recipient: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const messages = (payload as Record<string, unknown>).messages;
  if (!Array.isArray(messages)) return null;

  for (const message of messages) {
    if (!message || typeof message !== "object" || Array.isArray(message)) continue;
    if (!JSON.stringify(message).includes(recipient)) continue;
    const id = (message as Record<string, unknown>).ID;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return null;
}

function recoveryLinkFromMailpitMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const message = payload as Record<string, unknown>;
  const content = typeof message.HTML === "string"
    ? message.HTML
    : typeof message.Text === "string"
      ? message.Text
      : "";

  for (const match of content.matchAll(/https?:[^\s"'<]+/g)) {
    const candidate = match[0].replace(/&amp;/g, "&");
    try {
      if (new URL(candidate).pathname === "/auth/v1/verify") return candidate;
    } catch {
      // A malformed non-recovery URL in the email is not a valid reset link.
    }
  }
  return null;
}

async function readRecoveryLink(request: APIRequestContext, recipient: string): Promise<string> {
  let recoveryLink: string | null = null;

  await expect.poll(async () => {
    const messageList = await request.get(`${mailpitBaseUrl}/messages`);
    if (!messageList.ok()) return false;
    const messageId = mailpitMessageId(await messageList.json(), recipient);
    if (!messageId) return false;

    const message = await request.get(`${mailpitBaseUrl}/message/${encodeURIComponent(messageId)}`);
    if (!message.ok()) return false;
    recoveryLink = recoveryLinkFromMailpitMessage(await message.json());
    return Boolean(recoveryLink);
  }, { timeout: 15_000 }).toBe(true);

  if (!recoveryLink) throw new Error("Local recovery email was not available from Mailpit.");
  return recoveryLink;
}

test("password recovery accepts only recovery claims and revokes prior credentials", async ({ page }) => {
  const email = `foodos-e2e-recovery-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const oldPassword = "FoodOS-E2E-Recovery-Original-2026!";
  const newPassword = "FoodOS-E2E-Recovery-Replaced-2026!";

  await page.goto("/");
  await acceptNecessaryPrivacy(page);
  await page.getByText("Mit E-Mail weitermachen", { exact: true }).click();
  await page.getByRole("tab", { name: "Neu hier" }).click();
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(oldPassword);
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page.getByRole("heading", { name: "2FA aktivieren" })).toBeVisible();

  // An ordinary AAL1 session cannot open the reset form or mutate a password.
  await page.goto("/auth/passwort-zuruecksetzen");
  await expect(page).toHaveURL(/\/?auth_error=recovery$/);
  await expect(page.getByRole("heading", { name: "2FA aktivieren" })).toBeVisible();
  const aal1Reset = await page.evaluate(async (password) => {
    const response = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reset", newPassword: password, passwordConfirmation: password })
    });
    return { cacheControl: response.headers.get("cache-control"), status: response.status };
  }, newPassword);
  expect(aal1Reset.status).toBe(401);
  expect(aal1Reset.cacheControl).toContain("no-store");

  await page.getByRole("button", { name: "Sicher abmelden" }).click();
  await expect(page.getByRole("heading", { name: "Privat starten" })).toBeVisible();
  await page.goto("/");
  await acceptNecessaryPrivacy(page);
  await page.getByText("Mit E-Mail weitermachen", { exact: true }).click();
  await page.getByRole("button", { name: "Passwort vergessen?" }).click();
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Link zum Zurücksetzen senden" }).click();
  await expect(page.getByRole("status")).toContainText("Wenn zu dieser Adresse ein FoodOS-Konto gehört");

  const recoveryLink = await readRecoveryLink(page.request, email);
  const passwordResetMethods: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/auth/password-reset") passwordResetMethods.push(request.method());
  });

  // This navigation uses the link Mailpit received from the actual Supabase recovery
  // endpoint. The browser therefore exercises PKCE exchange and the same-origin callback.
  await page.goto(recoveryLink);
  await expect(page).toHaveURL(/\/auth\/passwort-zuruecksetzen$/);
  await expect(page.getByRole("heading", { name: "Neues Passwort festlegen" })).toBeVisible();
  await page.getByLabel("Neues Passwort", { exact: true }).fill(newPassword);
  await page.getByLabel("Neues Passwort wiederholen").fill(newPassword);
  await page.getByRole("button", { name: "Passwort sicher speichern" }).click();
  await expect(page.getByRole("heading", { name: "Alles erledigt" })).toBeVisible();
  expect(passwordResetMethods).toEqual(["POST"]);

  await page.getByRole("link", { name: "Zur Anmeldung" }).click();
  await acceptNecessaryPrivacy(page);
  await page.getByText("Mit E-Mail weitermachen", { exact: true }).click();
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(oldPassword);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.locator(".auth-message.error")).toContainText("Anmeldung fehlgeschlagen");

  await page.getByLabel("Passwort").fill(newPassword);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "2FA aktivieren" })).toBeVisible();
});
