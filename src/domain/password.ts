import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const emailAddressSchema = z.email("Gib eine gültige E-Mail-Adresse ein.");

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`)
  .max(PASSWORD_MAX_LENGTH, `Das Passwort darf höchstens ${PASSWORD_MAX_LENGTH} Zeichen lang sein.`);

export const currentPasswordSchema = z
  .string()
  .min(1, "Gib dein aktuelles Passwort ein.")
  .max(PASSWORD_MAX_LENGTH, `Das Passwort darf höchstens ${PASSWORD_MAX_LENGTH} Zeichen lang sein.`);

export const passwordSignInSchema = z.object({
  email: emailAddressSchema,
  password: currentPasswordSchema
});

export const passwordSignUpSchema = z.object({
  email: emailAddressSchema,
  password: newPasswordSchema
});

const matchingPasswordFields = {
  newPassword: newPasswordSchema,
  passwordConfirmation: z.string()
};

function requireMatchingNewPassword<T extends { newPassword: string; passwordConfirmation: string }>(value: T, context: z.RefinementCtx) {
  if (value.newPassword !== value.passwordConfirmation) {
    context.addIssue({
      code: "custom",
      path: ["passwordConfirmation"],
      message: "Die neuen Passwörter stimmen nicht überein."
    });
  }
}

export const passwordResetSchema = z.object(matchingPasswordFields).superRefine(requireMatchingNewPassword);

export const passwordChangeSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    ...matchingPasswordFields,
    nonce: z.string().trim().min(1, "Gib den Sicherheitscode aus deiner E-Mail ein.").max(64).optional()
  })
  .superRefine((value, context) => {
    requireMatchingNewPassword(value, context);
    if (value.currentPassword === value.newPassword) {
      context.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "Wähle ein neues Passwort, das sich vom aktuellen unterscheidet."
      });
    }
  });
