"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Camera, Check, ChevronDown, Info, Keyboard, LoaderCircle, ScanLine, ShieldCheck, X } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import type { Product, RiskLevel } from "@/lib/types";

const riskLabels: Record<RiskLevel, { label: string; icon: typeof Check }> = {
  avoid: { label: "Persönlich meiden", icon: X },
  watch: { label: "Aufnahme beachten", icon: AlertTriangle },
  info: { label: "Hinweis", icon: Info },
  ok: { label: "Kein besonderer Hinweis", icon: ShieldCheck },
  unknown: { label: "Daten unbekannt", icon: Info }
};

export function ScanView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => controlsRef.current?.stop(), []);

  async function lookup(code: string) {
    if (!/^\d{8,14}$/.test(code)) {
      setError("Bitte gib einen gültigen EAN-/UPC-Code mit 8–14 Ziffern ein.");
      return;
    }
    setLoading(true);
    setError(null);
    controlsRef.current?.stop();
    setCameraActive(false);
    try {
      const response = await fetch(`/api/products/${code}`);
      const body = (await response.json()) as { product?: Product; error?: string };
      if (!response.ok || !body.product) throw new Error(body.error ?? "Produkt nicht gefunden.");
      setProduct(body.product);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Produkt konnte nicht geladen werden.");
    } finally {
      setLoading(false);
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

  if (product) return <ProductResult product={product} onReset={() => { setProduct(null); setBarcode(""); }} />;

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
            <p>Wir lesen danach Produktdaten, Zutaten und das MHD aus.</p>
            <button className="primary-button" onClick={startCamera}><Camera size={18} /> Kamera starten</button>
          </div>
        )}
        {cameraActive && <div className="camera-hint"><span className="status-pulse" />Barcode ruhig in den Rahmen halten</div>}
      </section>

      <div className="scan-divider"><span>oder manuell</span></div>
      <form className="barcode-form" onSubmit={(event) => { event.preventDefault(); void lookup(barcode); }}>
        <label><Keyboard size={18} /><input inputMode="numeric" autoComplete="off" value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ""))} placeholder="EAN / UPC eingeben" /></label>
        <button disabled={loading}>{loading ? <LoaderCircle className="spin" size={19} /> : "Prüfen"}</button>
      </form>
      {error && <div className="error-banner"><AlertTriangle size={17} /><span>{error}</span></div>}

      <section className="scan-steps">
        <p>WAS FOODOS DANACH MACHT</p>
        <div><span>1</span><strong>Produkt & Zutaten</strong><small>Alle verfügbaren Metadaten</small></div>
        <div><span>2</span><strong>MHD & Charge</strong><small>Automatischer zweiter Kamerablick</small></div>
        <div><span>3</span><strong>Vorrat</strong><small>Menge und Lagerort bestätigen</small></div>
      </section>
    </div>
  );
}

function ProductResult({ product, onReset }: { product: Product; onReset: () => void }) {
  const [showIngredients, setShowIngredients] = useState(false);
  const topAssessments = product.assessments.slice(0, 4);

  return (
    <div className="product-result page-enter">
      <button className="reset-scan" onClick={onReset}><ScanLine size={17} /> Anderes Produkt</button>
      <section className="product-hero">
        <div className="product-image">{product.imageUrl ? <Image src={product.imageUrl} alt={product.name} width={144} height={144} unoptimized /> : <span>🥫</span>}</div>
        <div><p>{product.brand ?? "Unbekannte Marke"}</p><h2>{product.name}</h2><span>{product.quantity ?? product.barcode}</span></div>
        <i className="confidence-badge"><Check size={12} />{Math.round(product.confidence * 100)} %</i>
      </section>

      <button className="mhd-prompt">
        <span><Camera size={20} /></span>
        <div><p>NÄCHSTER SCHRITT</p><strong>MHD & Charge fotografieren</strong><small>Bei normalem EAN nicht im Code enthalten</small></div>
        <ChevronDown size={18} />
      </button>

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

      <button className="primary-button wide"><Check size={18} /> Menge & Lagerort bestätigen</button>
    </div>
  );
}
