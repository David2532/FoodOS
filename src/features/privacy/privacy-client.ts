"use client";

import { z } from "zod";
import { parseCurrentPrivacyChoices, privacyChoicesSchema, type PrivacyChoices } from "@/domain/privacy";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const STAGED_PRIVACY_KEY = "foodos:privacy-choice:v1";
const stagedPrivacySchema = z.object({ choices: privacyChoicesSchema, clientMutationId: z.uuid() });

export interface StagedPrivacyChoice {
  choices: PrivacyChoices;
  clientMutationId: string;
}

export function readStagedPrivacyChoice(): StagedPrivacyChoice | null {
  try {
    const value = localStorage.getItem(STAGED_PRIVACY_KEY);
    if (!value) return null;
    return stagedPrivacySchema.safeParse(JSON.parse(value)).data ?? null;
  } catch {
    return null;
  }
}

export function clearStagedPrivacyChoice(): void {
  try {
    localStorage.removeItem(STAGED_PRIVACY_KEY);
  } catch {
    // Browser storage can be unavailable in hardened/private contexts.
  }
}

export function stagePrivacyChoice(value: unknown): StagedPrivacyChoice | null {
  const choices = parseCurrentPrivacyChoices(value);
  if (!choices) return null;
  const staged = { choices, clientMutationId: crypto.randomUUID() };
  try {
    localStorage.setItem(STAGED_PRIVACY_KEY, JSON.stringify(staged));
  } catch {
    // The authenticated gate will ask again when browser storage is unavailable.
  }
  return staged;
}

export async function persistPrivacyChoice(staged: StagedPrivacyChoice): Promise<{ ok: true; eventId: string } | { ok: false; message: string }> {
  const result = await getSupabaseBrowserClient().rpc("record_privacy_choices", {
    p_notice_version: staged.choices.noticeVersion,
    p_age_confirmed: staged.choices.ageConfirmed,
    p_terms_accepted: staged.choices.termsAccepted,
    p_sensitive_profile: staged.choices.sensitiveProfile,
    p_analytics: staged.choices.analytics,
    p_marketing: staged.choices.marketing,
    p_image_cloud_processing: staged.choices.imageCloudProcessing,
    p_off_contribution: staged.choices.offContribution,
    p_advertising: staged.choices.advertising,
    p_client_mutation_id: staged.clientMutationId
  });
  if (result.error) return { ok: false, message: "Deine Auswahl konnte nicht sicher gespeichert werden. Versuche es erneut." };
  const eventId = z.uuid().safeParse(result.data);
  return eventId.success
    ? { ok: true, eventId: eventId.data }
    : { ok: false, message: "Die Bestätigung des Datenschutz-Eintrags war unvollständig." };
}
