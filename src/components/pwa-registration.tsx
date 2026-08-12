"use client";

import { useEffect, useRef, useState } from "react";

type PwaNotice =
  | { kind: "update"; worker: ServiceWorker }
  | { kind: "error" }
  | null;

const SKIP_WAITING_MESSAGE = { type: "SKIP_WAITING" } as const;

function reloadBrowser(): void {
  window.location.reload();
}

async function unregisterDevelopmentServiceWorkers(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

export function PwaRegistration({ reload = reloadBrowser }: { reload?: () => void } = {}) {
  const [notice, setNotice] = useState<PwaNotice>(null);
  const [activating, setActivating] = useState(false);
  const [registrationAttempt, setRegistrationAttempt] = useState(0);
  const reloadRequested = useRef(false);
  const reloadCompleted = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void unregisterDevelopmentServiceWorkers().catch(() => undefined);
      return;
    }

    let active = true;
    let registration: ServiceWorkerRegistration | null = null;
    let installingWorker: ServiceWorker | null = null;

    const showWaitingWorker = (worker: ServiceWorker | null) => {
      if (active && worker && navigator.serviceWorker.controller) setNotice({ kind: "update", worker });
    };
    const handleInstallingState = () => {
      if (!installingWorker) return;
      if (installingWorker.state === "installed") showWaitingWorker(installingWorker);
      if (active && installingWorker.state === "redundant") setNotice({ kind: "error" });
    };
    const handleUpdateFound = () => {
      installingWorker?.removeEventListener("statechange", handleInstallingState);
      installingWorker = registration?.installing ?? null;
      installingWorker?.addEventListener("statechange", handleInstallingState);
    };
    const handleControllerChange = () => {
      if (!reloadRequested.current || reloadCompleted.current) return;
      reloadCompleted.current = true;
      reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registered) => {
        if (!active) return;
        registration = registered;
        showWaitingWorker(registered.waiting);
        registered.addEventListener("updatefound", handleUpdateFound);
      })
      .catch(() => {
        if (active) setNotice({ kind: "error" });
      });

    return () => {
      active = false;
      installingWorker?.removeEventListener("statechange", handleInstallingState);
      registration?.removeEventListener("updatefound", handleUpdateFound);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [registrationAttempt, reload]);

  function activateUpdate() {
    if (notice?.kind !== "update") return;
    setActivating(true);
    reloadRequested.current = true;
    try {
      notice.worker.postMessage(SKIP_WAITING_MESSAGE);
    } catch {
      reloadRequested.current = false;
      setActivating(false);
      setNotice({ kind: "error" });
    }
  }

  function retryRegistration() {
    setNotice(null);
    setActivating(false);
    setRegistrationAttempt((attempt) => attempt + 1);
  }

  if (!notice) return null;
  const isUpdate = notice.kind === "update";
  return (
    <section
      className={`pwa-update-notice ${isUpdate ? "update" : "error"}`}
      role={isUpdate ? "status" : "alert"}
      aria-live={isUpdate ? "polite" : "assertive"}
      aria-atomic="true"
    >
      <div className="pwa-update-copy">
        <strong>{isUpdate ? "FoodOS-Update verfügbar" : "Offline-Modus nicht bereit"}</strong>
        <p>{isUpdate
          ? "Aktualisiere jetzt kontrolliert auf die neue Version. Deine bestätigten Daten bleiben erhalten."
          : "Online kannst du FoodOS weiter nutzen. Versuche die Offline-Vorbereitung erneut."}</p>
      </div>
      <div className="pwa-update-actions">
        <button className="primary-button" type="button" disabled={activating} onClick={isUpdate ? activateUpdate : retryRegistration}>
          {isUpdate ? (activating ? "Update wird geladen …" : "Jetzt aktualisieren") : "Erneut versuchen"}
        </button>
        <button className="secondary-button" type="button" disabled={activating} onClick={() => setNotice(null)}>
          {isUpdate ? "Später" : "Schließen"}
        </button>
      </div>
    </section>
  );
}
