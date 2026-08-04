import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { parseCurrentPrivacyChoices, type PrivacyChoices } from "@/domain/privacy";

const privacyRowSchema = z.object({
  notice_version: z.string(),
  age_confirmed: z.boolean(),
  terms_accepted: z.boolean(),
  sensitive_profile: z.boolean(),
  analytics: z.boolean(),
  marketing: z.boolean(),
  image_cloud_processing: z.boolean(),
  off_contribution: z.boolean(),
  advertising: z.boolean()
});

export type PrivacyLoadResult =
  | { kind: "required" }
  | { kind: "ready"; choices: PrivacyChoices }
  | { kind: "error"; message: string };

export async function loadCurrentPrivacyChoices(supabase: SupabaseClient): Promise<PrivacyLoadResult> {
  const result = await supabase
    .from("privacy_choice_events")
    .select("notice_version, age_confirmed, terms_accepted, sensitive_profile, analytics, marketing, image_cloud_processing, off_contribution, advertising")
    .order("event_sequence", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) return { kind: "error", message: "Deine Datenschutz-Auswahl konnte nicht geladen werden." };
  if (!result.data) return { kind: "required" };
  const row = privacyRowSchema.safeParse(result.data);
  if (!row.success) return { kind: "error", message: "Der Datenschutz-Datensatz hat ein unerwartetes Format." };
  const choices = parseCurrentPrivacyChoices({
    noticeVersion: row.data.notice_version,
    ageConfirmed: row.data.age_confirmed,
    termsAccepted: row.data.terms_accepted,
    sensitiveProfile: row.data.sensitive_profile,
    analytics: row.data.analytics,
    marketing: row.data.marketing,
    imageCloudProcessing: row.data.image_cloud_processing,
    offContribution: row.data.off_contribution,
    advertising: row.data.advertising
  });
  return choices ? { kind: "ready", choices } : { kind: "required" };
}
