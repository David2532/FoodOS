"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { AlertTriangle, Camera, Check, ChevronDown, Info, Keyboard, LoaderCircle, ScanLine, ShieldCheck, X } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import type { Product, RiskLevel } from "@/lib/types";
import { productApiResponseSchema } from "@/contracts/product";
import { addBatchResultSchema, inventoryBatchInputSchema } from "@/contracts/inventory";
import { hasValidGtinCheckDigit, parseGs1, type Gs1Elements } from "@/domain/gs1";
import { submitDurableRpc } from "@/infrastructure/offline-outbox";
import { ProductCatalogSearch } from "@/features/catalog/product-catalog-search";

const riskLabels: Record<RiskLevel, { label: string; icon: typeof Check }> = {
  avoid: { label: "Persönlich meiden", icon: X },
  watch: { label: "Aufnahme beachten", icon: AlertTriangle },
  info: { label: "Hinweis", icon: Info },
  ok: { label: "Kein besonderer Hinweis", icon: ShieldCheck },
  unknown: { label: "Daten unbekannt", icon: Info }
};

export function ScanView({ householdId, initialCatalogQuery, onSaved, preview = false }: { householdId?: string; initialCatalogQuery?: string; onSaved?: () => void; preview?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lookupInFlightRef = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gs1, setGs1] = useState<Gs1Elements | null>(null);
  const [manualEntry, setManualEntry] = useState<{ barcode: string; reason: "not-found" | "unavailable" } | null>(null);
  const [globalCatalogStatus, setGlobalCatalogStatus] = useState<"live" | "unavailable" | "not-configured">("not-configured");

  useEffect(() => () => controlsRef.current?.stop(), []);

  async function lookup(code: string) {
    if (lookupInFlightRef.current) return;
    const trimmed = code.trim();
    let gtin = trimmed;
    let parsedGs1: Gs1Elements | null = null;
    if (!/^\d{8,14}$/.test(trimmed)) {
      const parsed = parseGs1(trimmed);
      if (!parsed.ok || !parsed.value.gtin) {
        setError(parsed.ok ? "Der GS1-Code enthält keine GTIN (AI 01)." : parsed.error.message);
        return;
      }
      gtin = parsed.value.gtin;
      parsedGs1 = parsed.value;
    }
    if (!hasValidGtinCheckDigit(gtin)) {
      setError("Die Prüfziffer des EAN-/UPC-/GTIN-Codes ist ungültig.");
      return;
    }
    lookupInFlightRef.current = true;
    setLoading(true);
    setError(null);
    setManualEntry(null);
    controlsRef.current?.stop();
    setCameraActive(false);
    try {
      const response = await fetch(`/api/products/${gtin}${preview ? "?preview=1" : ""}`);
      const body: unknown = await response.json();
      if (response.status === 404 || response.status === 429 || response.status >= 500) {
        setManualEntry({ barcode: gtin, reason: response.status === 404 ? "not-found" : "unavailable" });
        setGs1(parsedGs1);
        return;
      }
      if (!response.ok) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "Produkt nicht gefunden.";
        throw new Error(message);
      }
      const parsed = productApiResponseSchema.safeParse(body);
      if (!parsed.success) throw new Error("Die Produktquelle hat unerwartete Daten geliefert.");
      setProduct(parsed.data.product);
      setGlobalCatalogStatus(parsed.data.globalCatalogStatus);
      setGs1(parsedGs1);
    } catch {
      setManualEntry({ barcode: gtin, reason: "unavailable" });
      setGs1(parsedGs1);
    } finally {
      setLoading(false);
      lookupInFlightRef.current = false;
    }
  }

  async function startCamera() {
    setProduct(null);
    setError(null);
    setCameraActive(true);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      if (!videoRef.current) return;
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (!result) return;
        const value = result.getText();
        setBarcode(value);
        void lookup(value);
      });
    } catch {
      setCameraActive(false);
      setError("Kamera konnte nicht gestartet werden. Prüfe die Browserfreigabe oder gib den Barcode manuell ein.");
    }
  }

  if (product) return <ProductResult product={product} globalCatalogStatus={globalCatalogStatus} householdId={householdId} gs1={gs1} onSaved={onSaved} onReset={() => { setProduct(null); setBarcode(""); setGs1(null); setManualEntry(null); setGlobalCatalogStatus("not-configured"); }} />;
  if (manualEntry) return <ManualProductEntry barcode={manualEntry.barcode} reason={manualEntry.reason} onCancel={() => setManualEntry(null)} onConfirm={(manualProduct) => setProduct(manualProduct)} />;

  return (
    <div className="scan-page page-enter">
      <section className={`scanner-stage ${cameraActive ? "is-live" : ""}`}>
        <video ref={videoRef} muted playsInline />
        <div className="scanner-overlay">
          <div className="scan-corner top-left" /><div className="scan-corner top-right" />
          <div className="scan-corner bottom-left" /><div className="scan-corner bottom-right" />
          {cameraActive && <div className="scan-beam" />}
        </div>
        {!cameraActive && (
          <div className="scanner-empty">
            <span><ScanLine size={34} /></span>
            <h2>Produktcode erfassen</h2>
            <p>Wir laden Produktdaten und fragen das Datum der konkreten Packung getrennt ab.</p>
            <button className="primary-button" onClick={startCamera}><Camera size={18} /> Kamera starten</button>
          </div>
        )}
        {cameraActive && <div className="camera-hint"><span className="status-pulse" />Barcode ruhig in den Rahmen halten</div>}
      </section>

      <div className="scan-divider"><span>oder manuell</span></div>
      <form className="barcode-form" onSubmit={(event) => { event.preventDefault(); void lookup(barcode); }}>
        <label><span className="sr-only">EAN, UPC oder GS1-Code</span><Keyboard size={18} /><input inputMode="text" autoComplete="off" value={barcode} onChange={(event) => setBarcode(event.target.value)} maxLength={120} placeholder="EAN / UPC / GS1 eingeben" /></label>
        <button disabled={loading}>{loading ? <LoaderCircle className="spin" size={19} /> : "Prüfen"}</button>
      </form>
      {error && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}

      <ProductCatalogSearch
        initialQuery={initialCatalogQuery}
        preview={preview}
        selectingBarcode={loading ? barcode : undefined}
        onSelect={(selectedBarcode) => {
          setBarcode(selectedBarcode);
          void lookup(selectedBarcode);
        }}
      />

      <section className="scan-steps">
        <p>WAS FOODOS DANACH MACHT</p>
        <div><span>1</span><strong>Produkt & Zutaten</strong><small>Alle verfügbaren Metadaten</small></div>
        <div><span>2</span><strong>MHD & Charge</strong><small>Packungsdatum manuell bestätigen</small></div>
        <div><span>3</span><strong>Vorrat</strong><small>Menge und Lagerort bestätigen</small></div>
      </section>
    </div>
  );
}

function ManualProductEntry({ barcode, reason, onCancel, onConfirm }: { barcode: string; reason: "not-found" | "unavailable"; onCancel: () => void; onConfirm: (product: Product) => void }) {
  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const brand = String(form.get("brand") ?? "").trim();
    if (!name) return;
    onConfirm({
      barcode,
      name,
      brand: brand || undefined,
      categories: [],
      countries: [],
      structuredIngredients: [],
      allergens: [],
      traces: [],
      additives: [],
      labels: [],
      nutrition: {},
      assessments: [],
      source: "manual",
      retrievedAt: new Date().toISOString(),
      confidence: 1
    });
  }

  return <div className="product-result page-enter">
    <button className="reset-scan" onClick={onCancel}><ScanLine size={17} /> Anderen Code prüfen</button>
    <section className="empty-state" aria-labelledby="manual-product-title">
      <Keyboard size={25} />
      <h2 id="manual-product-title">{reason === "not-found" ? "Produkt noch nicht im Katalog" : "Produktquelle gerade nicht erreichbar"}</h2>
      <p>{reason === "not-found"
        ? `Der Code ${barcode} wurde in den verfügbaren Katalogquellen nicht gefunden. Lege das Produkt mit einem bestätigten Namen an; fehlende Angaben bleiben sichtbar unbekannt.`
        : "Du kannst das Produkt jetzt manuell erfassen. FoodOS ergänzt keine unbekannten Zutaten, Nährwerte oder Haltbarkeitsdaten."}</p>
    </section>
    {reason === "unavailable" && <div className="safety-banner" role="alert"><AlertTriangle size={17} /><span>Die Suche konnte nicht abgeschlossen werden. Der manuelle Eintrag wird erst mit deinen bestätigten Angaben gespeichert.</span></div>}
    <form className="batch-form" onSubmit={confirm}>
      <label className="field-label"><span>Produktname</span><input name="name" minLength={1} maxLength={240} autoFocus required /></label>
      <label className="field-label"><span>Marke · optional</span><input name="brand" maxLength={160} /></label>
      <button className="primary-button wide"><Check size={18} /> Produktdaten bestätigen</button>
    </form>
  </div>;
}

function ProductResult({ product, globalCatalogStatus, householdId, gs1, onReset, onSaved }: { product: Product; globalCatalogStatus: "live" | "unavailable" | "not-configured"; householdId?: string; gs1: Gs1Elements | null; onReset: () => void; onSaved?: () => void }) {
  const [showIngredients, setShowIngredients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dateKind, setDateKind] = useState<"best_before" | "use_by" | "none">(gs1?.useByDate ? "use_by" : gs1?.bestBeforeDate ? "best_before" : "none");
  const mutationId = useRef<string>(crypto.randomUUID());
  const topAssessments = product.assessments.slice(0, 4);
  const requiresPersonalRiskConfirmation = product.assessments.some((assessment) => assessment.level === "avoid");

  async function saveBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!householdId) return;
    setSaveError(null);
    const form = new FormData(event.currentTarget);
    const price = String(form.get("purchasePrice") ?? "").trim().replace(",", ".");
    const personalRiskConfirmed = form.get("personalRiskConfirmed") === "yes";
    const parsed = inventoryBatchInputSchema.safeParse({
      amount: form.get("amount"),
      unit: form.get("unit"),
      location: form.get("location"),
      dateKind,
      date: dateKind === "none" ? "" : form.get("date"),
      lotNumber: form.get("lotNumber"),
      serialNumber: gs1?.serialNumber,
      purchasePriceCents: price ? Math.round(Number(price) * 100) : undefined
    });
    if (!parsed.success) {
      setSaveError(parsed.error.issues[0]?.message ?? "Prüfe Menge, Datum und Lagerort.");
      return;
    }

    setSaving(true);
    const args = {
      target_household: householdId,
      product_payload: product,
      batch_payload: {
        amount: parsed.data.amount,
        unit: parsed.data.unit,
        location: parsed.data.location,
        best_before_date: parsed.data.dateKind === "best_before" ? parsed.data.date : null,
        use_by_date: parsed.data.dateKind === "use_by" ? parsed.data.date : null,
        lot_number: parsed.data.lotNumber || null,
        serial_number: parsed.data.serialNumber || null,
        purchase_price_cents: parsed.data.purchasePriceCents ?? null,
        date_source: gs1 ? "gs1_confirmed" : "manual_confirmed",
        personal_risk_confirmed: personalRiskConfirmed
      },
      mutation_id: mutationId.current
    };
    try {
      const result = await submitDurableRpc<unknown>({
        kind: "inventory.add_batch",
        rpc: "add_inventory_batch",
        args,
        householdId,
        operationId: mutationId.current
      });
      setSaving(false);
      if (result.status === "queued") {
        setSaveError("Auf diesem Gerät verschlüsselt gespeichert. Die Charge erscheint nach sicherer Serversynchronisierung im gemeinsamen Vorrat.");
        return;
      }
      if (result.status === "rejected" || !addBatchResultSchema.safeParse(result.data).success) {
        setSaveError(result.status === "rejected" ? result.message : "Der Server hat ein unerwartetes Ergebnis geliefert.");
        return;
      }
      onSaved?.();
    } catch {
      setSaving(false);
      setSaveError("Die Änderung konnte weder lokal sicher gespeichert noch vom Server bestätigt werden.");
    }
  }

  return (
    <div className="product-result page-enter">
      <button className="reset-scan" onClick={onReset}><ScanLine size={17} /> Anderes Produkt</button>
      <section className="product-hero">
        <div className="product-image">{product.imageUrl ? <Image src={product.imageUrl} alt={product.name} width={144} height={144} unoptimized /> : <span>🥫</span>}</div>
        <div>
          <p>{product.brand ?? "Unbekannte Marke"}</p>
          <h2>{product.name}</h2>
          <span>{product.quantity ?? product.barcode}</span>
          <small className="product-provenance">
            <ShieldCheck size={12} />
            {product.source === "open-food-facts" ? "Open Food Facts" : product.source === "global-catalog" ? "FoodOS-Katalog" : product.source === "cache" ? "Geprüfter Haushaltscache" : "Manuell bestätigt"}
          </small>
        </div>
        <i className="confidence-badge"><Check size={12} />{Math.round(product.confidence * 100)} %</i>
      </section>

      {globalCatalogStatus === "unavailable" && product.source === "open-food-facts" && <div className="safety-banner" role="status"><AlertTriangle size={17} /><span>Der gemeinsame FoodOS-Katalog war nicht erreichbar. Dieses Ergebnis kommt direkt von Open Food Facts; Quelle und fehlende Angaben bleiben sichtbar.</span></div>}
      {product.source === "global-catalog" && (product.sourceUrl || product.databaseLicense || product.imageLicense) && <details className="product-source-details">
        <summary>Quelle, Aktualität und Lizenz</summary>
        <dl>
          {product.sourceUrl && <><dt>Quelle</dt><dd><a href={product.sourceUrl} target="_blank" rel="noreferrer">Originaldatensatz öffnen</a></dd></>}
          <dt>Quelle aktualisiert</dt><dd>{product.sourceUpdatedAt ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(product.sourceUpdatedAt)) : "unbekannt"}</dd>
          <dt>Aktualität</dt><dd>{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(product.retrievedAt))}</dd>
          {product.databaseLicense && <><dt>Datenbank</dt><dd>{product.databaseLicense}</dd></>}
          {product.imageLicense && <><dt>Bild</dt><dd>{product.imageLicense}</dd></>}
        </dl>
      </details>}

      <form className="batch-form" onSubmit={saveBatch}>
        <div className="batch-form-heading"><span><Camera size={20} /></span><div><p>PACKUNG BESTÄTIGEN</p><strong>MHD/Verbrauchsdatum und Charge</strong><small>{gs1 ? "Aus GS1 erkannt – vor dem Speichern prüfen" : "Bei normalem EAN manuell von der Packung übernehmen"}</small></div></div>
        <fieldset><legend>Art des Datums</legend><label><input type="radio" name="dateKind" checked={dateKind === "best_before"} onChange={() => setDateKind("best_before")} /> MHD</label><label><input type="radio" name="dateKind" checked={dateKind === "use_by"} onChange={() => setDateKind("use_by")} /> Verbrauchsdatum</label><label><input type="radio" name="dateKind" checked={dateKind === "none"} onChange={() => setDateKind("none")} /> Kein Datum</label></fieldset>
        {dateKind !== "none" && <label className="field-label"><span>{dateKind === "use_by" ? "Zu verbrauchen bis" : "Mindestens haltbar bis"}</span><input name="date" type="date" defaultValue={gs1?.useByDate ?? gs1?.bestBeforeDate ?? ""} required /></label>}
        <div className="batch-grid"><label className="field-label"><span>Menge</span><input name="amount" type="number" inputMode="decimal" min="0.001" step="0.001" defaultValue="1" required /></label><label className="field-label"><span>Einheit</span><select name="unit" defaultValue="piece"><option value="piece">Stück</option><option value="g">g</option><option value="ml">ml</option></select></label></div>
        <label className="field-label"><span>Lagerort</span><select name="location" defaultValue="pantry"><option value="fridge">Kühlschrank</option><option value="freezer">Gefrierfach</option><option value="pantry">Vorrat</option><option value="drinks">Getränke</option><option value="other">Sonstiges</option></select></label>
        <div className="batch-grid"><label className="field-label"><span>Charge · optional</span><input name="lotNumber" defaultValue={gs1?.lotNumber ?? ""} maxLength={120} /></label><label className="field-label"><span>Kaufpreis € · optional</span><input name="purchasePrice" inputMode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" /></label></div>
        {requiresPersonalRiskConfirmation && <label className="risk-confirmation"><input type="checkbox" name="personalRiskConfirmed" value="yes" required /><span><strong>Persönlichen Konflikt ausdrücklich bestätigen</strong><small>Dieses Produkt passt zu einem hinterlegten Allergen oder Ausschluss. Prüfe die vollständige Packungskennzeichnung; FoodOS ersetzt keine medizinische Beratung.</small></span></label>}
        {saveError && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span>{saveError}</span></div>}
        {householdId ? <button className="primary-button wide" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}{saving ? "Charge wird gespeichert …" : "Charge zum Vorrat hinzufügen"}</button> : <p className="preview-save-note">Preview-Modus: Produktdaten können geprüft, aber nicht dauerhaft gespeichert werden.</p>}
      </form>

      <section className="nutrition-strip">
        <div><strong>{product.nutrition.kcal100g ?? "–"}</strong><span>kcal</span></div>
        <div><strong>{product.nutrition.protein100g ?? "–"} g</strong><span>Protein</span></div>
        <div><strong>{product.nutrition.sugar100g ?? "–"} g</strong><span>Zucker</span></div>
        <div><strong>{product.nutrition.salt100g ?? "–"} g</strong><span>Salz</span></div>
      </section>

      <section className="assessment-card">
        <div className="section-heading"><div><p>INHALTSSTOFF-CHECK</p><h2>{topAssessments.length ? `${topAssessments.length} Hinweise gefunden` : "Keine besonderen Hinweise"}</h2></div><span className="evidence-pill"><ShieldCheck size={14} /> Quellenbasiert</span></div>
        <div className="assessment-list">
          {topAssessments.length ? topAssessments.map((assessment, index) => {
            const meta = riskLabels[assessment.level];
            const Icon = meta.icon;
            return <article className={`assessment-row ${assessment.level}`} key={`${assessment.name}-${index}`}><span><Icon size={17} /></span><div><p>{meta.label}</p><strong>{assessment.name}</strong><small>{assessment.reason}</small></div></article>;
          }) : <div className="empty-assessment"><ShieldCheck size={24} /><span><strong>Keine auffälligen Daten</strong><small>Das ist keine Gesundheitsgarantie. Fehlende Mengen bleiben unbekannt.</small></span></div>}
        </div>
        {product.ingredientsText && <button className="ingredients-toggle" onClick={() => setShowIngredients((value) => !value)}>Vollständige Zutatenliste <ChevronDown size={17} className={showIngredients ? "rotate" : ""} /></button>}
        {showIngredients && <p className="ingredients-text">{product.ingredientsText}</p>}
      </section>

    </div>
  );
}
