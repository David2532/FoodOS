import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  getUser: vi.fn(),
  getClaims: vi.fn(),
  rpc: vi.fn()
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: state.getUser, getClaims: state.getClaims }, rpc: state.rpc })
}));

import { DELETE, POST } from "./route";

const householdId = "11111111-1111-4111-8111-111111111111";

function request(body: unknown): Request {
  return new Request("https://foodos.example/api/households/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/households/select", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.getUser.mockResolvedValue({ data: { user: { id: "22222222-2222-4222-8222-222222222222" } } });
    state.getClaims.mockResolvedValue({ data: { claims: { aal: "aal2" } } });
    state.rpc.mockResolvedValue({ data: [{
      household_id: householdId,
      household_name: "Zuhause",
      member_role: "owner",
      membership_revision: 1,
      member_count: 1,
      member_limit: 1
    }], error: null });
  });

  it("sets a strict HttpOnly cookie only after the live membership RPC proves access", async () => {
    const response = await POST(request({ householdId }));

    expect(response.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith("get_my_households");
    expect(response.headers.get("cache-control")).toContain("no-store");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("foodos_selected_household=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
  });

  it("does not set a cookie for AAL1 or a foreign household", async () => {
    state.getClaims.mockResolvedValueOnce({ data: { claims: { aal: "aal1" } } });
    const aal1 = await POST(request({ householdId }));
    expect(aal1.status).toBe(403);
    expect(aal1.headers.get("set-cookie")).toBeNull();

    state.rpc.mockResolvedValueOnce({ data: [], error: null });
    const foreign = await POST(request({ householdId }));
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get("set-cookie")).toBeNull();
  });

  it("rejects malformed and oversized bodies before opening a session", async () => {
    expect((await POST(request({ householdId: "not-a-uuid" }))).status).toBe(400);
    expect((await POST(request({ householdId, padding: "x".repeat(600) }))).status).toBe(413);
    expect(state.getUser).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/households/select", () => {
  it("expires the strict HttpOnly selection cookie without caching", async () => {
    const response = await DELETE();
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(cookie).toContain("foodos_selected_household=");
    expect(cookie).toMatch(/Max-Age=0/i);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
  });
});
