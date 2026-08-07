"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  LoaderCircle,
  PackageOpen,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Utensils,
  X
} from "lucide-react";
import {
  consumeBatchResultSchema,
  consumptionInputSchema,
  discardBatchResultSchema,
  discardInputSchema
} from "@/contracts/inventory";
import { nutritionForAmount } from "@/lib/food-math";
import {
  discardRejectedOperation,
  getDurableOperationStatus,
  reconcileUncertainOperation,
  submitDurableRpc,
  subscribeToOperationOutcome,
  subscribeToOutbox,
  type DurableMutationRejectionReason
} from "@/infrastructure/offline-outbox";
import type { InventoryItem } from "@/lib/types";

const previewRecall: InventoryItem["recall"] = {
  kind: "source_unavailable",
  blocksConsumption: false,
  stale: true,
  wording: "Preview-Modus: Es wurden keine amtlichen Rückrufdaten geladen."
};
const previewInventory: InventoryItem[] = [
  { id: "1", productId: "preview-product-1", name: "Fiktives Lachsfilet", brand: "Preview", remainingLabel: "280 g", remainingAmount: 280, unit: "g", location: "Kühlschrank", daysUntilExpiry: 1, expiryDate: "03.08.", dateKind: "use_by", expiryState: "soon", personalRiskMatches: [], recall: previewRecall, nutrition: { kcal100g: 208, protein100g: 20 } },
  { id: "2", productId: "preview-product-2", name: "Fiktive Vollmilch", brand: "Preview", remainingLabel: "650 ml", remainingAmount: 650, unit: "ml", location: "Kühlschrank", daysUntilExpiry: 3, expiryDate: "05.08.", dateKind: "best_before", expiryState: "soon", personalRiskMatches: [], recall: previewRecall, nutrition: { kcal100g: 64, protein100g: 3.4 } },
  { id: "3", productId: "preview-product-3", name: "Fiktive Hähnchenbrust", brand: "Preview", remainingLabel: "400 g", remainingAmount: 400, unit: "g", location: "Kühlschrank", daysUntilExpiry: 4, expiryDate: "06.08.", dateKind: "use_by", expiryState: "soon", personalRiskMatches: [], recall: previewRecall, nutrition: { kcal100g: 110, protein100g: 23 } },
  { id: "4", productId: "preview-product-4", name: "Fiktiver Basmati-Reis", brand: "Preview", remainingLabel: "1,2 kg", remainingAmount: 1200, unit: "g", location: "Vorrat", expiryState: "unknown", personalRiskMatches: [], recall: previewRecall, nutrition: { kcal100g: 354, protein100g: 9 } }
];

type InventoryAction = "consume" | "discard";

type DisposalState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "reconciling"; operationId: string; batchId: string; itemName: string; unit: InventoryItem["unit"] }
  | { status: "queued"; operationId: string; batchId: string; itemName: string; unit: InventoryItem["unit"] }
  | { status: "success"; operationId: string; itemName: string; remainingAmount: number; unit: InventoryItem["unit"] }
  | { status: "uncertain"; operationId: string; batchId: string; itemName: string; unit: InventoryItem["unit"] }
  | { status: "rejected"; message: string }
  | { status: "error"; message: string };

interface InventoryViewProps {
  onScan: () => void;
  onConsumed?: () => void;
  items?: InventoryItem[];
  householdId?: string;
}

const amountFormatter = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 });

function blocksConsumption(item: InventoryItem): boolean {
  return item.expiryState === "past_use_by" || item.recall.blocksConsumption === true;
}

function disposalRejectionMessage(message: string, reason: DurableMutationRejectionReason): string {
  if (reason === "operation_rejected" || reason === "server_rejected") {
    return "Die Wegwerfen-Buchung wurde abgelehnt. Prüfe Menge und aktuellen Bestand und versuche es erneut.";
  }
  if (reason === "payload_conflict") {
    return "Diese sichere Vorgangs-ID gehört bereits zu einer anderen Änderung. Versuche die erhaltene Eingabe erneut.";
  }
  return message;
}

export function InventoryView({ onScan, onConsumed, items, householdId }: InventoryViewProps) {
  const visibleItems = items ?? previewInventory;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<InventoryAction>("consume");
  const [amount, setAmount] = useState("");
  const [consumptionSaving, setConsumptionSaving] = useState(false);
  const [consumptionError, setConsumptionError] = useState<string | null>(null);
  const [disposalState, setDisposalState] = useState<DisposalState>({ status: "idle" });
  const [pastBestBeforeConfirmed, setPastBestBeforeConfirmed] = useState(false);
  const [personalRiskConfirmed, setPersonalRiskConfirmed] = useState(false);
  const consumptionMutationId = useRef("");
  const disposalMutationId = useRef("");
  const rejectedDisposalOperationId = useRef<string | null>(null);
  const acknowledgedDisposals = useRef(new Set<string>());
  const onConsumedRef = useRef(onConsumed);
  const actionHeadingRef = useRef<HTMLHeadingElement>(null);
  const disposalSuccessRef = useRef<HTMLDivElement>(null);
  const returnFocusBatchId = useRef<string | null>(null);
  const inventoryRowRefs = useRef(new Map<string, HTMLButtonElement>());
  const selected = useMemo(
    () => visibleItems.find((item) => item.id === selectedId),
    [selectedId, visibleItems]
  );
  const numericAmount = Number(amount);
  const previewNutrition = selected && Number.isFinite(numericAmount)
    ? nutritionForAmount(selected.nutrition, numericAmount)
    : null;
  const consumptionBlocked = selected ? blocksConsumption(selected) : false;
  const consumptionUnavailable = consumptionBlocked || selected?.unit === "piece";
  const mutationInFlight = consumptionSaving
    || disposalState.status === "saving"
    || disposalState.status === "reconciling";
  const disposalQueued = disposalState.status === "queued";
  const disposalNeedsReconciliation = disposalState.status === "uncertain";
  const disposalCompleted = disposalState.status === "success";
  const actionSwitchLocked = mutationInFlight || disposalQueued || disposalNeedsReconciliation || disposalCompleted;
  const disposalInputLocked = mutationInFlight || disposalQueued || disposalNeedsReconciliation || disposalCompleted;
  const canSubmitDisposal = disposalState.status === "idle"
    || disposalState.status === "rejected"
    || disposalState.status === "error";
  const trackedDisposal = disposalState.status === "queued"
    || disposalState.status === "uncertain"
    || disposalState.status === "reconciling"
    ? disposalState
    : null;
  const trackedDisposalOperationId = trackedDisposal?.operationId ?? null;
  const trackedDisposalBatchId = trackedDisposal?.batchId ?? null;
  const trackedDisposalItemName = trackedDisposal?.itemName ?? null;
  const trackedDisposalUnit = trackedDisposal?.unit ?? null;
  const queuedDisposal = disposalState.status === "queued" ? disposalState : null;

  useEffect(() => {
    onConsumedRef.current = onConsumed;
  }, [onConsumed]);

  useEffect(() => {
    if (selectedId !== null) {
      actionHeadingRef.current?.focus();
      return;
    }
    const batchId = returnFocusBatchId.current;
    if (batchId === null) return;
    returnFocusBatchId.current = null;
    inventoryRowRefs.current.get(batchId)?.focus();
  }, [selectedId]);

  useEffect(() => {
    if (disposalState.status === "success" && disposalState.remainingAmount === 0) {
      disposalSuccessRef.current?.focus();
    }
  }, [disposalState]);

  const confirmDisposal = useCallback((input: {
    operationId: string;
    batchId: string;
    itemName: string;
    unit: InventoryItem["unit"];
    data: unknown;
  }): boolean => {
    const parsed = discardBatchResultSchema.safeParse(input.data);
    if (!parsed.success || parsed.data.batch_id !== input.batchId) return false;
    if (acknowledgedDisposals.current.has(input.operationId)) return true;
    acknowledgedDisposals.current.add(input.operationId);
    setDisposalState({
      status: "success",
      operationId: input.operationId,
      itemName: input.itemName,
      remainingAmount: parsed.data.remaining_amount,
      unit: input.unit
    });
    if (parsed.data.remaining_amount === 0) {
      returnFocusBatchId.current = null;
      setSelectedId(null);
    }
    onConsumedRef.current?.();
    return true;
  }, []);

  useEffect(() => {
    if (
      trackedDisposalOperationId === null
      || trackedDisposalBatchId === null
      || trackedDisposalItemName === null
      || trackedDisposalUnit === null
    ) return;
    const operationId = trackedDisposalOperationId;
    const batchId = trackedDisposalBatchId;
    const itemName = trackedDisposalItemName;
    const unit = trackedDisposalUnit;
    let live = true;
    let terminal = false;

    function markUncertain() {
      if (!live || terminal) return;
      setDisposalState((current) => {
        if (current.status === "reconciling" && current.operationId === operationId) return current;
        if (
          (current.status === "queued" || current.status === "uncertain")
          && current.operationId === operationId
        ) return { status: "uncertain", operationId, batchId, itemName, unit };
        return current;
      });
    }

    function markRejected(message: string, reason: DurableMutationRejectionReason) {
      if (!live || terminal) return;
      terminal = true;
      rejectedDisposalOperationId.current = operationId;
      disposalMutationId.current = crypto.randomUUID();
      setDisposalState({ status: "rejected", message: disposalRejectionMessage(message, reason) });
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
      if (!confirmDisposal({ operationId, batchId, itemName, unit, data: outcome.data })) {
        markUncertain();
        return;
      }
      terminal = true;
    }

    const unsubscribeOutcome = subscribeToOperationOutcome<unknown>(operationId, handleOutcome);

    return () => {
      live = false;
      unsubscribeOutcome();
    };
  }, [
    confirmDisposal,
    trackedDisposalBatchId,
    trackedDisposalItemName,
    trackedDisposalOperationId,
    trackedDisposalUnit
  ]);

  useEffect(() => {
    if (!queuedDisposal) return;
    const { operationId } = queuedDisposal;
    let live = true;
    let statusReadVersion = 0;

    async function refreshDurableStatus() {
      if (!live || acknowledgedDisposals.current.has(operationId)) return;
      const readVersion = ++statusReadVersion;
      try {
        const status = await getDurableOperationStatus(operationId);
        if (
          !live
          || acknowledgedDisposals.current.has(operationId)
          || rejectedDisposalOperationId.current === operationId
          || readVersion !== statusReadVersion
        ) return;
        if (status.status === "queued" || status.status === "sending") return;
        if (status.status === "rejected") {
          rejectedDisposalOperationId.current = operationId;
          disposalMutationId.current = crypto.randomUUID();
          setDisposalState({
            status: "rejected",
            message: disposalRejectionMessage(
              "Die gespeicherte Wegwerfen-Buchung wurde abgelehnt.",
              "operation_rejected"
            )
          });
          return;
        }
        setDisposalState((current) => current.status === "queued" && current.operationId === operationId
          ? { ...current, status: "uncertain" }
          : current);
      } catch {
        if (
          !live
          || acknowledgedDisposals.current.has(operationId)
          || rejectedDisposalOperationId.current === operationId
          || readVersion !== statusReadVersion
        ) return;
        setDisposalState((current) => current.status === "queued" && current.operationId === operationId
          ? { ...current, status: "uncertain" }
          : current);
      }
    }

    const unsubscribeOutbox = subscribeToOutbox(() => void refreshDurableStatus());
    void refreshDurableStatus();
    return () => {
      live = false;
      statusReadVersion += 1;
      unsubscribeOutbox();
    };
  }, [queuedDisposal]);

  function choose(item: InventoryItem) {
    if (mutationInFlight) return;
    setSelectedId(item.id);
    setAction(blocksConsumption(item) || item.unit === "piece" ? "discard" : "consume");
    setAmount(item.unit === "piece" ? "1" : String(Math.min(item.remainingAmount, 100)));
    setConsumptionError(null);
    setDisposalState({ status: "idle" });
    setPastBestBeforeConfirmed(false);
    setPersonalRiskConfirmed(false);
    consumptionMutationId.current = crypto.randomUUID();
    disposalMutationId.current = crypto.randomUUID();
  }

  function closeSelection() {
    if (mutationInFlight) return;
    returnFocusBatchId.current = selectedId;
    setSelectedId(null);
    setDisposalState({ status: "idle" });
  }

  async function reconcileUncertainDisposal() {
    if (disposalState.status !== "uncertain") return;
    const pending = disposalState;
    setDisposalState({ ...pending, status: "reconciling" });
    try {
      const result = await reconcileUncertainOperation<unknown>(pending.operationId);
      if (
        acknowledgedDisposals.current.has(pending.operationId)
        || rejectedDisposalOperationId.current === pending.operationId
      ) return;
      if (result.status === "queued") {
        setDisposalState((current) => (
          (current.status === "reconciling" || current.status === "uncertain")
            && current.operationId === pending.operationId
            ? { ...pending, status: "queued" }
            : current
        ));
        return;
      }
      if (result.status === "rejected") {
        if (result.reason === "acknowledgement_unknown") {
          setDisposalState((current) => (
            (current.status === "reconciling" || current.status === "uncertain")
              && current.operationId === pending.operationId
              ? pending
              : current
          ));
          return;
        }
        rejectedDisposalOperationId.current = pending.operationId;
        disposalMutationId.current = crypto.randomUUID();
        setDisposalState({ status: "rejected", message: disposalRejectionMessage(result.message, result.reason) });
        return;
      }
      if (!confirmDisposal({
        operationId: pending.operationId,
        batchId: pending.batchId,
        itemName: pending.itemName,
        unit: pending.unit,
        data: result.data
      })) {
        setDisposalState((current) => (
          (current.status === "reconciling" || current.status === "uncertain")
            && current.operationId === pending.operationId
            ? pending
            : current
        ));
      }
    } catch {
      if (
        acknowledgedDisposals.current.has(pending.operationId)
        || rejectedDisposalOperationId.current === pending.operationId
      ) return;
      setDisposalState((current) => current.status === "reconciling"
        && current.operationId === pending.operationId
        ? pending
        : current);
    }
  }

  function changeAmount(nextAmount: string) {
    setAmount(nextAmount);
    if (disposalState.status === "rejected" || disposalState.status === "error") {
      setDisposalState({ status: "idle" });
    }
  }

  function cleanPriorRejectedDisposal(currentOperationId: string) {
    const previousOperationId = rejectedDisposalOperationId.current;
    if (!previousOperationId || previousOperationId === currentOperationId) return;
    rejectedDisposalOperationId.current = null;
    void discardRejectedOperation(previousOperationId);
  }

  async function consume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !onConsumed || !householdId) return;
    const parsed = consumptionInputSchema.safeParse({ batchId: selected.id, amount });
    if (!parsed.success || parsed.data.amount > selected.remainingAmount) {
      setConsumptionError("Die Portion muss größer als 0 sein und darf den Bestand nicht überschreiten.");
      return;
    }
    if (selected.unit === "piece") {
      setConsumptionError("Für Stück-Einheiten muss zuerst ein bestätigtes Gewicht hinterlegt werden.");
      return;
    }

    setConsumptionSaving(true);
    setConsumptionError(null);
    try {
      const result = await submitDurableRpc<unknown>({
        kind: "inventory.consume_batch",
        rpc: "consume_inventory_batch_v2",
        householdId,
        operationId: consumptionMutationId.current,
        args: {
          target_batch: parsed.data.batchId,
          consumed_amount: parsed.data.amount,
          mutation_id: consumptionMutationId.current,
          confirm_past_best_before: pastBestBeforeConfirmed,
          confirm_personal_risk: personalRiskConfirmed
        }
      });
      setConsumptionSaving(false);
      if (result.status === "queued") {
        setSelectedId(null);
        return;
      }
      if (result.status === "rejected" || !consumeBatchResultSchema.safeParse(result.data).success) {
        const knownError = result.status === "rejected" ? result.message : "";
        setConsumptionError(knownError.includes("Best-before confirmation") ? "Bestätige die Prüfung nach überschrittenem MHD."
          : knownError.includes("Personal risk confirmation") ? "Bestätige den persönlichen Konflikt vor der Buchung."
            : knownError.includes("Use-by date") || knownError.includes("recall") ? "Diese Charge darf nicht als Verzehr gebucht werden."
              : "Der Verzehr wurde nicht bestätigt. Du kannst sicher erneut versuchen; dieselbe Buchung wird nicht doppelt ausgeführt.");
        return;
      }
      setSelectedId(null);
      onConsumed();
    } catch {
      setConsumptionSaving(false);
      setConsumptionError("Die Buchung konnte weder lokal sicher gespeichert noch vom Server bestätigt werden.");
    }
  }

  async function discard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !onConsumed || !householdId || actionSwitchLocked) return;
    const parsed = discardInputSchema.safeParse({ batchId: selected.id, amount });
    if (!parsed.success || parsed.data.amount > selected.remainingAmount) {
      setDisposalState({ status: "error", message: "Die Menge muss größer als 0 sein und darf den Bestand nicht überschreiten." });
      return;
    }
    if (selected.unit === "piece" && !Number.isInteger(parsed.data.amount)) {
      setDisposalState({ status: "error", message: "Stück können nur als ganze Anzahl gebucht werden." });
      return;
    }

    const operationId = disposalMutationId.current;
    setDisposalState({ status: "saving" });
    try {
      const result = await submitDurableRpc<unknown>({
        kind: "inventory.discard_batch",
        rpc: "discard_inventory_batch",
        householdId,
        operationId,
        args: {
          target_batch: parsed.data.batchId,
          discarded_amount: parsed.data.amount,
          mutation_id: operationId
        }
      });
      if (result.status === "queued") {
        cleanPriorRejectedDisposal(operationId);
        setDisposalState({
          status: "queued",
          operationId,
          batchId: parsed.data.batchId,
          itemName: selected.name,
          unit: selected.unit
        });
        return;
      }
      if (result.status === "rejected") {
        if (result.reason === "acknowledgement_unknown") {
          setDisposalState({ status: "uncertain", operationId, batchId: parsed.data.batchId, itemName: selected.name, unit: selected.unit });
          return;
        }
        if (result.reason === "server_rejected" || result.reason === "operation_rejected") {
          rejectedDisposalOperationId.current = operationId;
        }
        disposalMutationId.current = crypto.randomUUID();
        setDisposalState({ status: "rejected", message: disposalRejectionMessage(result.message, result.reason) });
        return;
      }
      cleanPriorRejectedDisposal(operationId);
      if (!confirmDisposal({
        operationId,
        batchId: parsed.data.batchId,
        itemName: selected.name,
        unit: selected.unit,
        data: result.data
      })) {
        setDisposalState({ status: "uncertain", operationId, batchId: parsed.data.batchId, itemName: selected.name, unit: selected.unit });
      }
    } catch {
      disposalMutationId.current = crypto.randomUUID();
      setDisposalState({
        status: "error",
        message: "Die Wegwerfen-Buchung konnte weder lokal sicher gespeichert noch vom Server bestätigt werden. Die Eingabe bleibt erhalten."
      });
    }
  }

  const disposalSuccess = disposalState.status === "success" ? <div ref={disposalSuccessRef} tabIndex={-1} className="inventory-mutation-state success" role="status">
    <Check size={20} />
    <div><strong>Wegwerfen bestätigt</strong><p>{disposalState.remainingAmount === 0
      ? `${disposalState.itemName} wurde vollständig aus dem Bestand entfernt.`
      : `Restbestand: ${amountFormatter.format(disposalState.remainingAmount)} ${disposalState.unit}.`}</p></div>
  </div> : null;

  return (
    <div className="stack-lg page-enter">
      <div className="search-row">
        <label className="search-box"><span className="sr-only">Lebensmittel suchen</span><Search size={18} /><input placeholder="Lebensmittel suchen" /><kbd>{visibleItems.length}</kbd></label>
        <button className="filter-button" aria-label="Filter"><SlidersHorizontal size={19} /></button>
      </div>
      <div className="location-tabs"><button className="selected">Alle</button><button>Kühlschrank</button><button>Gefrierfach</button><button>Vorrat</button></div>

      <section className="inventory-summary">
        <div><p>AKTIVE CHARGEN</p><strong>{visibleItems.length}</strong><span>dauerhaft gespeichert</span></div>
        <div className="summary-divider" />
        <div><p>HANDLUNG NÖTIG</p><strong className="warm">{visibleItems.filter((item) => ["past_use_by", "past_best_before", "today", "soon"].includes(item.expiryState) || item.recall.kind !== "none" || item.personalRiskMatches.length > 0).length}</strong><span>Sicherheit prüfen</span></div>
      </section>

      <section>
        <div className="section-heading"><div><p>NACH DRINGLICHKEIT</p><h2>Zuerst verwenden</h2></div><button className="small-action" onClick={onScan}><Plus size={16} /> Produkt</button></div>
        {visibleItems.length ? <div className="inventory-list">
          {visibleItems.map((item) => (
            <button
              className="inventory-row"
              key={item.id}
              ref={(node) => {
                if (node) inventoryRowRefs.current.set(item.id, node);
                else inventoryRowRefs.current.delete(item.id);
              }}
              onClick={() => choose(item)}
              aria-expanded={selectedId === item.id}
              aria-controls={`inventory-action-${item.id}`}
              disabled={mutationInFlight}
            >
              <span className="inventory-emoji">{item.imageUrl ? <Image src={item.imageUrl} alt="" width={47} height={47} unoptimized /> : <PackageOpen size={21} />}</span>
              <span className="inventory-copy"><small>{item.location}</small><strong>{item.name}</strong><em>{[item.brand, item.remainingLabel, item.lotNumber ? `Charge ${item.lotNumber}` : null].filter(Boolean).join(" · ")}</em></span>
              {item.expiryDate ? <span className={`expiry-pill ${item.expiryState === "past_use_by" || item.expiryState === "today" ? "urgent" : ""}`}><small>{item.dateKind === "use_by" ? "ZU VERBRAUCHEN" : "MHD"}</small>{item.expiryDate}</span> : <span className="stock-pill">Kein Datum</span>}
              <ChevronRight size={17} />
            </button>
          ))}
        </div> : <div className="empty-state"><PackageOpen size={24} /><h2>Noch nichts im Vorrat</h2><p>Erfasse eine konkrete Packung mit Menge und optionalem Datum.</p><button className="primary-button" onClick={onScan}><Plus size={17} /> Erstes Lebensmittel erfassen</button></div>}

        {!selected && disposalSuccess}

        {selected && <form id={`inventory-action-${selected.id}`} className="consume-card" onSubmit={action === "consume" ? consume : discard} aria-label={`${action === "consume" ? "Verzehr" : "Wegwerfen"} von ${selected.name} buchen`}>
          <button type="button" className="consume-close" onClick={closeSelection} aria-label="Bestandsaktion schließen" disabled={mutationInFlight}><X size={18} /></button>
          <p>{action === "consume" ? "VERZEHR BUCHEN" : "BESTAND KORRIGIEREN"}</p><h2 ref={actionHeadingRef} tabIndex={-1}>{selected.name}</h2><span>Verfügbar: {selected.remainingLabel}{selected.lotNumber ? ` · Charge ${selected.lotNumber}` : ""}</span>
          {selected.expiryState === "past_use_by" && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span><strong>Nicht verzehren.</strong> Das Verbrauchsdatum ist überschritten. Wegwerfen kann weiterhin gebucht werden.</span></div>}
          {selected.recall.kind !== "none" && <div className={selected.recall.blocksConsumption ? "error-banner" : "safety-banner"} role={selected.recall.blocksConsumption ? "alert" : "status"}><AlertTriangle size={17} /><span>{selected.recall.wording}{selected.recall.sourceUrl && <> <a href={selected.recall.sourceUrl} target="_blank" rel="noreferrer">Amtliche Quelle öffnen</a></>}</span></div>}

          <div className="inventory-action-switch" role="group" aria-label="Bestandsaktion auswählen">
            <button type="button" aria-pressed={action === "consume"} aria-describedby={selected.unit === "piece" ? `piece-consumption-note-${selected.id}` : undefined} className={action === "consume" ? "selected" : ""} onClick={() => setAction("consume")} disabled={consumptionUnavailable || actionSwitchLocked}><Utensils size={17} /> Verzehrt</button>
            <button type="button" aria-pressed={action === "discard"} className={action === "discard" ? "selected discard" : ""} onClick={() => setAction("discard")} disabled={actionSwitchLocked}><Trash2 size={17} /> Weggeworfen</button>
          </div>

          {action === "consume" ? <>
            {!consumptionBlocked && <label className="field-label"><span>Portion in {selected.unit === "piece" ? "Stück" : selected.unit}</span><input type="number" min="0.001" max={selected.remainingAmount} step="0.001" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>}
            {!consumptionBlocked && selected.expiryState === "past_best_before" && <label className="risk-confirmation"><input type="checkbox" checked={pastBestBeforeConfirmed} onChange={(event) => setPastBestBeforeConfirmed(event.target.checked)} required /><span><strong>MHD-Prüfung bestätigen</strong><small>Geruch, Aussehen, Verpackung und Lagerung wurden geprüft. Ein MHD ist kein Verbrauchsdatum.</small></span></label>}
            {!consumptionBlocked && selected.personalRiskMatches.length > 0 && <label className="risk-confirmation"><input type="checkbox" checked={personalRiskConfirmed} onChange={(event) => setPersonalRiskConfirmed(event.target.checked)} required /><span><strong>Persönlichen Konflikt bestätigen</strong><small>Treffer im Profil: {selected.personalRiskMatches.join(", ")}. Prüfe bei Allergien immer die Packungskennzeichnung.</small></span></label>}
            {previewNutrition && selected.unit !== "piece" && <div className="consume-preview" aria-live="polite"><strong>{previewNutrition.kcal} kcal</strong><span>{previewNutrition.protein} g Protein · {previewNutrition.carbs} g Kohlenhydrate · {previewNutrition.fat} g Fett</span>{Object.values(selected.nutrition).every((value) => value == null) && <small>Keine Nährwerte vorhanden; der Bestand wird trotzdem korrekt reduziert.</small>}</div>}
            {consumptionError && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span>{consumptionError}</span></div>}
            {onConsumed && !consumptionBlocked ? <button className="primary-button wide" disabled={consumptionSaving || selected.unit === "piece"}>{consumptionSaving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}{consumptionSaving ? "Wird gebucht …" : "Portion verbindlich buchen"}</button> : !onConsumed && !consumptionBlocked ? <p className="preview-save-note">Preview-Modus: Diese Buchung wird nicht gespeichert.</p> : null}
          </> : <>
            {selected.unit === "piece" && <p id={`piece-consumption-note-${selected.id}`} className="preview-save-note">Stück-Bestände brauchen für eine Verzehrbuchung zuerst ein bestätigtes Gewicht. Wegwerfen kannst du als ganze Anzahl buchen.</p>}
            <label className="field-label"><span>Menge wegwerfen in {selected.unit === "piece" ? "Stück" : selected.unit}</span><input type="number" min={selected.unit === "piece" ? "1" : "0.001"} max={selected.remainingAmount} step={selected.unit === "piece" ? "1" : "0.001"} inputMode="decimal" value={amount} onChange={(event) => changeAmount(event.target.value)} disabled={disposalInputLocked} required /></label>
            <div className="discard-amount-actions"><button type="button" className="secondary-button" onClick={() => changeAmount(String(selected.remainingAmount))} disabled={disposalInputLocked}>Gesamte Restmenge</button><span>Teilmenge oder alles – der Server verhindert negativen Bestand.</span></div>
            {disposalState.status === "saving" && <div className="inventory-mutation-state" role="status"><LoaderCircle className="spin" size={20} /><div><strong>Wird sicher gespeichert</strong><p>Die Eingabe bleibt bis zur Bestätigung erhalten.</p></div></div>}
            {disposalState.status === "reconciling" && <div className="inventory-mutation-state" role="status"><LoaderCircle className="spin" size={20} /><div><strong>Wird sicher abgeglichen</strong><p>FoodOS prüft genau dieselbe gespeicherte Änderung. Sie wird nicht doppelt gebucht.</p></div></div>}
            {disposalState.status === "queued" && <div className="inventory-mutation-state queued" role="status"><LoaderCircle className="spin" size={20} /><div><strong>Auf diesem Gerät gespeichert</strong><p>Wegwerfen ist noch nicht bestätigt. FoodOS wartet auf die sichere Synchronisierung.</p></div></div>}
            {disposalState.status === "uncertain" && <><div className="inventory-mutation-state uncertain" role="alert"><AlertTriangle size={20} /><div><strong>Serverbestätigung unvollständig</strong><p>Die Menge kann bereits reduziert worden sein. Der sichere Abgleich prüft dieselbe gespeicherte Änderung und bucht sie nicht doppelt.</p></div></div><button type="button" className="secondary-button wide" onClick={() => void reconcileUncertainDisposal()}>Sicher abgleichen</button></>}
            {disposalState.status === "rejected" && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span><strong>Wegwerfen abgelehnt.</strong> {disposalState.message}</span></div>}
            {disposalState.status === "error" && <div className="error-banner" role="alert"><AlertTriangle size={17} /><span><strong>Wegwerfen nicht gespeichert.</strong> {disposalState.message}</span></div>}
            {disposalSuccess}
            {onConsumed && canSubmitDisposal ? <button className="discard-button wide"><Trash2 size={18} />{disposalState.status === "rejected" || disposalState.status === "error" ? "Erneut sicher buchen" : "Wegwerfen verbindlich buchen"}</button> : !onConsumed ? <p className="preview-save-note">Preview-Modus: Diese Buchung wird nicht gespeichert.</p> : null}
          </>}
        </form>}
      </section>
    </div>
  );
}
