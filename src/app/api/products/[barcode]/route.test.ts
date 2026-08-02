import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const context = { params: Promise.resolve({ barcode: "3017624010701" }) };

describe("product lookup abuse boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("limits unauthenticated local-preview lookup bursts before provider access", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const provider = vi.fn(async () => new Response("{}", { status: 404 }));
    vi.stubGlobal("fetch", provider);

    for (let index = 0; index < 30; index += 1) {
      expect((await GET(new Request("http://localhost/api/products/3017624010701"), context)).status).toBe(404);
    }
    const limited = await GET(new Request("http://localhost/api/products/3017624010701"), context);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(provider).toHaveBeenCalledTimes(60);
  });
});
