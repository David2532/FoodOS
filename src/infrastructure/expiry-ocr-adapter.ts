import type { Result } from "../domain/result";
import { failure } from "../domain/result";

export interface ExpiryOcrCandidate {
  kind: "best_before" | "use_by" | "unknown";
  date?: string;
  lotNumber?: string;
  confidence: number;
  source: "ocr";
}

export interface ExpiryOcrInput {
  image: Blob;
  crop: { x: number; y: number; width: number; height: number };
}

export interface ExpiryOcrAdapter {
  readonly id: string;
  analyze(input: ExpiryOcrInput): Promise<Result<ExpiryOcrCandidate[]>>;
}

export class ManualOnlyExpiryOcrAdapter implements ExpiryOcrAdapter {
  readonly id = "manual-only";

  async analyze(input: ExpiryOcrInput): Promise<Result<ExpiryOcrCandidate[]>> {
    void input;
    return failure("OCR_NOT_CONFIGURED", "Kein OCR-Dienst konfiguriert. Datum und Charge müssen manuell bestätigt werden.");
  }
}
