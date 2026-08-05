import { failure, type Result } from "./result";

export interface Gs1Elements {
  gtin?: string;
  lotNumber?: string;
  bestBeforeDate?: string;
  useByDate?: string;
  serialNumber?: string;
}

const fixedLengths: Record<string, number> = { "01": 14, "15": 6, "17": 6 };
const variableMaxLengths: Record<string, number> = { "10": 20, "21": 20 };
const supportedAis = new Set([...Object.keys(fixedLengths), ...Object.keys(variableMaxLengths)]);

function gs1Date(value: string): string | null {
  if (!/^\d{6}$/.test(value)) return null;
  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const encodedDay = Number(value.slice(4, 6));
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = encodedDay === 0 ? lastDay : encodedDay;
  if (day < 1 || day > lastDay) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function hasValidGtinCheckDigit(value: string): boolean {
  if (!/^(?:\d{8}|\d{12,14})$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop();
  if (check == null) return false;
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

function parseParenthesized(input: string): Result<Map<string, string>> {
  const values = new Map<string, string>();
  const expression = /\((\d{2})\)([^()]*)/g;
  let consumed = "";
  for (const match of input.matchAll(expression)) {
    const [whole, ai, rawValue] = match;
    consumed += whole;
    if (!supportedAis.has(ai)) return failure("VALIDATION", `GS1-AI ${ai} wird noch nicht unterstützt.`);
    const value = rawValue.trim();
    const fixedLength = fixedLengths[ai];
    if (fixedLength && value.length !== fixedLength) return failure("VALIDATION", `GS1-AI ${ai} hat eine ungültige Länge.`);
    const maxLength = variableMaxLengths[ai];
    if (maxLength && (!value.length || value.length > maxLength)) return failure("VALIDATION", `GS1-AI ${ai} hat eine ungültige Länge.`);
    if (values.has(ai)) return failure("VALIDATION", `GS1-AI ${ai} ist doppelt vorhanden.`);
    values.set(ai, value);
  }
  if (!values.size || consumed !== input) return failure("VALIDATION", "Der GS1-Code enthält nicht erkennbare Daten.");
  return { ok: true, value: values };
}

function parseElementString(input: string): Result<Map<string, string>> {
  const values = new Map<string, string>();
  let index = input.startsWith("]") ? 3 : 0;
  while (index < input.length) {
    if (input[index] === "\u001d") {
      index += 1;
      continue;
    }
    const ai = input.slice(index, index + 2);
    if (!supportedAis.has(ai)) return failure("VALIDATION", `GS1-AI ${ai || "?"} wird noch nicht unterstützt.`);
    if (values.has(ai)) return failure("VALIDATION", `GS1-AI ${ai} ist doppelt vorhanden.`);
    index += 2;
    const fixedLength = fixedLengths[ai];
    if (fixedLength) {
      const value = input.slice(index, index + fixedLength);
      if (value.length !== fixedLength) return failure("VALIDATION", `GS1-AI ${ai} ist unvollständig.`);
      values.set(ai, value);
      index += fixedLength;
      continue;
    }
    const separator = input.indexOf("\u001d", index);
    const maxLength = variableMaxLengths[ai];
    const end = separator === -1 ? Math.min(input.length, index + maxLength) : separator;
    const value = input.slice(index, end);
    if (!value.length || value.length > maxLength) return failure("VALIDATION", `GS1-AI ${ai} hat eine ungültige Länge.`);
    values.set(ai, value);
    index = separator === -1 ? end : separator + 1;
  }
  return values.size ? { ok: true, value: values } : failure("VALIDATION", "Kein unterstütztes GS1-Feld gefunden.");
}

export function parseGs1(input: string): Result<Gs1Elements> {
  const normalized = input.trim();
  if (!normalized) return failure("VALIDATION", "Der GS1-Code ist leer.");
  const parsed = normalized.startsWith("(") ? parseParenthesized(normalized) : parseElementString(normalized);
  if (!parsed.ok) return parsed;
  const gtin = parsed.value.get("01");
  if (gtin && !hasValidGtinCheckDigit(gtin)) return failure("VALIDATION", "Die GTIN-Prüfziffer ist ungültig.");
  const bestBefore = parsed.value.get("15");
  const useBy = parsed.value.get("17");
  const bestBeforeDate = bestBefore ? gs1Date(bestBefore) : undefined;
  const useByDate = useBy ? gs1Date(useBy) : undefined;
  if (bestBefore && !bestBeforeDate) return failure("VALIDATION", "Das GS1-MHD ist kein plausibles Datum.");
  if (useBy && !useByDate) return failure("VALIDATION", "Das GS1-Verbrauchsdatum ist kein plausibles Datum.");
  return {
    ok: true,
    value: {
      gtin,
      lotNumber: parsed.value.get("10"),
      bestBeforeDate: bestBeforeDate ?? undefined,
      useByDate: useByDate ?? undefined,
      serialNumber: parsed.value.get("21")
    }
  };
}
