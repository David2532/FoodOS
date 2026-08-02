import { describe, expect, it } from "vitest";
import { assessRecall, type RecallNotice } from "./recall";

const notice: RecallNotice = {
  sourceRecordId: "official-42",
  status: "active",
  productName: "Bio Nussriegel",
  gtins: ["3017624010701"],
  lotNumbers: ["LOT-42"],
  sourceUrl: "https://www.lebensmittelwarnung.de/",
  publishedAt: "2026-08-01T08:00:00Z",
  retrievedAt: "2026-08-02T08:00:00Z"
};

describe("C0 recall assessment", () => {
  it("blocks only an exact active GTIN and lot match", () => {
    expect(assessRecall(notice, { gtin: "3017624010701", lotNumber: "lot 42", productName: "other" }, "2026-08-02T10:00:00Z")).toMatchObject({ kind: "exact", blocksConsumption: true, stale: false });
  });

  it("keeps GTIN-only and text candidates explicitly uncertain", () => {
    expect(assessRecall(notice, { gtin: "3017624010701", lotNumber: "OTHER", productName: "other" }, "2026-08-02T10:00:00Z")).toMatchObject({ kind: "possible_gtin", blocksConsumption: false });
    expect(assessRecall(notice, { productName: "Bio Nussriegel 50 g" }, "2026-08-02T10:00:00Z")).toMatchObject({ kind: "text_candidate", blocksConsumption: false });
  });

  it("never translates an outage or stale non-match into safe", () => {
    expect(assessRecall(null, { productName: "Produkt" }, "2026-08-02T10:00:00Z")).toMatchObject({ kind: "source_unavailable", stale: true });
    const stale = assessRecall({ ...notice, gtins: [], lotNumbers: [], productName: "anderes Produkt", retrievedAt: "2026-07-01T00:00:00Z" }, { productName: "Müsli" }, "2026-08-02T10:00:00Z");
    expect(stale).toMatchObject({ kind: "none", stale: true });
    expect(stale.wording).not.toMatch(/sicher/i);
  });

  it("preserves a historical correction without silently calling the product safe", () => {
    const withdrawn = assessRecall({ ...notice, status: "withdrawn" }, { gtin: "3017624010701", lotNumber: "LOT-42", productName: "Bio Nussriegel" }, "2026-08-02T10:00:00Z");
    expect(withdrawn).toMatchObject({ kind: "none", blocksConsumption: false });
    expect(withdrawn.wording).toMatch(/zurückgenommen/i);
  });
});
