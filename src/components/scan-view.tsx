"use client";

import Image from "next/image";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronRight,
  ImageOff,
  Keyboard,
  LoaderCircle,
  Minus,
  PackageCheck,
  Plus,
  ScanLine,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { IScannerControls } from "@zxing/browser";
import { productApiResponseSchema } from "@/contracts/product";
import { purchaseCaptureItemsSchema, purchaseCaptureResultSchema, type PurchaseCaptureItem } from "@/contracts/purchase-capture";
import {
  addKnownCapture,
  addUnresolvedCapture,
  advanceCameraScanGate,
  captureExceptions,
  captureIsReady,
  CAPTURE_LIMIT_MESSAGE,
  captureNeedsReviewCard,
  captureSignature,
  captureUnitCount,
  confirmCaptureException,
  hasGs1BatchFacts,
  hasLowConfidence,
  hasPersonalRisk,
  MAX_CAPTURE_ENTRIES,
  resolveCaptureIdentity,
  updateCaptureGs1,
  updateCaptureLocation,
  updateCaptureQuantity,
  type CameraScanGate,
  type CaptureEntry,
  type CaptureLocation
} from "@/domain/capture-session";
import { hasValidGtinCheckDigit, parseGs1, type Gs1Elements } from "@/domain/gs1";
import { ProductCatalogSearch } from "@/features/catalog/product-catalog-search";
import {
  discardRejectedOperation,
  getDurableOperationStatus,
  submitDurableRpc,
  subscribeToOutbox,
  subscribeToOperationOutcome,
  type DurableMutationRejectionReason
} from "@/infrastructure/offline-outbox";
import type { Product } from "@/lib/types";

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "queued"; operationId: string }
  | { status: "acked"; operationId: string; itemCount: number }
  | { status: "uncertain"; operationId: string }
  | { status: "rejected"; message: string; reason: DurableMutationRejectionReason }
  | { status: "error"; message: string };

type CaptureNotice = { message: string; tone: "success" | "warning" };

const CAPTURE_LOCATION_OPTIONS: ReadonlyArray<{ value: CaptureLocation; label: string }> = [
  { value: "fridge", label: "Kühlschrank" },
  { value: "freezer", label: "Gefrierfach" },
  { value: "pantry", label: "Vorrat" },
  { value: "drinks", label: "Getränke" },
  { value: "other", label: "Sonstiges" }
];
function captureLocationLabel(location: CaptureLocation | null): string {
  return CAPTURE_LOCATION_OPTIONS.find((option) => option.value === location)?.label ?? "Lagerort offen";
}

interface ScanViewProps {
  householdId?: string;
  initialCatalogQuery?: string;
  onSaved?: () => void;
  onOpenInventory?: () => void;
  onOpenToday?: () => void;
  preview?: boolean;
  active?: boolean;
}

export function ScanView({
  householdId,
  initialCatalogQuery,
  onSaved,
  onOpenInventory,
  onOpenToday,
  preview = false,
  active = true
}: ScanViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const locationSelectRef = useRef<HTMLSelectElement>(null);
  const selectedLocationRef = useRef<CaptureLocation | null>(null);
  const activeRef = useRef(active);
  const cameraStartGenerationRef = useRef(0);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lookupInFlightRef = useRef(false);
  const cameraScanGateRef = useRef<CameraScanGate>({ armedCode: null, absentSince: null });
  const operationIdRef = useRef(crypto.randomUUID());
  const onSavedRef = useRef(onSaved);
  const acknowledgedQueuedOperationsRef = useRef(new Set<string>());
  const [rejectedOperationId, setRejectedOperationId] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<CaptureLocation | null>(null);
  const [entries, setEntries] = useState<CaptureEntry[]>([]);
  const [phase, setPhase] = useState<"capture" | "review" | "success">("capture");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("Bereit zum Erfassen.");
  const [lastCapture, setLastCapture] = useState<CaptureNotice | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  const exceptionEntries = useMemo(() => entries.filter((entry) => captureExceptions(entry).length > 0), [entries]);
  const reviewEntries = useMemo(() => entries.filter(captureNeedsReviewCard), [entries]);
  const unitCount = captureUnitCount(entries);
  const locked = saveState.status === "saving" || saveState.status === "queued" || saveState.status === "acked" || saveState.status === "uncertain";
  const queuedOperationId = saveState.status === "queued" ? saveState.operationId : null;

  function stopCamera() {
    cameraStartGenerationRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    cameraScanGateRef.current = { armedCode: null, absentSince: null };
    setCameraActive(false);
  }

  useEffect(() => () => {
    activeRef.current = false;
    cameraStartGenerationRef.current += 1;
    controlsRef.current?.stop();
  }, []);
  useEffect(() => {
    activeRef.current = active;
    if (active) return;
    cameraStartGenerationRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    cameraScanGateRef.current = { armedCode: null, absentSince: null };
    const update = window.setTimeout(() => setCameraActive(false), 0);
    return () => window.clearTimeout(update);
  }, [active]);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  useEffect(() => {
    if (!queuedOperationId) return;
    const operationId = queuedOperationId;
    const expectedItemCount = entries.length;
    let live = true;
    let terminal = false;
    let statusReadVersion = 0;

    function markUncertain() {
      if (!live || terminal) return;
      terminal = true;
      setSaveState({ status: "uncertain", operationId });
    }

    function markRejected(message: string, reason: DurableMutationRejectionReason) {
      if (!live || terminal) return;
      terminal = true;
      setRejectedOperationId(operationId);
      operationIdRef.current = crypto.randomUUID();
      setSaveState({ status: "rejected", message, reason });
    }

    function handleOutcome(outcome: {
      operationId: string;
      status: "acked";
      data: unknown;
    } | {
      operationId: string;
      status: "rejected";
      message: string;
      reason: DurableMutationRejectionReason;
    }) {
      if (!live || terminal || outcome.operationId !== operationId) return;
      if (outcome.status === "rejected") {
        if (outcome.reason === "acknowledgement_unknown") {
          markUncertain();
          return;
        }
        markRejected(outcome.message, outcome.reason);
        return;
      }
      const parsed = purchaseCaptureResultSchema.safeParse(outcome.data);
      if (!parsed.success || parsed.data.item_count !== expectedItemCount) {
        markUncertain();
        return;
      }
      if (acknowledgedQueuedOperationsRef.current.has(operationId)) return;
      terminal = true;
      acknowledgedQueuedOperationsRef.current.add(operationId);
      setSaveState({ status: "acked", operationId, itemCount: parsed.data.item_count });
      setPhase("success");
      onSavedRef.current?.();
    }

    async function refreshDurableStatus() {
      if (!live || terminal) return;
      const readVersion = ++statusReadVersion;
      try {
        const status = await getDurableOperationStatus(operationId);
        if (!live || terminal || readVersion !== statusReadVersion) return;
        if (status.status === "queued" || status.status === "sending") return;
        if (status.status === "rejected") {
          markRejected(
            "Die gespeicherte Änderung wurde abgelehnt. Prüfe den Einkauf und speichere ihn anschließend mit einer neuen sicheren Vorgangs-ID erneut.",
            "operation_rejected"
          );
          return;
        }
        markUncertain();
      } catch {
        if (!live || terminal || readVersion !== statusReadVersion) return;
        markUncertain();
      }
    }

    const unsubscribeOutcome = subscribeToOperationOutcome<unknown>(operationId, handleOutcome);
    const unsubscribeOutbox = subscribeToOutbox(() => void refreshDurableStatus());
    void refreshDurableStatus();

    return () => {
      live = false;
      statusReadVersion += 1;
      unsubscribeOutcome();
      unsubscribeOutbox();
    };
  }, [entries.length, queuedOperationId]);

  function changed(next: CaptureEntry[]) {
    setEntries(next);
    if (!locked) operationIdRef.current = crypto.randomUUID();
    setSaveState({ status: "idle" });
  }

  function requireCaptureLocation(): CaptureLocation | null {
    const location = selectedLocationRef.current;
    if (location) return location;
    const message = "Wähle zuerst den Lagerort für den nächsten Scan.";
    setError(message);
    setAnnouncement(message);
    locationSelectRef.current?.focus();
    return null;
  }

  function chooseCaptureLocation(location: CaptureLocation | null) {
    selectedLocationRef.current = location;
    setSelectedLocation(location);
    if (location) setError(null);
  }

  function retainUnresolved(
    gtin: string,
    parsedGs1: Gs1Elements | null,
    reason: "not-found" | "unavailable",
    location: CaptureLocation | null
  ) {
    setEntries((current) => {
      const signature = captureSignature(gtin, parsedGs1, location);
      const duplicate = current.some((entry) => entry.signature === signature);
      if (!duplicate && current.length >= MAX_CAPTURE_ENTRIES) {
        setError(CAPTURE_LIMIT_MESSAGE);
        setLastCapture({ message: CAPTURE_LIMIT_MESSAGE, tone: "warning" });
        setAnnouncement(CAPTURE_LIMIT_MESSAGE);
        return current;
      }
      return addUnresolvedCapture(current, gtin, parsedGs1, reason, crypto.randomUUID(), location);
    });
  }

  async function lookup(rawCode: string) {
    if (lookupInFlightRef.current || locked) return;
    const locationAtScan = requireCaptureLocation();
    if (!locationAtScan) return;
    const trimmed = rawCode.trim();

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
    try {
      const response = await fetch(`/api/products/${gtin}${preview ? "?preview=1" : ""}`);
      const body: unknown = await response.json();
      if (response.status === 404 || response.status === 429 || response.status >= 500) {
        const reason = response.status === 404 ? "not-found" as const : "unavailable" as const;
        retainUnresolved(gtin, parsedGs1, reason, locationAtScan);
        const text = response.status === 404 ? "Unbekanntes Produkt zur späteren Prüfung hinzugefügt." : "Produktquelle nicht erreichbar. Scan bleibt in der Unklar-Liste erhalten.";
        setLastCapture({ message: text, tone: "warning" });
        setAnnouncement(text);
        operationIdRef.current = crypto.randomUUID();
        return;
      }
      if (!response.ok) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "Produkt konnte nicht geprüft werden.";
        throw new Error(message);
      }
      const parsed = productApiResponseSchema.safeParse(body);
      if (!parsed.success) throw new Error("Die Produktquelle hat unerwartete Daten geliefert.");
      setEntries((current) => {
        const signature = captureSignature(parsed.data.product.barcode, parsedGs1, locationAtScan);
        const duplicate = current.some((entry) => entry.signature === signature);
        if (!duplicate && current.length >= MAX_CAPTURE_ENTRIES) {
          setError(CAPTURE_LIMIT_MESSAGE);
          setLastCapture({ message: CAPTURE_LIMIT_MESSAGE, tone: "warning" });
          setAnnouncement(CAPTURE_LIMIT_MESSAGE);
          return current;
        }
        const next = addKnownCapture(
          current,
          parsed.data.product,
          parsedGs1,
          crypto.randomUUID(),
          locationAtScan,
          parsed.data.globalCatalogStatus === "unavailable" && parsed.data.product.source === "open-food-facts"
        );
        const text = duplicate
          ? `${parsed.data.product.name}: Menge erhöht.`
          : `${parsed.data.product.name} erfasst.`;
        setLastCapture({ message: text, tone: "success" });
        setAnnouncement(text);
        return next;
      });
      operationIdRef.current = crypto.randomUUID();
    } catch {
      retainUnresolved(gtin, parsedGs1, "unavailable", locationAtScan);
      setLastCapture({ message: "Verbindung fehlgeschlagen. Scan bleibt in der Unklar-Liste erhalten.", tone: "warning" });
      setAnnouncement("Verbindung fehlgeschlagen. Produkt zur späteren Prüfung hinzugefügt.");
      operationIdRef.current = crypto.randomUUID();
    } finally {
      setBarcode("");
      setLoading(false);
      lookupInFlightRef.current = false;
    }
  }

  async function startCamera() {
    if (!activeRef.current || locked) return;
    if (!requireCaptureLocation()) return;
    const startGeneration = cameraStartGenerationRef.current + 1;
    cameraStartGenerationRef.current = startGeneration;
    setError(null);
    setCameraActive(true);
    cameraScanGateRef.current = { armedCode: null, absentSince: null };
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (cameraStartGenerationRef.current !== startGeneration || !activeRef.current) {
        return;
      }
      const reader = new BrowserMultiFormatReader();
      if (!videoRef.current) return;
      const controls = await reader.decodeFromConstraints({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
      }, videoRef.current, (result) => {
        if (cameraStartGenerationRef.current !== startGeneration || !activeRef.current) return;
        if (!selectedLocationRef.current) {
          cameraScanGateRef.current = { armedCode: null, absentSince: null };
          requireCaptureLocation();
          return;
        }
        const decision = advanceCameraScanGate(
          cameraScanGateRef.current,
          result?.getText() ?? null,
          Date.now(),
          350,
          !lookupInFlightRef.current
        );
        cameraScanGateRef.current = decision.gate;
        if (decision.accept && result) void lookup(result.getText());
      });
      if (cameraStartGenerationRef.current !== startGeneration || !activeRef.current) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
    } catch {
      if (cameraStartGenerationRef.current !== startGeneration || !activeRef.current) {
        return;
      }
      stopCamera();
      setError("Kamerazugriff nicht verfügbar. Erlaube die Kamera in den Browser-Einstellungen oder gib den Code manuell ein.");
    }
  }

  function finishCapture() {
    if (loading || lookupInFlightRef.current) {
      setAnnouncement("Produktprüfung läuft. Warte kurz, bevor du den Einkauf abschließt.");
      return;
    }
    stopCamera();
    setPhase("review");
    setAnnouncement(exceptionEntries.length
      ? `${exceptionEntries.length} Unklarheiten müssen vor dem Speichern geprüft werden.`
      : "Keine Unklarheiten. Einkauf kann übernommen werden.");
  }

  async function commitPurchase() {
    if (locked) return;
    if (loading || lookupInFlightRef.current) {
      setSaveState({ status: "error", message: "Produktprüfung läuft noch. Warte kurz und prüfe danach den Einkauf." });
      return;
    }
    if (preview) {
      setSaveState({ status: "acked", operationId: operationIdRef.current, itemCount: entries.length });
      setPhase("success");
      return;
    }
    if (!householdId || !captureIsReady(entries)) return;
    const captureItems = entries.map(toPurchaseCaptureItem);
    const parsedItems = purchaseCaptureItemsSchema.safeParse(captureItems);
    if (!parsedItems.success) {
      setSaveState({ status: "error", message: parsedItems.error.issues[0]?.message ?? "Prüfe die unklaren Angaben." });
      return;
    }
    const operationId = operationIdRef.current;
    setSaveState({ status: "saving" });
    try {
      const result = await submitDurableRpc<unknown>({
        kind: "inventory.commit_purchase",
        rpc: "commit_purchase_capture",
        args: { target_household: householdId, capture_items: parsedItems.data, mutation_id: operationId },
        householdId,
        operationId
      });
      if (result.status === "queued") {
        setSaveState({ status: "queued", operationId });
        if (rejectedOperationId && rejectedOperationId !== operationId) {
          void discardRejectedOperation(rejectedOperationId);
          setRejectedOperationId(null);
        }
        return;
      }
      if (result.status === "rejected") {
        if (result.reason === "acknowledgement_unknown") {
          setSaveState({ status: "uncertain", operationId });
          return;
        }
        if (result.reason === "server_rejected" || result.reason === "operation_rejected") setRejectedOperationId(operationId);
        operationIdRef.current = crypto.randomUUID();
        setSaveState({ status: "rejected", message: result.message, reason: result.reason });
        return;
      }
      const parsed = purchaseCaptureResultSchema.safeParse(result.data);
      if (!parsed.success) {
        setSaveState({ status: "error", message: "Der Server hat ein unerwartetes Ergebnis geliefert. Bitte nicht erneut speichern." });
        return;
      }
      if (rejectedOperationId && rejectedOperationId !== operationId) {
        void discardRejectedOperation(rejectedOperationId);
        setRejectedOperationId(null);
      }
      setSaveState({ status: "acked", operationId, itemCount: parsed.data.item_count });
      setPhase("success");
      onSaved?.();
    } catch {
      setSaveState({ status: "error", message: "Der Einkauf konnte weder lokal sicher gespeichert noch vom Server bestätigt werden. Die Sitzung bleibt erhalten; versuche es erneut." });
    }
  }

  function startNewPurchase() {
    setEntries([]);
    setPhase("capture");
    setSaveState({ status: "idle" });
    setLastCapture(null);
    setError(null);
    chooseCaptureLocation(null);
    operationIdRef.current = crypto.randomUUID();
  }

  if (phase === "success") {
    return <div className="capture-success page-enter" role="status">
      <span className="capture-success-icon"><PackageCheck size={30} /></span>
      <p>EINKAUF ÜBERNOMMEN</p>
      <h2>{preview ? "Preview geprüft" : `${unitCount} ${unitCount === 1 ? "Packung" : "Packungen"} im Vorrat`}</h2>
      <p>{preview ? "Im Preview-Modus wurden keine Daten gespeichert." : "Alle Produkte wurden gemeinsam und serverbestätigt gespeichert."}</p>
      <button type="button" className="primary-button wide" onClick={onOpenToday}>Was kann ich damit essen? <ChevronRight size={18} /></button>
      <button type="button" className="secondary-button wide" onClick={onOpenInventory}>Vorrat ansehen</button>
      <button type="button" className="text-button" onClick={startNewPurchase}>Neuen Einkauf erfassen</button>
    </div>;
  }

  return <div className="scan-page capture-session page-enter">
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

    <header className="capture-session-bar">
      <div><p>EINKAUF LÄUFT</p><strong>{unitCount} {unitCount === 1 ? "Packung" : "Packungen"}</strong></div>
      <div><span>{exceptionEntries.length}</span><small>unklar</small></div>
      {phase === "capture" && <button type="button" onClick={finishCapture} disabled={!entries.length || loading}>Fertig</button>}
    </header>

    {phase === "capture" ? <>
      <label className="capture-session-location">
        <span><small>NÄCHSTER SCAN</small><strong>Lagerort</strong></span>
        <select
          ref={locationSelectRef}
          aria-label="Lagerort für kommende Scans"
          value={selectedLocation ?? ""}
          onChange={(event) => chooseCaptureLocation(event.target.value ? event.target.value as CaptureLocation : null)}
          disabled={locked}
        >
          <option value="">Bitte Lagerort auswählen</option>
          {CAPTURE_LOCATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <section className={`scanner-stage capture-scanner ${cameraActive ? "is-live" : ""}`}>
        <video ref={videoRef} muted playsInline aria-hidden="true" />
        <div className="scanner-overlay" aria-hidden="true">
          <div className="scan-corner top-left" /><div className="scan-corner top-right" />
          <div className="scan-corner bottom-left" /><div className="scan-corner bottom-right" />
          {cameraActive && <div className="scan-beam" />}
        </div>
        {!cameraActive ? <div className="scanner-empty compact">
          <span><ScanLine size={30} /></span>
          <h2>Produkte nacheinander scannen</h2>
          <p>Bekannte Produkte landen sofort im Einkauf. Doppelte Scans erhöhen die Menge.</p>
          <button type="button" className="primary-button" onClick={startCamera}><Camera size={18} /> Kamera starten</button>
        </div> : <>
          <div className="camera-hint"><span className="status-pulse" />Scanner bleibt für den nächsten Artikel aktiv</div>
          <button type="button" className="camera-stop" onClick={stopCamera}>Kamera beenden</button>
        </>}
      </section>

      <form className="barcode-form" onSubmit={(event) => { event.preventDefault(); void lookup(barcode); }}>
        <label><span className="sr-only">EAN, UPC oder GS1-Code</span><Keyboard size={18} /><input inputMode="text" autoComplete="off" value={barcode} onChange={(event) => setBarcode(event.target.value)} maxLength={120} placeholder="EAN / UPC / GS1 eingeben" /></label>
        <button disabled={loading || !barcode.trim()}>{loading ? <LoaderCircle className="spin" size={19} /> : "Prüfen"}</button>
      </form>
      {error && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
      {lastCapture && <div className={`capture-last ${lastCapture.tone}`} role="status">{lastCapture.tone === "warning" ? <AlertTriangle size={17} /> : <Check size={17} />}<span>{lastCapture.message}</span></div>}

      {entries.length > 0 && <CaptureList entries={entries} onChange={changed} />}

      <ProductCatalogSearch
        initialQuery={initialCatalogQuery}
        preview={preview}
        selectingBarcode={loading ? barcode : undefined}
        onSelect={(selectedBarcode) => { setBarcode(selectedBarcode); void lookup(selectedBarcode); }}
      />
    </> : <CaptureReview
      entries={entries}
      reviewEntries={reviewEntries}
      unresolvedCount={exceptionEntries.length}
      locked={locked}
      preview={preview}
      saveState={saveState}
      onBack={() => { setPhase("capture"); setSaveState({ status: "idle" }); }}
      onChange={changed}
      onCommit={() => void commitPurchase()}
      onOpenInventory={onOpenInventory}
      onOpenToday={onOpenToday}
    />}
  </div>;
}

function CaptureList({ entries, onChange, disabled = false }: { entries: CaptureEntry[]; onChange: (entries: CaptureEntry[]) => void; disabled?: boolean }) {
  return <section className="capture-list" aria-labelledby="capture-list-title">
    <div className="capture-section-heading"><div><p>ERFASST</p><h2 id="capture-list-title">Dein aktueller Einkauf</h2></div><small>Änderbar bis Fertig</small></div>
    <ul>{entries.map((entry) => <li key={entry.itemMutationId} className={captureExceptions(entry).length ? "is-uncertain" : ""}>
      <ProductThumb entry={entry} />
      <div className="capture-item-copy">
        <strong>{entry.product?.name ?? "Unbekanntes Produkt"}</strong>
        <small>{entry.product?.brand ?? entry.barcode} · {captureLocationLabel(entry.location)}</small>
        {captureExceptions(entry).length > 0 && <span><AlertTriangle size={13} />Später prüfen</span>}
      </div>
      <QuantityControl entry={entry} onChange={onChange} entries={entries} disabled={disabled} />
    </li>)}</ul>
  </section>;
}

function CaptureReview({ entries, reviewEntries, unresolvedCount, locked, preview, saveState, onBack, onChange, onCommit, onOpenInventory, onOpenToday }: {
  entries: CaptureEntry[];
  reviewEntries: CaptureEntry[];
  unresolvedCount: number;
  locked: boolean;
  preview: boolean;
  saveState: SaveState;
  onBack: () => void;
  onChange: (entries: CaptureEntry[]) => void;
  onCommit: () => void;
  onOpenInventory?: () => void;
  onOpenToday?: () => void;
}) {
  const ready = captureIsReady(entries);
  return <section className="capture-review" aria-labelledby="capture-review-title">
    <div className="capture-review-heading">
      <p>LETZTER SCHRITT</p>
      <h2 id="capture-review-title">Nur Unklarheiten prüfen</h2>
      <span>{unresolvedCount
        ? `${unresolvedCount} ${unresolvedCount === 1 ? "Angabe braucht" : "Angaben brauchen"} dich.`
        : reviewEntries.length
          ? "Alle Angaben bestätigt. Du kannst sie bis zum Speichern weiter ändern."
          : "Alles ist bereit. Keine zusätzlichen Formulare."}</span>
    </div>

    {reviewEntries.map((entry) => <ExceptionCard key={entry.itemMutationId} entry={entry} entries={entries} onChange={onChange} disabled={locked} />)}

    {(saveState.status === "queued" || saveState.status === "uncertain") && <CaptureList entries={entries} onChange={onChange} disabled />}

    {(saveState.status === "rejected" || saveState.status === "error") && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span>{saveState.message}</span></div>}
    {saveState.status === "queued" && <div className="batch-save-state queued" role="status">
      <LoaderCircle className="spin" size={22} /><div><strong>Auf diesem Gerät gespeichert</strong><p>FoodOS synchronisiert den gesamten Einkauf bei sicherer Verbindung. Die Sitzung bleibt sichtbar.</p></div>
    </div>}
    {saveState.status === "uncertain" ? <div className="batch-save-state uncertain" role="alert">
      <AlertTriangle size={22} />
      <div><strong>Serverbestätigung unvollständig</strong><p>Der Server kann diesen Einkauf bereits gebucht haben. FoodOS sendet ihn nicht erneut. Öffne den Vorrat und gleiche den Bestand ab.</p></div>
      <button type="button" className="primary-button wide" onClick={onOpenInventory}>Vorrat prüfen</button>
      <button type="button" className="secondary-button wide" onClick={onOpenToday}>Heute ansehen</button>
    </div> : <div className="capture-review-actions">
      <button type="button" className="primary-button wide" disabled={!ready || locked} onClick={onCommit}>
        {saveState.status === "saving" ? <LoaderCircle className="spin" size={18} /> : <PackageCheck size={18} />}
        {saveState.status === "saving" ? "Einkauf wird gespeichert …" : saveState.status === "rejected" ? "Erneut sicher speichern" : preview ? "Preview abschließen" : "Einkauf übernehmen"}
      </button>
      {!locked && <button type="button" className="secondary-button wide" onClick={onBack}>Weiter scannen</button>}
      {preview && <p className="preview-save-note">Preview-Modus: Der Ablauf ist testbar, es werden keine Vorratsdaten gespeichert.</p>}
    </div>}
  </section>;
}

function ExceptionCard({ entry, entries, onChange, disabled }: { entry: CaptureEntry; entries: CaptureEntry[]; onChange: (entries: CaptureEntry[]) => void; disabled: boolean }) {
  const exceptions = captureExceptions(entry);
  const [name, setName] = useState("");

  function manualProduct(productName: string): Product {
    return {
      barcode: entry.barcode,
      name: productName,
      categories: [], countries: [], structuredIngredients: [], allergens: [], traces: [], additives: [], labels: [],
      nutrition: {}, assessments: [], source: "manual", retrievedAt: new Date().toISOString(), confidence: 0
    };
  }

  function resolveName(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange(resolveCaptureIdentity(entries, entry.itemMutationId, manualProduct(trimmed)));
  }

  function retainUnknown() {
    let next = resolveCaptureIdentity(entries, entry.itemMutationId, manualProduct("Unbekanntes Produkt"));
    next = confirmCaptureException(next, entry.itemMutationId, "low-confidence");
    onChange(next);
  }

  return <article className="capture-exception-card">
    <header><ProductThumb entry={entry} /><div><strong>{entry.product?.name ?? "Produktidentität unklar"}</strong><small>{entry.barcode}</small></div><QuantityControl entry={entry} entries={entries} onChange={onChange} disabled={disabled} /></header>

    {(!entry.location || entry.locationNeedsReview) && <label className="capture-review-location">
      <span>Lagerort</span>
      <select
        aria-label={`Lagerort für ${entry.product?.name ?? entry.barcode}`}
        value={entry.location ?? ""}
        onChange={(event) => onChange(updateCaptureLocation(entries, entry.itemMutationId, event.target.value ? event.target.value as CaptureLocation : null))}
        disabled={disabled}
      >
        <option value="">Noch offen</option>
        {CAPTURE_LOCATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>}

    {exceptions.includes("identity") && <form className="capture-identity-form" onSubmit={resolveName}>
      <p>{entry.unresolvedReason === "not-found" ? "Nicht im Katalog gefunden." : "Produktquelle war nicht erreichbar."} Fehlende Zutaten, Nährwerte und Daten bleiben unbekannt.</p>
      <label><span>Produktname</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={240} disabled={disabled} /></label>
      <button type="submit" className="secondary-button" disabled={disabled || !name.trim()}>Mit Namen übernehmen</button>
      <button type="button" className="text-button" onClick={retainUnknown} disabled={disabled}>Ausdrücklich als unbekannt übernehmen</button>
    </form>}

    {hasGs1BatchFacts(entry.gs1) && entry.gs1 && <fieldset className="capture-confirmation" disabled={disabled}>
      <legend>GS1-Angaben der Packung prüfen</legend>
      {entry.gs1.bestBeforeDate && <label><span>MHD</span><input type="date" value={entry.gs1.bestBeforeDate} onChange={(event) => onChange(updateCaptureGs1(entries, entry.itemMutationId, { ...entry.gs1!, bestBeforeDate: event.target.value }))} /></label>}
      {entry.gs1.useByDate && <label><span>Verbrauchsdatum</span><input type="date" value={entry.gs1.useByDate} onChange={(event) => onChange(updateCaptureGs1(entries, entry.itemMutationId, { ...entry.gs1!, useByDate: event.target.value }))} /></label>}
      {entry.gs1.lotNumber && <label><span>Charge</span><input value={entry.gs1.lotNumber} maxLength={120} onChange={(event) => onChange(updateCaptureGs1(entries, entry.itemMutationId, { ...entry.gs1!, lotNumber: event.target.value }))} /></label>}
      {entry.gs1.serialNumber && <label><span>Seriennummer</span><input value={entry.gs1.serialNumber} maxLength={120} onChange={(event) => onChange(updateCaptureGs1(entries, entry.itemMutationId, { ...entry.gs1!, serialNumber: event.target.value }))} /></label>}
      <label className="capture-check"><input type="checkbox" checked={entry.confirmations.gs1} onChange={(event) => onChange(confirmCaptureException(entries, entry.itemMutationId, "gs1", event.target.checked))} /><span>Mit der Packung abgeglichen</span></label>
    </fieldset>}

    {entry.product && hasPersonalRisk(entry.product) && <label className="capture-check is-risk"><input type="checkbox" disabled={disabled} checked={entry.confirmations.personalRisk} onChange={(event) => onChange(confirmCaptureException(entries, entry.itemMutationId, "personal-risk", event.target.checked))} /><span><strong>Persönlichen Konflikt bestätigen</strong><small>Packungskennzeichnung selbst prüfen. FoodOS ersetzt keine medizinische Beratung.</small></span></label>}

    {entry.product && (hasLowConfidence(entry.product) || entry.sourceNeedsReview) && <label className="capture-check"><input type="checkbox" disabled={disabled} checked={entry.confirmations.lowConfidence} onChange={(event) => onChange(confirmCaptureException(entries, entry.itemMutationId, "low-confidence", event.target.checked))} /><span><strong>Unsichere Produktquelle geprüft</strong><small>Fehlende oder abweichende Angaben bleiben unbekannt.</small></span></label>}
  </article>;
}

function ProductThumb({ entry }: { entry: CaptureEntry }) {
  return <span className="capture-thumb">{entry.product?.imageUrl
    ? <Image src={entry.product.imageUrl} alt="" width={52} height={52} unoptimized />
    : <ImageOff size={20} aria-label="Kein Produktbild verfügbar" />}</span>;
}

function QuantityControl({ entry, entries, onChange, disabled = false }: { entry: CaptureEntry; entries: CaptureEntry[]; onChange: (entries: CaptureEntry[]) => void; disabled?: boolean }) {
  return <div className="capture-quantity" role="group" aria-label={`Menge ${entry.product?.name ?? entry.barcode}`}>
    <button type="button" aria-label="Menge verringern" disabled={disabled} onClick={() => onChange(updateCaptureQuantity(entries, entry.itemMutationId, entry.quantity - 1))}>{entry.quantity === 1 ? <Trash2 size={16} /> : <Minus size={16} />}</button>
    <output aria-live="off">{entry.quantity}</output>
    <button type="button" aria-label="Menge erhöhen" disabled={disabled} onClick={() => onChange(updateCaptureQuantity(entries, entry.itemMutationId, entry.quantity + 1))}><Plus size={16} /></button>
  </div>;
}

function toPurchaseCaptureItem(entry: CaptureEntry): PurchaseCaptureItem {
  if (!entry.product) throw new Error("Unresolved capture cannot be committed");
  if (!entry.location) throw new Error("Capture location must be confirmed before commit");
  const hasConfirmedDate = Boolean(entry.gs1?.bestBeforeDate || entry.gs1?.useByDate);
  return {
    item_mutation_id: entry.itemMutationId,
    product_payload: entry.product,
    batch_payload: {
      amount: entry.quantity,
      unit: "piece",
      location: entry.location,
      best_before_date: entry.gs1?.bestBeforeDate?.trim() || null,
      use_by_date: entry.gs1?.useByDate?.trim() || null,
      lot_number: entry.gs1?.lotNumber?.trim() || null,
      serial_number: entry.gs1?.serialNumber?.trim() || null,
      purchase_price_cents: null,
      date_source: hasConfirmedDate ? (entry.gs1DateEdited ? "manual_confirmed" : "gs1_confirmed") : null,
      personal_risk_confirmed: hasPersonalRisk(entry.product) && entry.confirmations.personalRisk
    }
  };
}
