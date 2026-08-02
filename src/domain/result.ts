export type FoodOsErrorCode =
  | "VALIDATION"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "CONFLICT"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "DEPENDENCY"
  | "INTEGRITY"
  | "OFFLINE"
  | "OCR_NOT_CONFIGURED"
  | "INTERNAL";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: FoodOsError };

export interface FoodOsError {
  code: FoodOsErrorCode;
  message: string;
  retryable: boolean;
  reference?: string;
}

export function failure(code: FoodOsErrorCode, message: string, retryable = false): Result<never> {
  return { ok: false, error: { code, message, retryable } };
}
