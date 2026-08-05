import { afterEach, describe, expect, it, vi } from "vitest";
import { isPublicCatalogPreviewRequest } from "./catalog-preview";

describe("public catalog preview boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows a public-source-only preview locally", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(isPublicCatalogPreviewRequest("https://foodos.test/api/products/search?q=whey&preview=1")).toBe(true);
  });

  it("keeps the preview closed in production unless it is explicitly enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE_ENABLED", "");
    expect(isPublicCatalogPreviewRequest("https://foodos.test/api/products/search?q=whey&preview=1")).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE_ENABLED", "true");
    expect(isPublicCatalogPreviewRequest("https://foodos.test/api/products/search?q=whey&preview=1")).toBe(true);
    expect(isPublicCatalogPreviewRequest("https://foodos.test/api/products/search?q=whey")).toBe(false);
  });
});
