import { z } from "zod";

const resetResponseSchema = z.object({
  status: z.enum(["complete", "password-updated-revocation-pending"])
});

export type PasswordResetRequestResult =
  | { kind: "complete" }
  | { kind: "revocation-required" }
  | { kind: "error" };

async function sendPasswordResetRequest(body: Record<string, string>): Promise<PasswordResetRequestResult> {
  try {
    const response = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const parsed = resetResponseSchema.safeParse(await response.json());
    if (!parsed.success) return { kind: "error" };
    if (response.ok && parsed.data.status === "complete") return { kind: "complete" };
    if (response.status === 409 && parsed.data.status === "password-updated-revocation-pending") return { kind: "revocation-required" };
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

export function updatePasswordFromRecovery(input: { newPassword: string; passwordConfirmation: string }) {
  return sendPasswordResetRequest({ action: "reset", ...input });
}

export function retryRecoverySessionRevocation() {
  return sendPasswordResetRequest({ action: "revoke" });
}
