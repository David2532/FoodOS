export type PasswordResetSessionFinalization =
  | "complete"
  | "offline-cleanup-pending"
  | "offline-cleanup-unconfirmed"
  | "local-sign-out-required";

export type PasswordResetOfflineCleanupResult =
  | { status: "cleared" }
  | { status: "pending" }
  | { status: "unconfirmed" };

export interface PasswordResetDeviceFinalizer {
  clearOfflineData: () => Promise<PasswordResetOfflineCleanupResult>;
  clearCurrentDeviceSession: () => Promise<boolean>;
}

async function offlineCleanupState(clearOfflineData: () => Promise<PasswordResetOfflineCleanupResult>): Promise<PasswordResetSessionFinalization | null> {
  try {
    const result = await clearOfflineData();
    if (result.status === "cleared") return null;
    return result.status === "pending" ? "offline-cleanup-pending" : "offline-cleanup-unconfirmed";
  } catch {
    return "offline-cleanup-unconfirmed";
  }
}

/** The server has already confirmed global revocation before this is called. */
export async function finalizePasswordResetSessions(finalizer: PasswordResetDeviceFinalizer): Promise<PasswordResetSessionFinalization> {
  const cleanup = await offlineCleanupState(finalizer.clearOfflineData);
  if (cleanup) return cleanup;
  try {
    return (await finalizer.clearCurrentDeviceSession()) ? "complete" : "local-sign-out-required";
  } catch {
    return "local-sign-out-required";
  }
}
