import { describe, expect, it } from "vitest";
import { hasValidGtinCheckDigit, parseGs1 } from "./gs1";

describe("Q-SCAN-GS1-UNIT-001 GS1 parsing", () => {
  it("parses GTIN, lot, best-before and serial from a parenthesized code", () => {
    expect(parseGs1("(01)04012345123456(15)260831(10)LOT-7(21)SERIAL-2")).toEqual({
      ok: true,
      value: {
        gtin: "04012345123456",
        lotNumber: "LOT-7",
        bestBeforeDate: "2026-08-31",
        useByDate: undefined,
        serialNumber: "SERIAL-2"
      }
    });
  });

  it("uses the GS separator for variable fields", () => {
    expect(parseGs1("01040123451234561726080310ABC\u001d21XYZ")).toEqual({
      ok: true,
      value: {
        gtin: "04012345123456",
        lotNumber: "ABC",
        bestBeforeDate: undefined,
        useByDate: "2026-08-03",
        serialNumber: "XYZ"
      }
    });
  });

  it("rejects invalid check digits and impossible dates", () => {
    expect(hasValidGtinCheckDigit("04012345123457")).toBe(false);
    expect(parseGs1("(01)04012345123457(15)260831").ok).toBe(false);
    expect(parseGs1("(15)261332").ok).toBe(false);
  });

  it("rejects empty, unsupported, duplicate and incomplete element strings", () => {
    expect(parseGs1("").ok).toBe(false);
    expect(parseGs1("(99)abc").ok).toBe(false);
    expect(parseGs1("(15)260831(15)260901").ok).toBe(false);
    expect(parseGs1("01040123").ok).toBe(false);
    expect(parseGs1("99123").ok).toBe(false);
  });

  it("supports scanner symbology prefixes and GS1 end-of-month day zero", () => {
    expect(parseGs1("]C1010401234512345615260200")).toEqual({
      ok: true,
      value: {
        gtin: "04012345123456",
        lotNumber: undefined,
        bestBeforeDate: "2026-02-28",
        useByDate: undefined,
        serialNumber: undefined
      }
    });
  });
});
