"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CloudOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { flushQueuedOperations, getOutboxSummary, subscribeToOutbox, type OutboxSummary } from "@/infrastructure/offline-outbox";

const empty: OutboxSummary = { queued: 0, sending: 0, rejected: 0 };

export function OutboxStatus() {
  const router = useRouter();
  const [summary, setSummary] = useState(empty);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);

  const refresh = useCallback(async () => {
    try {
      setSummary(await getOutboxSummary());
    } catch {
      setSummary(empty);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const unsubscribe = subscribeToOutbox(() => void refresh());
    const handleOffline = () => setOnline(false);
    const handleOnline = async () => {
      setOnline(true);
      try {
        await flushQueuedOperations();
        router.refresh();
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
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [refresh, router]);

  if (online && summary.queued === 0 && summary.sending === 0 && summary.rejected === 0) return null;
  if (summary.rejected > 0) return <div className="outbox-status rejected" role="alert"><AlertTriangle size={16} /><span><strong>Synchronisierung angehalten</strong>{summary.rejected} Änderung{summary.rejected === 1 ? "" : "en"} wurde{summary.rejected === 1 ? "" : "n"} abgelehnt. Die Serverdaten wurden nicht überschrieben.</span></div>;
  if (summary.sending > 0) return <div className="outbox-status" role="status"><LoaderCircle className="spin" size={16} /><span><strong>Wird synchronisiert</strong>Die bestätigte Änderung wird genau einmal an den Server gesendet.</span></div>;
  return <div className="outbox-status" role="status"><CloudOff size={16} /><span><strong>{online ? "Synchronisierung wartet" : "Offline · auf diesem Gerät gespeichert"}</strong>{summary.queued} bestätigte Änderung{summary.queued === 1 ? "" : "en"} wartet{summary.queued === 1 ? "" : "en"}; andere Haushaltsgeräte sehen sie noch nicht.</span></div>;
}
