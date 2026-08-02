import { describe, expect, it } from "vitest";
import { parseRecallDetail, parseRecallFeed } from "./lebensmittelwarnung";

const feed = `<?xml version="1.0"?><rss version="2.0"><channel><item>
  <title>K&#246;lln Testprodukt</title>
  <link>https://www.lebensmittelwarnung.de/___lebensmittelwarnung.de/Meldungen/2026/07_Juli/test/test.html</link>
  <pubDate>Fri, 31 Jul 2026 13:15:00 +0200</pubDate>
  <description><![CDATA[<b>Chargennummer / Los-Kennzeichnung:</b> Charge: L6165, L6164<br/><b>Grund der Meldung:</b> Fremdkörper<br/><b>Produktbezeichnung/ -beschreibung:</b> Kölln Testprodukt 375 Gramm<br/>]]></description>
  <guid>authority-record-1</guid>
</item></channel></rss>`;

describe("official lebensmittelwarnung.de adapter", () => {
  it("keeps immutable source fields and extracts exact identifiers", async () => {
    const [entry] = parseRecallFeed(feed);
    const result = await parseRecallDetail(entry!, `
      <div class="lmw-producttype--groceries"><span>Lebensmittel</span></div>
      <dt>Weitere Kennzeichnung:</dt><dd>Barcode (EAN-Nummer): 4006381333931</dd>
    `, "2026-08-02T20:00:00.000Z");

    expect(result).toMatchObject({
      sourceRecordId: "authority-record-1",
      productName: "Kölln Testprodukt 375 Gramm",
      gtins: ["4006381333931"],
      lotNumbers: ["L6165", "L6164"],
      reason: "Fremdkörper",
      retrievedAt: "2026-08-02T20:00:00.000Z"
    });
    expect(result?.payloadSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result?.rawPayload).toHaveProperty("detail_html");
  });

  it("does not ingest non-food product types", async () => {
    const [entry] = parseRecallFeed(feed);
    await expect(parseRecallDetail(entry!, '<div class="lmw-producttype--cosmetics">Kosmetische Mittel</div>')).resolves.toBeNull();
  });

  it("rejects links outside the fixed authority origin", () => {
    expect(() => parseRecallFeed(feed.replace("https://www.lebensmittelwarnung.de/", "https://example.test/"))).toThrow(/approved authority origin/);
  });
});
