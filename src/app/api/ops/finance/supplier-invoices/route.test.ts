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

const validInvoice = {
  sourceSystem: "supabase",
  sourceDocumentId: "TEST-INVOICE-00001",
  supplier: "Supabase",
  expenseLabel: "Production database subscription",
  amountMinor: 2500,
  currency: "usd",
  issuedOn: "2026-08-05",
  dueOn: "2026-08-05"
};

function request(body: unknown, origin = "https://foodos-flame.vercel.app"): Request {
  return new Request("https://foodos-flame.vercel.app/api/ops/finance/supplier-invoices", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body)
  });
}

describe("Q-OPS-FINANCE-API-001 supplier invoice intake", () => {
  beforeEach(() => {
    vi.stubEnv("FOODOS_APP_ORIGIN", "https://foodos-flame.vercel.app");
    testState.claims = { aal: "aal2" };
    testState.rpc.mockReset();
    testState.rpc.mockResolvedValue({ data: "journal-1", error: null });
  });

  it("records only a same-origin AAL2 request and normalizes the currency", async () => {
    const response = await POST(request(validInvoice));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ status: "recorded", journalId: "journal-1" });
    expect(testState.rpc).toHaveBeenCalledWith("record_ops_supplier_invoice", expect.objectContaining({
      input_currency: "USD",
      input_amount_minor: 2500,
      input_source_sha256: expect.stringMatching(/^[0-9a-f]{64}$/)
    }));
  });

  it("rejects a cross-site request before it can call the ledger RPC", async () => {
    const response = await POST(request(validInvoice, "https://attacker.invalid"));

    expect(response.status).toBe(403);
    expect(testState.rpc).not.toHaveBeenCalled();
  });

  it("rejects AAL1 and malformed minor-unit amounts", async () => {
    testState.claims = { aal: "aal1" };
    expect((await POST(request(validInvoice))).status).toBe(403);

    testState.claims = { aal: "aal2" };
    expect((await POST(request({ ...validInvoice, amountMinor: "25.50" }))).status).toBe(400);
  });
});
