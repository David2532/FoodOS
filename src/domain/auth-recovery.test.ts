import { describe, expect, it } from "vitest";
import { isRecoverySessionClaims } from "./auth-recovery";

describe("recovery session claims", () => {
  it("accepts the signed Supabase recovery AMR only when it is bound to a user and session", () => {
    expect(isRecoverySessionClaims({
      sub: "35d50d20-8aec-4ec2-9f8a-0f040ea542b0",
      session_id: "1989e9e9-3325-4d16-80f3-3f35c6c02a1d",
      amr: [{ method: "recovery", timestamp: 1_785_843_422 }]
    })).toBe(true);
  });

  it("does not treat a normal AAL1 password session as password recovery", () => {
    expect(isRecoverySessionClaims({
      sub: "35d50d20-8aec-4ec2-9f8a-0f040ea542b0",
      session_id: "1989e9e9-3325-4d16-80f3-3f35c6c02a1d",
      amr: [{ method: "password", timestamp: 1_785_843_422 }]
    })).toBe(false);
  });

  it("rejects incomplete or malformed provenance", () => {
    expect(isRecoverySessionClaims({
      sub: "35d50d20-8aec-4ec2-9f8a-0f040ea542b0",
      session_id: "",
      amr: ["recovery"]
    })).toBe(false);
    expect(isRecoverySessionClaims(null)).toBe(false);
  });
});
