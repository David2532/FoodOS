import { z } from "zod";

export const PRIVACY_NOTICE_VERSION = "2026-08-04.de-1";

export const privacyChoicesSchema = z.object({
  noticeVersion: z.literal(PRIVACY_NOTICE_VERSION),
  ageConfirmed: z.literal(true),
  termsAccepted: z.literal(true),
  sensitiveProfile: z.boolean(),
  analytics: z.boolean(),
  marketing: z.boolean(),
  imageCloudProcessing: z.boolean(),
  offContribution: z.boolean(),
  advertising: z.boolean()
}).strict();

export type PrivacyChoices = z.infer<typeof privacyChoicesSchema>;

export function necessaryOnlyPrivacyChoices(): PrivacyChoices {
  return {
    noticeVersion: PRIVACY_NOTICE_VERSION,
    ageConfirmed: true,
    termsAccepted: true,
    sensitiveProfile: false,
    analytics: false,
    marketing: false,
    imageCloudProcessing: false,
    offContribution: false,
    advertising: false
  };
}

export function parseCurrentPrivacyChoices(value: unknown): PrivacyChoices | null {
  const parsed = privacyChoicesSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
