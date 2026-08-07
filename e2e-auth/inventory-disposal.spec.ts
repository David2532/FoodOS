import { createHmac, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const PRODUCT_GTIN = "04012345123456";
const PRODUCT_NAME = "Entsorgungs-E2E Produkt";
const EXPIRED_GS1 = `(01)${PRODUCT_GTIN}(17)260101(10)DISPOSE-E2E`;

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

async function createAal2Household(page: Page): Promise<string> {
  const email = `inventory-disposal-e2e-${randomUUID()}@example.test`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Privat starten" })).toBeVisible();
  await page.getByLabel(/Ich bin mindestens 16 Jahre alt/).check();
  await page.getByLabel(/Ich habe die Hinweise gelesen/).check();
  await page.getByRole("button", { name: "Nur notwendige verwenden" }).click();
  await page.getByText("Mit E-Mail weitermachen", { exact: true }).click();
  await page.getByRole("tab", { name: "Neu hier" }).click();
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill("FoodOS-Inventory-Disposal-E2E-2026!");
  await page.getByRole("button", { name: "Konto erstellen" }).click();

  await expect(page.getByRole("heading", { name: "2FA aktivieren" })).toBeVisible();
  await page.getByRole("button", { name: /QR-Code für Google Authenticator erzeugen/ }).click();
  await page.getByText("Setup-Schlüssel manuell verwenden", { exact: true }).click();
  const secret = (await page.locator(".mfa-secret code").textContent())?.trim();
  expect(secret).toBeTruthy();
  await page.getByLabel("Sechsstelliger Code").fill(currentTotp(secret ?? ""));
  await page.getByRole("button", { name: "2FA bestätigen" }).click();

  await page.getByLabel("Haushaltsname").fill("Entsorgung E2E Haushalt");
  await page.getByRole("button", { name: "Haushalt sicher anlegen" }).click();
  await expect(page.getByRole("heading", { name: "Heute" })).toBeVisible({ timeout: 15_000 });
  return email;
}

test("Q-INV-DISCARD-E2E-001 safely disposes a post-use-by batch once across offline reconnect and reload", async ({ page }) => {
  test.setTimeout(120_000);

  await page.route(`**/api/products/${PRODUCT_GTIN}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        globalCatalogStatus: "not-configured",
        product: {
          barcode: PRODUCT_GTIN,
          name: PRODUCT_NAME,
          brand: "FoodOS Testquelle",
          quantity: "1 Stück",
          categories: ["Synthetisches Testprodukt"],
          countries: ["Deutschland"],
          labels: [],
          structuredIngredients: [],
          allergens: [],
          traces: [],
          additives: [],
          nutrition: {},
          assessments: [],
          source: "open-food-facts",
          sourceUrl: `https://world.openfoodfacts.org/product/${PRODUCT_GTIN}`,
          sourceLanguage: "de",
          retrievedAt: "2026-08-06T10:00:00.000Z",
          confidence: 0.82
        }
      })
    });
  });

  await createAal2Household(page);
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await page.getByLabel("Lagerort für kommende Scans").selectOption("pantry");
  await page.getByPlaceholder("EAN / UPC / GS1 eingeben").fill(EXPIRED_GS1);
  await page.getByRole("button", { name: "Prüfen" }).click();
  await expect(page.locator(".capture-list li").filter({ hasText: PRODUCT_NAME })).toBeVisible();

  await page.getByRole("button", { name: "Fertig" }).click();
  const gs1Review = page.getByRole("group", { name: "GS1-Angaben der Packung prüfen" });
  await expect(gs1Review.getByLabel("Verbrauchsdatum")).toHaveValue("2026-01-01");
  await expect(gs1Review.getByLabel("Charge")).toHaveValue("DISPOSE-E2E");
  await gs1Review.getByLabel("Mit der Packung abgeglichen").check();
  await page.getByRole("button", { name: "Einkauf übernehmen" }).click();
  await expect(page.getByText("1 Packung im Vorrat", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Vorrat ansehen" }).click();

  const inventoryRow = page.getByRole("button", { name: new RegExp(PRODUCT_NAME) });
  await expect(inventoryRow).toBeVisible();
  await expect(inventoryRow).toContainText("ZU VERBRAUCHEN");
  await inventoryRow.click();

  const disposalForm = page.getByRole("form", { name: `Wegwerfen von ${PRODUCT_NAME} buchen` });
  await expect(disposalForm.getByRole("alert")).toContainText("Nicht verzehren");
  await expect(disposalForm.getByRole("button", { name: "Verzehrt" })).toBeDisabled();
  await expect(disposalForm.getByRole("button", { name: "Weggeworfen" })).toHaveAttribute("aria-pressed", "true");
  await expect(disposalForm.getByLabel("Menge wegwerfen in Stück")).toHaveValue("1");

  await page.context().setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await disposalForm.getByRole("button", { name: "Wegwerfen verbindlich buchen" }).click();
  await expect(disposalForm.getByText("Auf diesem Gerät gespeichert", { exact: true })).toBeVisible();

  const queuedDisposal = await page.evaluate(async () => {
    const openRequest = indexedDB.open("foodos-device-v1");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
    });
    const transaction = database.transaction("operations", "readonly");
    const readRequest = transaction.objectStore("operations").getAll();
    const operations = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      readRequest.onsuccess = () => resolve(readRequest.result);
      readRequest.onerror = () => reject(readRequest.error);
    });
    database.close();
    const matching = operations.filter((operation) => operation.kind === "inventory.discard_batch");
    const operation = matching[0];
    return {
      count: matching.length,
      id: typeof operation?.id === "string" ? operation.id : null,
      state: operation?.state,
      hasCiphertext: operation?.ciphertext instanceof ArrayBuffer && operation.ciphertext.byteLength > 0,
      ivBytes: operation?.iv instanceof ArrayBuffer ? operation.iv.byteLength : 0,
      leaksPrivatePayload: Boolean(operation && (
        "args" in operation || "householdId" in operation || "actorId" in operation || "discarded_amount" in operation
      ))
    };
  });
  expect(queuedDisposal).toEqual({
    count: 1,
    id: expect.any(String),
    state: "QUEUED",
    hasCiphertext: true,
    ivBytes: 12,
    leaksPrivatePayload: false
  });
  if (!queuedDisposal.id) throw new Error("The durable disposal operation is missing its public operation ID.");
  const disposalOperationId = queuedDisposal.id;

  await page.context().setOffline(false);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("online"));
  });
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  await expect(page.getByText("Wegwerfen bestätigt", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: new RegExp(PRODUCT_NAME) })).toHaveCount(0);
  await expect.poll(() => page.evaluate(async (operationId) => {
    const openRequest = indexedDB.open("foodos-device-v1");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
    });
    const transaction = database.transaction("operations", "readonly");
    const readRequest = transaction.objectStore("operations").get(operationId);
    const operation = await new Promise<unknown>((resolve, reject) => {
      readRequest.onsuccess = () => resolve(readRequest.result);
      readRequest.onerror = () => reject(readRequest.error);
    });
    database.close();
    return operation == null;
  }, disposalOperationId)).toBe(true);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Heute" })).toBeVisible();
  await page.getByRole("button", { name: "Vorrat", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(PRODUCT_NAME) })).toHaveCount(0);

  const exportResponse = await page.request.get("/api/account/export");
  expect(exportResponse.status()).toBe(200);
  const exportPayload = await exportResponse.json();
  const product = exportPayload.data.products.find((entry: { name: string }) => entry.name === PRODUCT_NAME);
  expect(product).toBeTruthy();
  const batch = exportPayload.data.inventoryBatches.find(
    (entry: { product_id: string }) => entry.product_id === product.id
  );
  expect(batch).toEqual(expect.objectContaining({
    remaining_amount: 0,
    initial_amount: 1,
    unit: "piece",
    use_by_date: "2026-01-01",
    lot_number: "DISPOSE-E2E"
  }));

  const batchEvents = exportPayload.data.inventoryEvents.filter(
    (entry: { batch_id: string }) => entry.batch_id === batch.id
  );
  expect(batchEvents.filter((entry: { event_type: string }) => entry.event_type === "purchase")).toHaveLength(1);
  const discardEvents = batchEvents.filter((entry: { event_type: string }) => entry.event_type === "discard");
  expect(discardEvents).toHaveLength(1);
  expect(discardEvents[0]).toEqual(expect.objectContaining({
    amount_delta: -1,
    client_mutation_id: disposalOperationId
  }));
  expect(exportPayload.data.foodLogEntries.filter(
    (entry: { batch_id: string }) => entry.batch_id === batch.id
  )).toHaveLength(0);
});

test("Q-INV-DISCARD-E2E-002 reconciles a lost disposal acknowledgement through the original receipt", async ({ page }) => {
  test.setTimeout(120_000);

  await page.route(`**/api/products/${PRODUCT_GTIN}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        globalCatalogStatus: "not-configured",
        product: {
          barcode: PRODUCT_GTIN,
          name: PRODUCT_NAME,
          brand: "FoodOS Testquelle",
          quantity: "1 Stück",
          categories: ["Synthetisches Testprodukt"],
          countries: ["Deutschland"],
          labels: [],
          structuredIngredients: [],
          allergens: [],
          traces: [],
          additives: [],
          nutrition: {},
          assessments: [],
          source: "open-food-facts",
          sourceUrl: `https://world.openfoodfacts.org/product/${PRODUCT_GTIN}`,
          sourceLanguage: "de",
          retrievedAt: "2026-08-06T10:00:00.000Z",
          confidence: 0.82
        }
      })
    });
  });

  await createAal2Household(page);
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await page.getByLabel("Lagerort für kommende Scans").selectOption("pantry");
  await page.getByPlaceholder("EAN / UPC / GS1 eingeben").fill(EXPIRED_GS1);
  await page.getByRole("button", { name: "Prüfen" }).click();
  await expect(page.locator(".capture-list li").filter({ hasText: PRODUCT_NAME })).toBeVisible();
  await page.getByRole("button", { name: "Fertig" }).click();
  const gs1Review = page.getByRole("group", { name: "GS1-Angaben der Packung prüfen" });
  await gs1Review.getByLabel("Mit der Packung abgeglichen").check();
  await page.getByRole("button", { name: "Einkauf übernehmen" }).click();
  await expect(page.getByText("1 Packung im Vorrat", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Vorrat ansehen" }).click();
  await page.getByRole("button", { name: new RegExp(PRODUCT_NAME) }).click();

  const rpcPattern = "**/rest/v1/rpc/discard_inventory_batch";
  let rpcAttempt = 0;
  let resolveFirstCommit!: (value: { mutationId: string; acknowledgement: Record<string, unknown> }) => void;
  const firstCommit = new Promise<{ mutationId: string; acknowledgement: Record<string, unknown> }>((resolve) => {
    resolveFirstCommit = resolve;
  });
  let resolveReplay!: (value: { mutationId: string; acknowledgement: Record<string, unknown> }) => void;
  const replay = new Promise<{ mutationId: string; acknowledgement: Record<string, unknown> }>((resolve) => {
    resolveReplay = resolve;
  });
  await page.route(rpcPattern, async (route) => {
    rpcAttempt += 1;
    const requestBody = route.request().postDataJSON() as Record<string, unknown>;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    const responseBody = await response.body();
    const acknowledgement = JSON.parse(responseBody.toString("utf8")) as Record<string, unknown>;
    expect(typeof requestBody.mutation_id).toBe("string");
    if (rpcAttempt === 1) {
      resolveFirstCommit({ mutationId: String(requestBody.mutation_id), acknowledgement });

      // The real local RPC has committed and returned its receipt-backed ACK to the
      // Playwright proxy. Deliberately withhold only that response body from the browser
      // so the durable client must fail closed as UNCERTAIN instead of assuming success.
      await route.fulfill({ response, body: "" });
      return;
    }

    expect(rpcAttempt).toBe(2);
    resolveReplay({ mutationId: String(requestBody.mutation_id), acknowledgement });
    await route.fulfill({ response, body: responseBody });
  });

  const disposalForm = page.getByRole("form", { name: `Wegwerfen von ${PRODUCT_NAME} buchen` });
  await disposalForm.getByRole("button", { name: "Wegwerfen verbindlich buchen" }).click();
  const committed = await firstCommit;
  expect(committed.acknowledgement).toEqual(expect.objectContaining({
    remaining_amount: 0,
    idempotent_replay: false
  }));
  await expect(disposalForm.getByText("Serverbestätigung unvollständig", { exact: true })).toBeVisible();
  await expect(disposalForm.getByRole("button", { name: /sicher.*abgleichen/i })).toBeVisible();

  const uncertainOperation = await page.evaluate(async (operationId) => {
    const openRequest = indexedDB.open("foodos-device-v1");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
    });
    const transaction = database.transaction("operations", "readonly");
    const readRequest = transaction.objectStore("operations").get(operationId);
    const operation = await new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
      readRequest.onsuccess = () => resolve(readRequest.result);
      readRequest.onerror = () => reject(readRequest.error);
    });
    database.close();
    return operation ? {
      state: operation.state,
      safeError: operation.safeError,
      hasCiphertext: operation.ciphertext instanceof ArrayBuffer && operation.ciphertext.byteLength > 0,
      leaksPrivatePayload: "args" in operation || "householdId" in operation || "actorId" in operation
    } : null;
  }, committed.mutationId);
  expect(uncertainOperation).toEqual({
    state: "UNCERTAIN",
    safeError: "acknowledgement_unknown",
    hasCiphertext: true,
    leaksPrivatePayload: false
  });

  await disposalForm.getByRole("button", { name: /sicher.*abgleichen/i }).click();
  await expect.poll(() => rpcAttempt, { timeout: 15_000 }).toBe(2);
  const replayed = await replay;
  expect(replayed.mutationId).toBe(committed.mutationId);
  expect(replayed.acknowledgement).toEqual(expect.objectContaining({
    batch_id: committed.acknowledgement.batch_id,
    remaining_amount: 0,
    idempotent_replay: true
  }));
  await expect(page.getByText("Wegwerfen bestätigt", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(async (operationId) => {
    const openRequest = indexedDB.open("foodos-device-v1");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
    });
    const transaction = database.transaction("operations", "readonly");
    const readRequest = transaction.objectStore("operations").get(operationId);
    const operation = await new Promise<unknown>((resolve, reject) => {
      readRequest.onsuccess = () => resolve(readRequest.result);
      readRequest.onerror = () => reject(readRequest.error);
    });
    database.close();
    return operation == null;
  }, committed.mutationId)).toBe(true);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Heute" })).toBeVisible();
  await page.getByRole("button", { name: "Vorrat", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(PRODUCT_NAME) })).toHaveCount(0);

  const exportResponse = await page.request.get("/api/account/export");
  expect(exportResponse.status()).toBe(200);
  const exportPayload = await exportResponse.json();
  const product = exportPayload.data.products.find((entry: { name: string }) => entry.name === PRODUCT_NAME);
  expect(product).toBeTruthy();
  const batch = exportPayload.data.inventoryBatches.find(
    (entry: { product_id: string }) => entry.product_id === product.id
  );
  expect(batch).toEqual(expect.objectContaining({ remaining_amount: 0, initial_amount: 1, unit: "piece" }));
  const discardEvents = exportPayload.data.inventoryEvents.filter(
    (entry: { batch_id: string; event_type: string }) => entry.batch_id === batch.id && entry.event_type === "discard"
  );
  expect(discardEvents).toHaveLength(1);
  expect(discardEvents[0]).toEqual(expect.objectContaining({
    amount_delta: -1,
    client_mutation_id: committed.mutationId
  }));
  expect(exportPayload.data.foodLogEntries.filter(
    (entry: { batch_id: string }) => entry.batch_id === batch.id
  )).toHaveLength(0);
});
