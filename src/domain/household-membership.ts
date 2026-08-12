import { householdInviteTokenSchema, type HouseholdRole } from "@/contracts/household-membership";

export type HouseholdCapacity = {
  memberCount: number;
  memberLimit: number;
  pendingInvitationCount: number;
};

export type HouseholdMembershipAction = "invite" | "remove" | "leave" | "transfer";

export function remainingHouseholdMemberSlots(capacity: HouseholdCapacity): number {
  const used = Math.max(0, capacity.memberCount) + Math.max(0, capacity.pendingInvitationCount);
  return Math.max(0, Math.floor(capacity.memberLimit) - used);
}

export function canManageHouseholdMembers(role: HouseholdRole): boolean {
  return role === "owner";
}

export function buildHouseholdInvitationShareText(input: {
  applicationOrigin: string;
  inviteToken: string;
  expiresAt: string;
}): string {
  const token = householdInviteTokenSchema.parse(input.inviteToken);
  const origin = new URL(input.applicationOrigin);
  const isLocalHttp = origin.protocol === "http:"
    && (origin.hostname === "127.0.0.1" || origin.hostname === "localhost");
  if (origin.protocol !== "https:" && !isLocalHttp) throw new Error("Secure application origin required");
  const expiresAt = new Date(input.expiresAt);
  if (!Number.isFinite(expiresAt.getTime())) throw new Error("Valid invitation expiry required");
  const appEntry = `${origin.origin}/`;
  const expiry = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin"
  }).format(expiresAt);
  // The bearer token deliberately remains outside the URL. This keeps it out of
  // server logs, referrers and browser URL history while preserving a one-tap copy UX.
  return `FoodOS-Einladung\nÖffne ${appEntry}\nEinmaliger Code: ${token}\nGültig bis ${expiry}`;
}

const safeMembershipMessages: Record<string, string> = {
  FOODOS_AAL2_REQUIRED: "Bestätige zuerst deine Zwei-Faktor-Anmeldung.",
  FOODOS_HOUSEHOLD_OWNER_REQUIRED: "Nur die Haushaltsverwaltung darf diese Änderung ausführen.",
  FOODOS_HOUSEHOLD_ACCESS_DENIED: "Du hast keinen Zugriff mehr auf diesen Haushalt.",
  FOODOS_HOUSEHOLD_MEMBER_LIMIT: "Für weitere Mitglieder wird ein aktiver Family-Tarif benötigt.",
  FOODOS_INVITATION_INVALID: "Der Einladungscode ist ungültig, abgelaufen oder wurde bereits verwendet.",
  FOODOS_INVITATION_TTL_INVALID: "Die Gültigkeitsdauer der Einladung ist nicht zulässig.",
  FOODOS_MEMBERSHIP_ALREADY_ACTIVE: "Du gehörst diesem Haushalt bereits an.",
  FOODOS_MEMBERSHIP_NOT_ACTIVE: "Diese Mitgliedschaft ist nicht mehr aktiv.",
  FOODOS_MEMBERSHIP_REVISION_CONFLICT: "Der Mitgliederstand wurde inzwischen geändert. Lade ihn neu und prüfe die Änderung erneut.",
  FOODOS_LAST_OWNER_REQUIRED: "Übertrage zuerst die Haushaltsverwaltung, bevor du den Haushalt verlässt.",
  FOODOS_NEW_OWNER_MEMBER_LIMIT: "Die neue Haushaltsverwaltung benötigt einen aktiven Family-Tarif für diesen Haushalt.",
  FOODOS_OWNER_TRANSFER_TARGET_INVALID: "Wähle ein anderes aktives Mitglied aus."
};

export function safeHouseholdMembershipError(providerMessage: string | undefined): string {
  if (!providerMessage) return "Die Haushaltsänderung konnte nicht sicher bestätigt werden.";
  const code = Object.keys(safeMembershipMessages).find((candidate) => providerMessage.includes(candidate));
  return code ? safeMembershipMessages[code] : "Die Haushaltsänderung konnte nicht sicher bestätigt werden.";
}

export function isHouseholdAccessDenied(providerMessage: string | undefined): boolean {
  if (!providerMessage) return false;
  return [
    "FOODOS_HOUSEHOLD_ACCESS_DENIED",
    "Household access denied",
    "Batch access denied",
    "Product access denied",
    "Meal plan access denied",
    "Shopping item access denied"
  ].some((marker) => providerMessage.includes(marker));
}
