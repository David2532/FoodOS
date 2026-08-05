import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("recall ingestion job boundary", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed when server-only configuration is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const response = await GET(new Request("https://foodos.test/api/jobs/recalls"));
    expect(response.status).toBe(503);
  });

  it("rejects callers without the exact bearer secret before any provider access", async () => {
    vi.stubEnv("CRON_SECRET", "fixture-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service-role-key");
    const response = await GET(new Request("https://foodos.test/api/jobs/recalls", {
      headers: { Authorization: "Bearer wrong-secret" }
    }));
    expect(response.status).toBe(401);
  });
});
