/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PwaRegistration } from "./pwa-registration";

class WorkerStub extends EventTarget {
  state: ServiceWorkerState = "installed";
  postMessage = vi.fn();
}

class RegistrationStub extends EventTarget {
  installing: ServiceWorker | null = null;
  waiting: ServiceWorker | null;

  constructor(waiting: ServiceWorker | null) {
    super();
    this.waiting = waiting;
  }
}

class ServiceWorkerContainerStub extends EventTarget {
  controller: ServiceWorker | null;
  getRegistrations = vi.fn().mockResolvedValue([]);
  register: ReturnType<typeof vi.fn>;

  constructor(registration: ServiceWorkerRegistration, controlled = true) {
    super();
    this.controller = controlled ? new WorkerStub() as unknown as ServiceWorker : null;
    this.register = vi.fn().mockResolvedValue(registration);
  }
}

function useServiceWorker(container: ServiceWorkerContainerStub) {
  vi.stubGlobal("navigator", { serviceWorker: container });
}

describe("PwaRegistration", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("removes stale production workers in development without surfacing unregister failures", async () => {
    const unregister = vi.fn().mockRejectedValue(new Error("already gone"));
    const registration = new RegistrationStub(null) as unknown as ServiceWorkerRegistration;
    const container = new ServiceWorkerContainerStub(registration);
    container.getRegistrations.mockResolvedValue([{ unregister }] as unknown as ServiceWorkerRegistration[]);
    useServiceWorker(container);

    render(<PwaRegistration />);

    await waitFor(() => expect(container.getRegistrations).toHaveBeenCalledOnce());
    await waitFor(() => expect(unregister).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers a controlled update and reloads only once after the worker takes control", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const waitingWorker = new WorkerStub();
    const registration = new RegistrationStub(waitingWorker as unknown as ServiceWorker) as unknown as ServiceWorkerRegistration;
    const container = new ServiceWorkerContainerStub(registration);
    const reload = vi.fn();
    useServiceWorker(container);

    render(<PwaRegistration reload={reload} />);

    expect((await screen.findByRole("status")).textContent).toContain("FoodOS-Update verfügbar");
    fireEvent.click(screen.getByRole("button", { name: "Jetzt aktualisieren" }));
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    container.dispatchEvent(new Event("controllerchange"));
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("shows a recoverable error and retries registration", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const registration = new RegistrationStub(null) as unknown as ServiceWorkerRegistration;
    const container = new ServiceWorkerContainerStub(registration);
    container.register.mockRejectedValueOnce(new Error("registration failed")).mockResolvedValueOnce(registration);
    useServiceWorker(container);

    render(<PwaRegistration reload={vi.fn()} />);

    expect((await screen.findByRole("alert")).textContent).toContain("Offline-Modus nicht bereit");
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    await waitFor(() => expect(container.register).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
