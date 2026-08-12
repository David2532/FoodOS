import { describe, expect, it, vi } from "vitest";
import { finalizePasswordResetSessions } from "./password-reset-session";

describe("password-reset session finalization", () => {
  it("only reports completion after offline data and the local session were both cleared", async () => {
    const clearOfflineData = vi.fn(async () => ({ status: "cleared" as const }));
    const clearCurrentDeviceSession = vi.fn(async () => true);

    await expect(finalizePasswordResetSessions({ clearOfflineData, clearCurrentDeviceSession })).resolves.toBe("complete");
    expect(clearOfflineData).toHaveBeenCalledOnce();
    expect(clearCurrentDeviceSession).toHaveBeenCalledOnce();
  });

  it("does not claim completion when another tab still blocks offline data removal", async () => {
    const clearOfflineData = vi.fn(async () => ({ status: "pending" as const }));
    const clearCurrentDeviceSession = vi.fn(async () => true);

    await expect(finalizePasswordResetSessions({ clearOfflineData, clearCurrentDeviceSession })).resolves.toBe("offline-cleanup-pending");
    expect(clearCurrentDeviceSession).not.toHaveBeenCalled();
  });

  it("keeps an explicit retry state when removal cannot be confirmed", async () => {
    const clearOfflineData = vi.fn(async () => ({ status: "unconfirmed" as const }));
    const clearCurrentDeviceSession = vi.fn(async () => true);

    await expect(finalizePasswordResetSessions({ clearOfflineData, clearCurrentDeviceSession })).resolves.toBe("offline-cleanup-unconfirmed");
    expect(clearCurrentDeviceSession).not.toHaveBeenCalled();
  });

  it("keeps a retry path when browser session removal cannot be confirmed", async () => {
    const clearOfflineData = vi.fn(async () => ({ status: "cleared" as const }));
    const clearCurrentDeviceSession = vi.fn(async () => false);

    await expect(finalizePasswordResetSessions({ clearOfflineData, clearCurrentDeviceSession })).resolves.toBe("local-sign-out-required");
  });
});
