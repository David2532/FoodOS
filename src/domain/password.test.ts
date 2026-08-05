import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH, emailAddressSchema, newPasswordSchema, passwordChangeSchema, passwordResetSchema, passwordSignInSchema, passwordSignUpSchema } from "./password";

describe("password contracts", () => {
  it("uses the configured twelve-character minimum consistently", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(newPasswordSchema.safeParse("short-password").success).toBe(true);
    expect(newPasswordSchema.safeParse("too-short").success).toBe(false);
  });

  it("requires a valid email address before a recovery request is sent", () => {
    expect(emailAddressSchema.safeParse("not-an-email").success).toBe(false);
    expect(emailAddressSchema.safeParse("person@example.test").success).toBe(true);
  });

  it("allows an existing password to be checked on sign-in while enforcing the stronger rule on registration", () => {
    expect(passwordSignInSchema.safeParse({ email: "person@example.test", password: "existing" }).success).toBe(true);
    expect(passwordSignUpSchema.safeParse({ email: "person@example.test", password: "existing" }).success).toBe(false);
  });

  it("keeps a reset form open when the confirmations differ", () => {
    const result = passwordResetSchema.safeParse({
      newPassword: "A-strong-password",
      passwordConfirmation: "A-different-password"
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["passwordConfirmation"]);
  });

  it("rejects a reused current password while allowing an optional reauthentication nonce", () => {
    expect(passwordChangeSchema.safeParse({
      currentPassword: "A-strong-password",
      newPassword: "A-strong-password",
      passwordConfirmation: "A-strong-password"
    }).success).toBe(false);

    expect(passwordChangeSchema.safeParse({
      currentPassword: "A-strong-password",
      newPassword: "A-new-strong-password",
      passwordConfirmation: "A-new-strong-password",
      nonce: "834201"
    }).success).toBe(true);
  });
});
