import { z } from "zod";

export const LEBENSMITTELWARNUNG_FEED_URL = "https://www.lebensmittelwarnung.de/___LMW-Redaktion/RSSNewsfeed/Functions/RssFeeds/rssnewsfeed_Alle_DE.xml";
export const LEBENSMITTELWARNUNG_SOURCE_KEY = "de-lebensmittelwarnung-rss";
export const LEBENSMITTELWARNUNG_PARSER_VERSION = "lmw-rss-detail-1";

const feedEntrySchema = z.object({
  title: z.string().min(1).max(500),
  link: z.url(),
  pubDate: z.iso.datetime(),
  description: z.string().max(100_000),
  guid: z.string().min(1).max(2_000)
});

export interface OfficialRecallRecord {
  sourceRecordId: string;
  payloadSha256: string;
  parserVersion: string;
  title: string;
  productName: string;
  gtins: string[];
  lotNumbers: string[];
  reason?: string;
  sourceUrl: string;
  publishedAt: string;
  retrievedAt: string;
  rawPayload: Record<string, unknown>;
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const hex = entity[1]?.toLowerCase() === "x";
      const point = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function tagValue(itemXml: string, tag: string): string | undefined {
  const value = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(itemXml)?.[1];
  if (!value) return undefined;
  return decodeEntities(value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim());
}

function officialDetailUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "www.lebensmittelwarnung.de" || !url.pathname.startsWith("/___lebensmittelwarnung.de/Meldungen/")) {
    throw new Error("Recall detail URL is outside the approved authority origin");
  }
  url.hash = "";
  return url.toString();
}

function stripMarkup(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

function descriptionField(description: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const value = new RegExp(`<b>\\s*${escaped}:?\\s*</b>([\\s\\S]*?)(?:<br\\s*/?>|$)`, "i").exec(description)?.[1];
  return value ? stripMarkup(value) : undefined;
}

function lotNumbers(description: string): string[] {
  const raw = descriptionField(description, "Chargennummer / Los-Kennzeichnung");
  if (!raw) return [];
  return [...new Set(raw.split(/[,;\n]/)
    .map((value) => value.replace(/^(?:charg(?:e|ennummer)|los(?:-kennzeichnung)?)\s*:?\s*/i, "").trim())
    .filter((value) => value.length > 0 && value.length <= 120))];
}

function gtins(description: string, detailHtml: string): string[] {
  const text = stripMarkup(`${description} ${detailHtml}`);
  return [...text.matchAll(/(?:GTIN|EAN(?:-Nummer)?|Barcode(?:\s*\(EAN-Nummer\))?)[^0-9]{0,32}([0-9]{8,14})/gi)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value));
}

export function parseRecallFeed(xml: string) {
  if (xml.length > 2_000_000 || !/<rss\b/i.test(xml)) throw new Error("Unexpected recall feed document");
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 60);
  return items.map((match) => {
    const item = match[1] ?? "";
    const published = new Date(tagValue(item, "pubDate") ?? "");
    return feedEntrySchema.parse({
      title: stripMarkup(tagValue(item, "title") ?? ""),
      link: officialDetailUrl(tagValue(item, "link") ?? ""),
      pubDate: published.toISOString(),
      description: tagValue(item, "description") ?? "",
      guid: tagValue(item, "guid") ?? tagValue(item, "link") ?? ""
    });
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function parseRecallDetail(
  entry: z.infer<typeof feedEntrySchema>,
  detailHtml: string,
  retrievedAt = new Date().toISOString()
): Promise<OfficialRecallRecord | null> {
  if (detailHtml.length > 750_000) throw new Error("Recall detail exceeds size limit");
  if (!/lmw-producttype--groceries/.test(detailHtml) || !/>\s*Lebensmittel\s*</i.test(detailHtml)) return null;
  const rawPayload = {
    feed: entry,
    detail_html: detailHtml
  };
  const payloadJson = JSON.stringify(rawPayload);
  return {
    sourceRecordId: entry.guid,
    payloadSha256: await sha256(payloadJson),
    parserVersion: LEBENSMITTELWARNUNG_PARSER_VERSION,
    title: entry.title,
    productName: descriptionField(entry.description, "Produktbezeichnung/ -beschreibung") ?? entry.title,
    gtins: [...new Set(gtins(entry.description, detailHtml))],
    lotNumbers: lotNumbers(entry.description),
    reason: descriptionField(entry.description, "Grund der Meldung"),
    sourceUrl: officialDetailUrl(entry.link),
    publishedAt: entry.pubDate,
    retrievedAt,
    rawPayload
  };
}

async function responseText(response: Response, label: string, maxBytes: number): Promise<string> {
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > maxBytes) throw new Error(`${label} exceeds size limit`);
  return text;
}

export async function fetchOfficialRecallRecords(fetcher: typeof fetch = fetch): Promise<OfficialRecallRecord[]> {
  const headers = { Accept: "application/rss+xml, application/xml;q=0.9", "User-Agent": process.env.RECALL_USER_AGENT ?? "FoodOS/0.1 recall ingestion" };
  const feedResponse = await fetcher(LEBENSMITTELWARNUNG_FEED_URL, {
    headers,
    signal: AbortSignal.timeout(10_000),
    cache: "no-store"
  });
  const entries = parseRecallFeed(await responseText(feedResponse, "Recall feed", 2_000_000));
  const records: OfficialRecallRecord[] = [];
  for (let offset = 0; offset < entries.length; offset += 4) {
    const chunk = entries.slice(offset, offset + 4);
    const parsed = await Promise.all(chunk.map(async (entry) => {
      const detailResponse = await fetcher(officialDetailUrl(entry.link), {
        headers,
        signal: AbortSignal.timeout(10_000),
        cache: "no-store"
      });
      const detail = await responseText(detailResponse, "Recall detail", 750_000);
      return parseRecallDetail(entry, detail);
    }));
    records.push(...parsed.filter((record): record is OfficialRecallRecord => record !== null));
  }
  return records;
}
