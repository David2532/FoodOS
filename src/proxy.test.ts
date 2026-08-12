import { describe, expect, it } from "vitest";
import { config } from "./proxy";

const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("session proxy matcher", () => {
  it.each(["/sw.js", "/manifest.webmanifest", "/offline", "/offline/"])("keeps %s independent from Supabase Auth", (pathname) => {
    expect(matcher.test(pathname)).toBe(false);
  });

  it.each(["/", "/inventory", "/auth/confirm", "/api/products/search"])("continues to protect %s", (pathname) => {
    expect(matcher.test(pathname)).toBe(true);
  });
});
