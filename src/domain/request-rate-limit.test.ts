import { describe, expect, it } from "vitest";
import { allowRequestInWindow, type RequestWindow } from "./request-rate-limit";

describe("request rate limit window", () => {
  it("applies the supplied limit without retaining request content", () => {
    const windows = new Map<string, RequestWindow>();
    expect(allowRequestInWindow(windows, "actor-1", 2, 1_000)).toBe(true);
    expect(allowRequestInWindow(windows, "actor-1", 2, 1_001)).toBe(true);
    expect(allowRequestInWindow(windows, "actor-1", 2, 1_002)).toBe(false);
    expect([...windows.keys()]).toEqual(["actor-1"]);
  });

  it("opens a fresh window after one minute", () => {
    const windows = new Map<string, RequestWindow>();
    expect(allowRequestInWindow(windows, "public-preview", 1, 0)).toBe(true);
    expect(allowRequestInWindow(windows, "public-preview", 1, 59_999)).toBe(false);
    expect(allowRequestInWindow(windows, "public-preview", 1, 60_000)).toBe(true);
  });

  it("accepts a 20-product authenticated purchase inside the 30-request limit", () => {
    const windows = new Map<string, RequestWindow>();
    const firstTwenty = Array.from({ length: 20 }, (_, index) => allowRequestInWindow(windows, "authenticated-actor", 30, index));
    expect(firstTwenty.every(Boolean)).toBe(true);
    for (let index = 20; index < 30; index += 1) {
      expect(allowRequestInWindow(windows, "authenticated-actor", 30, index)).toBe(true);
    }
    expect(allowRequestInWindow(windows, "authenticated-actor", 30, 30)).toBe(false);
  });
});
