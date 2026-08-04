"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Database, LoaderCircle, PackageSearch, Search, ShieldCheck, WifiOff } from "lucide-react";
import { catalogSearchResponseSchema, type CatalogSearchItem, type CatalogSearchResponse } from "@/contracts/catalog";

const suggestions = ["Haferflocken", "Naturjoghurt", "Vollkornbrot"];

export function ProductCatalogSearch({ onSelect, selectingBarcode }: {
  onSelect: (barcode: string) => void;
  selectingBarcode?: string;
}) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<CatalogSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function searchCatalog(searchQuery: string, page: number, append: boolean) {
    const normalized = searchQuery.trim();
    if (normalized.length < 2) {
      setError("Gib mindestens zwei Zeichen ein.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await fetch(`/api/products/search?q=${encodeURIComponent(normalized)}&page=${page}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      const body: unknown = await result.json();
      if (!result.ok) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "Die Lebensmittelsuche ist gerade nicht erreichbar.";
        throw new Error(message);
      }
      const parsed = catalogSearchResponseSchema.safeParse(body);
      if (!parsed.success) throw new Error("Der Lebensmittelkatalog hat unerwartete Daten geliefert.");
      setQuery(parsed.data.query);
      setResponse((current) => append && current
        ? { ...parsed.data, results: deduplicate([...current.results, ...parsed.data.results]) }
        : parsed.data);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Die Lebensmittelsuche ist gerade nicht erreichbar.");
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void searchCatalog(query, 1, false);
  }

  function selectSuggestion(value: string) {
    setQuery(value);
    void searchCatalog(value, 1, false);
  }

  return (
    <section className="catalog-card" aria-labelledby="catalog-title">
      <div className="catalog-heading">
        <span className="catalog-icon"><Database size={24} /></span>
        <div>
          <p>REALER LEBENSMITTELKATALOG</p>
          <h2 id="catalog-title">Produkt statt Barcode suchen</h2>
          <span>Weltweiter offener Katalog plus dein geprüfter Haushaltscache.</span>
        </div>
        <em><span className="status-pulse" /> Live</em>
      </div>

      <form className="catalog-search-form" onSubmit={submit} role="search">
        <label>
          <span className="sr-only">Produkt oder Marke suchen</span>
          <Search size={19} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            minLength={2}
            maxLength={80}
            autoComplete="off"
            placeholder="z. B. Haferflocken oder dmBio"
          />
        </label>
        <button disabled={loading} aria-label="Lebensmittel suchen">
          {loading ? <LoaderCircle className="spin" size={19} /> : <ArrowRight size={19} />}
        </button>
      </form>

      {!response && !loading && <div className="catalog-suggestions" aria-label="Schnellsuchen">
        {suggestions.map((suggestion) => <button key={suggestion} onClick={() => selectSuggestion(suggestion)}>{suggestion}</button>)}
      </div>}

      <p className="catalog-privacy"><ShieldCheck size={14} /> Erst beim Absenden geht nur der Suchbegriff an Open Food Facts – nie an Werbung oder Analytics.</p>

      {error && <div className="error-banner" role="alert"><WifiOff size={17} /><span>{error}</span></div>}
      {loading && <div className="catalog-skeletons" aria-label="Lebensmittel werden gesucht" aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
      </div>}

      {response && !loading && <CatalogResults
        response={response}
        selectingBarcode={selectingBarcode}
        loadingMore={loadingMore}
        onSelect={onSelect}
        onMore={() => void searchCatalog(response.query, response.page + 1, true)}
      />}
    </section>
  );
}

function deduplicate(items: CatalogSearchItem[]): CatalogSearchItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.barcode)) return false;
    seen.add(item.barcode);
    return true;
  });
}

function CatalogResults({ response, selectingBarcode, loadingMore, onSelect, onMore }: {
  response: CatalogSearchResponse;
  selectingBarcode?: string;
  loadingMore: boolean;
  onSelect: (barcode: string) => void;
  onMore: () => void;
}) {
  const formattedCount = new Intl.NumberFormat("de-DE").format(response.providerCount);
  return <div className="catalog-results-wrap">
    <div className="catalog-result-meta" aria-live="polite">
      <span><strong>{response.providerCountExact ? formattedCount : `mind. ${formattedCount}`}</strong> Treffer im offenen Katalog</span>
      {response.cachedCount > 0 && <span>{response.cachedCount} aus deinem Haushalt zuerst</span>}
    </div>
    {response.providerStatus === "unavailable" && <div className="safety-banner" role="status"><WifiOff size={17} /><span>Open Food Facts ist gerade nicht erreichbar. Gezeigt werden nur bereits geprüfte Haushaltsprodukte.</span></div>}
    {response.results.length ? <div className="catalog-results">
      {response.results.map((item, index) => <article className="catalog-result" key={item.barcode}>
        <CatalogProductImage item={item} eager={index < 4} />
        <div className="catalog-product-copy">
          <div className="catalog-source-line">
            <span>{item.source === "household-cache" ? "Dein Haushalt" : "Open Food Facts"}</span>
            {item.nutriScore && <em className={`nutri-score grade-${item.nutriScore}`} aria-label={`Nutri-Score ${item.nutriScore.toUpperCase()}`}>{item.nutriScore.toUpperCase()}</em>}
          </div>
          <h3>{item.name}</h3>
          <p>{[item.brand, item.quantity].filter(Boolean).join(" · ") || "Marke und Menge nicht angegeben"}</p>
          <small>GTIN {item.barcode}</small>
        </div>
        <button onClick={() => onSelect(item.barcode)} disabled={Boolean(selectingBarcode)}>
          {selectingBarcode === item.barcode ? <LoaderCircle className="spin" size={17} /> : <><span>Prüfen</span><ArrowRight size={16} /></>}
        </button>
      </article>)}
    </div> : <div className="catalog-empty"><PackageSearch size={23} /><div><strong>Kein belastbarer Treffer</strong><span>Versuche Marke plus Produktname oder erfasse den Barcode.</span></div></div>}
    {response.hasMore && <button className="catalog-more" onClick={onMore} disabled={loadingMore}>{loadingMore ? <LoaderCircle className="spin" size={17} /> : <Database size={17} />}{loadingMore ? "Weitere Treffer werden geladen …" : "Weitere echte Produkte laden"}</button>}
  </div>;
}

function CatalogProductImage({ item, eager }: { item: CatalogSearchItem; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  return <span className={`catalog-product-image ${failed || !item.imageUrl ? "fallback" : ""}`}>
    {item.imageUrl && !failed
      ? <Image src={item.imageUrl} alt="" width={72} height={72} loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)} unoptimized />
      : <PackageSearch size={25} />}
  </span>;
}
