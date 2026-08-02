export type RecallMatchKind = "exact" | "possible_gtin" | "text_candidate" | "none" | "source_unavailable";

export interface RecallNotice {
  sourceRecordId: string;
  status: "active" | "corrected" | "withdrawn";
  productName: string;
  gtins: string[];
  lotNumbers: string[];
  sourceUrl: string;
  publishedAt: string;
  retrievedAt: string;
}

export interface RecallBatchIdentity {
  gtin?: string;
  lotNumber?: string;
  productName: string;
}

export interface RecallAssessment {
  kind: RecallMatchKind;
  blocksConsumption: boolean;
  stale: boolean;
  wording: string;
  sourceUrl?: string;
}

function canonical(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("de-DE").replace(/[^a-z0-9äöüß]+/g, " ").trim();
}

function isStale(retrievedAt: string, now: string, maxAgeHours: number): boolean {
  const age = new Date(now).getTime() - new Date(retrievedAt).getTime();
  return !Number.isFinite(age) || age > maxAgeHours * 60 * 60 * 1000;
}

export function assessRecall(
  notice: RecallNotice | null,
  batch: RecallBatchIdentity,
  now: string,
  maxAgeHours = 48
): RecallAssessment {
  if (!notice) return {
    kind: "source_unavailable",
    blocksConsumption: false,
    stale: true,
    wording: "Rückrufquelle nicht verfügbar. Es ist keine Aussage zur Betroffenheit oder Sicherheit möglich."
  };

  const stale = isStale(notice.retrievedAt, now, maxAgeHours);
  const source = { sourceUrl: notice.sourceUrl, stale };
  if (notice.status === "withdrawn") return {
    kind: "none",
    blocksConsumption: false,
    wording: "Die amtliche Meldung wurde zurückgenommen. Quelle und Änderungsstand prüfen.",
    ...source
  };

  const gtinMatches = Boolean(batch.gtin && notice.gtins.includes(batch.gtin));
  const lotMatches = Boolean(batch.lotNumber && notice.lotNumbers.some((lot) => canonical(lot) === canonical(batch.lotNumber ?? "")));
  if (gtinMatches && lotMatches) return {
    kind: "exact",
    blocksConsumption: true,
    wording: stale
      ? "Exakter GTIN- und Chargentreffer. Nicht verwenden; die amtliche Quelle ist zusätzlich veraltet und muss aktualisiert werden."
      : "Exakter GTIN- und Chargentreffer. Nicht verwenden und die amtlichen Hinweise öffnen.",
    ...source
  };
  if (gtinMatches) return {
    kind: "possible_gtin",
    blocksConsumption: false,
    wording: "Die GTIN ist in einer amtlichen Meldung genannt, die konkrete Charge ist nicht bestätigt. Packung und Quelle prüfen.",
    ...source
  };
  const noticeName = canonical(notice.productName);
  const batchName = canonical(batch.productName);
  if (noticeName.length >= 5 && batchName.length >= 5 && (noticeName.includes(batchName) || batchName.includes(noticeName))) return {
    kind: "text_candidate",
    blocksConsumption: false,
    wording: "Produktname ähnelt einer amtlichen Meldung. Das ist kein bestätigter Treffer; Details manuell prüfen.",
    ...source
  };
  return {
    kind: "none",
    blocksConsumption: false,
    wording: stale
      ? "Quelle ist veraltet. Kein aktueller Rückrufstatus ableitbar."
      : "In den geladenen amtlichen Daten wurde kein Treffer gefunden. Das ist keine Sicherheitsgarantie.",
    ...source
  };
}
