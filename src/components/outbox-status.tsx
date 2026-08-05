"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CloudOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  discardRejectedOperations,
  flushQueuedOperations,
  getOfflineDataStorageState,
  getOutboxSummary,
  reconcileOfflineHouseholdAccess,
  subscribeToOfflineDataStorageState,
  subscribeToOutbox,
  type OfflineDataStorageState,
  type OutboxSummary
} from "@/infrastructure/offline-outbox";

const empty: OutboxSummary = { queued: 0, sending: 0, rejected: 0 };

export function OutboxStatus({ activeHouseholdIds }: { activeHouseholdIds?: string[] }) {
  const router = useRouter();
  const routerRef = useRef(router);
  const activeHouseholdKey = activeHouseholdIds?.join(",");
  const [summary, setSummary] = useState(empty);
  const [storageState, setStorageState] = useState<OfflineDataStorageState>(() => getOfflineDataStorageState());
  const [storageReadable, setStorageReadable] = useState(true);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const refresh = useCallback(async () => {
    const lifecycle = getOfflineDataStorageState();
    setStorageState(lifecycle);
    if (lifecycle !== "available") {
      setStorageReadable(true);
      setSummary(empty);
      return;
    }

    try {
      setSummary(await getOutboxSummary());
      setStorageReadable(true);
    } catch {
      const currentLifecycle = getOfflineDataStorageState();
      setStorageState(currentLifecycle);
      setSummary(empty);
      setStorageReadable(currentLifecycle !== "available");
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const unsubscribe = subscribeToOutbox(() => void refresh());
    const unsubscribeOfflineDataState = subscribeToOfflineDataStorageState(() => void refresh());
    const handleOffline = () => setOnline(false);
    const handleOnline = async () => {
      setOnline(true);
      if (getOfflineDataStorageState() !== "available") {
        await refresh();
        return;
      }
      try {
        if (activeHouseholdKey !== undefined) {
          await reconcileOfflineHouseholdAccess(activeHouseholdKey ? activeHouseholdKey.split(",") : []);
        }
        await flushQueuedOperations();
        routerRef.current.refresh();
      } catch {
        // refresh below exposes a readable failure state instead of treating it as empty.
      } finally {
        await refresh();
      }
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    if (navigator.onLine) void handleOnline();
    return () => {
      window.clearTimeout(initialRefresh);
      unsubscribe();
      unsubscribeOfflineDataState();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [activeHouseholdKey, refresh]);

  if (storageState === "cleanup-pending") {
    return <div className="outbox-status rejected" role="alert"><AlertTriangle size={16} /><span><strong>Lokale Offline-Daten werden noch entfernt</strong>Die Löschung ist noch nicht bestätigt. Schließe weitere FoodOS-Tabs; neue Offline-Speicherungen bleiben blockiert, bis der Vorgang abgeschlossen ist.</span></div>;
  }
  if (storageState === "cleared") {
    return <div className="outbox-status" role="status"><CloudOff size={16} /><span><strong>Lokale Offline-Daten bestätigt entfernt</strong>Du kannst die sichere Abmeldung jetzt fortsetzen.</span></div>;
  }
  if (!storageReadable) {
    return <div className="outbox-status rejected" role="alert"><AlertTriangle size={16} /><span><strong>Lokale Synchronisierung nicht prüfbar</strong>FoodOS kann den Browser-Speicher nicht sicher lesen. Es wird weder eine leere Warteschlange noch eine erfolgreiche Löschung angenommen. Prüfe den Browser-Speicher, bevor du dich abmeldest.</span></div>;
  }
  if (online && summary.queued === 0 && summary.sending === 0 && summary.rejected === 0) return null;
  if (summary.rejected > 0) return <div className="outbox-status rejected" role="alert"><AlertTriangle size={16} /><span><strong>Synchronisierung angehalten</strong>{summary.rejected} Änderung{summary.rejected === 1 ? "" : "en"} wurde{summary.rejected === 1 ? "" : "n"} abgelehnt. Die Serverdaten wurden nicht überschrieben.<button type="button" onClick={async () => {
    if (!window.confirm("Abgelehnte lokale Änderungen verwerfen? Sie wurden nicht in den gemeinsamen FoodOS-Datenbestand übernommen.")) return;
    await discardRejectedOperations();
    await refresh();
  }}>Abgelehnte lokale Änderung{summary.rejected === 1 ? "" : "en"} verwerfen</button></span></div>;
  if (summary.sending > 0) return <div className="outbox-status" role="status"><LoaderCircle className="spin" size={16} /><span><strong>Wird synchronisiert</strong>Die bestätigte Änderung wird genau einmal an den Server gesendet.</span></div>;
  if (summary.queued === 0) return <div className="outbox-status" role="status"><CloudOff size={16} /><span><strong>Offline · Serverstand nicht aktualisierbar</strong>Unterstützte neue Änderungen werden verschlüsselt gespeichert. Private Offline-Lesedaten sind noch nicht verfügbar.</span></div>;
  return <div className="outbox-status" role="status"><CloudOff size={16} /><span><strong>{online ? "Synchronisierung wartet" : "Offline · auf diesem Gerät gespeichert"}</strong>{summary.queued} bestätigte Änderung{summary.queued === 1 ? "" : "en"} {summary.queued === 1 ? "wartet" : "warten"}; andere Haushaltsgeräte sehen sie noch nicht.</span></div>;
}
