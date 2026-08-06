"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

const empty: OutboxSummary = { queued: 0, sending: 0, rejected: 0, uncertain: 0 };

export function OutboxStatus({ activeHouseholdIds }: { activeHouseholdIds?: string[] }) {
  const router = useRouter();
  const routerRef = useRef(router);
  const syncInFlight = useRef<Promise<void> | null>(null);
  const activeHouseholdKey = activeHouseholdIds?.join(",");
  const activeHouseholdKeyRef = useRef(activeHouseholdKey);
  const [summary, setSummary] = useState(empty);
  const [storageState, setStorageState] = useState<OfflineDataStorageState>(() => getOfflineDataStorageState());
  const [storageReadable, setStorageReadable] = useState(true);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    activeHouseholdKeyRef.current = activeHouseholdKey;
  }, [activeHouseholdKey]);

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
    const handleOnline = () => {
      setOnline(true);
      if (syncInFlight.current) return;
      const sync = (async () => {
        if (getOfflineDataStorageState() !== "available") {
          await refresh();
          return;
        }
        let householdKey = activeHouseholdKeyRef.current;
        do {
          try {
            if (householdKey !== undefined) {
              await reconcileOfflineHouseholdAccess(householdKey ? householdKey.split(",") : []);
            }
            await flushQueuedOperations();
            routerRef.current.refresh();
          } catch {
            // refresh below exposes a readable failure state instead of treating it as empty.
          } finally {
            await refresh();
          }
          const latestHouseholdKey = activeHouseholdKeyRef.current;
          if (latestHouseholdKey === householdKey) break;
          householdKey = latestHouseholdKey;
        } while (true);
      })();
      syncInFlight.current = sync;
      void sync.then(
        () => { if (syncInFlight.current === sync) syncInFlight.current = null; },
        () => { if (syncInFlight.current === sync) syncInFlight.current = null; }
      );
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    if (navigator.onLine) handleOnline();
    return () => {
      window.clearTimeout(initialRefresh);
      unsubscribe();
      unsubscribeOfflineDataState();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [activeHouseholdKey, refresh]);

  useEffect(() => {
    if (summary.sending === 0 || storageState !== "available") return;
    let cancelled = false;
    let timer: number | undefined;
    const scheduleRecheck = () => {
      timer = window.setTimeout(async () => {
        await refresh();
        if (!cancelled) scheduleRecheck();
      }, 5_000);
    };
    scheduleRecheck();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [refresh, storageState, summary.sending]);

  if (storageState === "cleanup-pending") {
    return <div className="outbox-status rejected" role="alert"><AlertTriangle size={16} /><span><strong>Lokale Offline-Daten werden noch entfernt</strong>Die Löschung ist noch nicht bestätigt. Schließe weitere FoodOS-Tabs; neue Offline-Speicherungen bleiben blockiert, bis der Vorgang abgeschlossen ist.</span></div>;
  }
  if (storageState === "cleared") {
    return <div className="outbox-status" role="status"><CloudOff size={16} /><span><strong>Lokale Offline-Daten bestätigt entfernt</strong>Du kannst die sichere Abmeldung jetzt fortsetzen.</span></div>;
  }
  if (!storageReadable) {
    return <div className="outbox-status rejected" role="alert"><AlertTriangle size={16} /><span><strong>Lokale Synchronisierung nicht prüfbar</strong>FoodOS kann den Browser-Speicher nicht sicher lesen. Es wird weder eine leere Warteschlange noch eine erfolgreiche Löschung angenommen. Prüfe den Browser-Speicher, bevor du dich abmeldest.</span></div>;
  }
  const states: ReactNode[] = [];
  if (summary.uncertain > 0) states.push(
    <div className="outbox-status rejected" role="alert" key="uncertain"><AlertTriangle size={16} /><span><strong>Serverbestätigung unklar</strong>{summary.uncertain} Einkauf{summary.uncertain === 1 ? "" : "svorgänge"} {summary.uncertain === 1 ? "kann" : "können"} bereits gebucht worden sein. FoodOS bewahrt {summary.uncertain === 1 ? "den verschlüsselten Vorgang" : "die verschlüsselten Vorgänge"} auf, sendet {summary.uncertain === 1 ? "ihn" : "sie"} nicht erneut und bietet kein Verwerfen an, bis der Bestand abgeglichen wurde.</span></div>
  );
  if (summary.rejected > 0) states.push(
    <div className="outbox-status rejected" role="alert" key="rejected"><AlertTriangle size={16} /><span><strong>Synchronisierung angehalten</strong>{summary.rejected} Änderung{summary.rejected === 1 ? "" : "en"} wurde{summary.rejected === 1 ? "" : "n"} abgelehnt. Die Serverdaten wurden nicht überschrieben.<button type="button" onClick={async () => {
      if (!window.confirm("Abgelehnte lokale Änderungen verwerfen? Sie wurden nicht in den gemeinsamen FoodOS-Datenbestand übernommen.")) return;
      await discardRejectedOperations();
      await refresh();
    }}>Abgelehnte lokale Änderung{summary.rejected === 1 ? "" : "en"} verwerfen</button></span></div>
  );
  if (summary.sending > 0) states.push(
    <div className="outbox-status" role="status" key="sending"><LoaderCircle className="spin" size={16} /><span><strong>Wird synchronisiert</strong>{summary.sending} bestätigte Änderung{summary.sending === 1 ? " wird" : "en werden"} mit einem exklusiven Sende-Claim verarbeitet.</span></div>
  );
  if (summary.queued > 0) states.push(
    <div className="outbox-status" role="status" key="queued"><CloudOff size={16} /><span><strong>{online ? "Synchronisierung wartet" : "Offline · auf diesem Gerät gespeichert"}</strong>{summary.queued} bestätigte Änderung{summary.queued === 1 ? "" : "en"} {summary.queued === 1 ? "wartet" : "warten"}; andere Haushaltsgeräte sehen sie noch nicht.</span></div>
  );
  if (states.length > 0) return <>{states}</>;
  if (online) return null;
  return <div className="outbox-status" role="status"><CloudOff size={16} /><span><strong>Offline · Serverstand nicht aktualisierbar</strong>Unterstützte neue Änderungen werden verschlüsselt gespeichert. Private Offline-Lesedaten sind noch nicht verfügbar.</span></div>;
}
