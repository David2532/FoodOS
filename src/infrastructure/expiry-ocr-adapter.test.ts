import { describe, expect, it } from "vitest";
import { ManualOnlyExpiryOcrAdapter } from "./expiry-ocr-adapter";

describe("manual OCR fallback", () => {
  it("never simulates an OCR result when no provider is configured", async () => {
    const adapter = new ManualOnlyExpiryOcrAdapter();
    const result = await adapter.analyze({
      image: new Blob(["image"], { type: "image/jpeg" }),
      crop: { x: 0, y: 0, width: 1, height: 1 }
    });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "OCR_NOT_CONFIGURED",
        message: "Kein OCR-Dienst konfiguriert. Datum und Charge müssen manuell bestätigt werden.",
        retryable: false
      }
    });
  });
});
