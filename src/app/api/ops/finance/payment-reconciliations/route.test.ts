import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  claims: { aal: "aal2" } as { aal: "aal1" | "aal2" } | null,
  rpc: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: testState.claims }, error: null }) },
    rpc: (...args: unknown[]) => testState.rpc(...args)
  })
}));

import { POST } from "./route";

const validPayment = {
  journalId: "70000000-0000-4000-8000-000000000011",
  paymentSystem: "PAYPAL",
  externalPaymentId: "PAYPAL-TEST-PAYMENT-0001",
  artifactSha256: "A".repeat(64),
  parserVersion: "GMAIL-HTML-BODY-V1",
  amountMinor: 13_113,
  currency: "eur",
  paidOn: "2026-08-05"
};

function request(body: unknown, origin = "https://foodos-flame.vercel.app"): Request {
  return new Request("https://foodos-flame.vercel.app/api/ops/finance/payment-reconciliations", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body)
  });
}

describe("Q-OPS-FINANCE-API-002 payment reconciliation", () => {
  beforeEach(() => {
    vi.stubEnv("FOODOS_APP_ORIGIN", "https://foodos-flame.vercel.app");
    testState.claims = { aal: "aal2" };
    testState.rpc.mockReset();
    testState.rpc.mockResolvedValue({ data: 42, error: null });
  });

  it("normalizes and forwards exact evidence metadata for an AAL2 same-origin request", async () => {
    const response = await POST(request(validPayment));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ status: "recorded", eventSequence: 42 });
    expect(testState.rpc).toHaveBeenCalledWith("record_ops_supplier_payment", {
      input_journal_id: validPayment.journalId,
      input_payment_system: "paypal",
      input_external_payment_id: validPayment.externalPaymentId,
      input_artifact_sha256: validPayment.artifactSha256.toLowerCase(),
      input_parser_version: "gmail-html-body-v1",
      input_amount_minor: 13_113,
      input_currency: "EUR",
      input_paid_on: "2026-08-05"
    });
  });

  it("rejects cross-site and AAL1 requests before the payment RPC", async () => {
    expect((await POST(request(validPayment, "https://attacker.invalid"))).status).toBe(403);
    expect(testState.rpc).not.toHaveBeenCalled();

    testState.claims = { aal: "aal1" };
    expect((await POST(request(validPayment))).status).toBe(403);
    expect(testState.rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed or additional banking payload fields", async () => {
    expect((await POST(request({ ...validPayment, amountMinor: "131.13" }))).status).toBe(400);
    expect((await POST(request({ ...validPayment, artifactSha256: "not-a-sha" }))).status).toBe(400);
    expect((await POST(request({ ...validPayment, iban: "DE00TEST" }))).status).toBe(400);
    expect(testState.rpc).not.toHaveBeenCalled();
  });

  it("returns a closed error without exposing database conflict details", async () => {
    testState.rpc.mockResolvedValue({ data: null, error: { message: "Conflicting duplicate payment evidence" } });
    const response = await POST(request(validPayment));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "PAYMENT_NOT_RECONCILED" });
  });
});
