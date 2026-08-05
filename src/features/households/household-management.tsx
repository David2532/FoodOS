"use client";

import { useState } from "react";
import { Check, Clipboard, Crown, DoorOpen, Link2, LoaderCircle, ShieldCheck, UserMinus, Users } from "lucide-react";
import type {
  CreatedHouseholdInvitation,
  HouseholdMemberRow,
  HouseholdSummaryRow,
  PendingHouseholdInvitationRow
} from "@/contracts/household-membership";
import {
  buildHouseholdInvitationShareText,
  canManageHouseholdMembers,
  remainingHouseholdMemberSlots
} from "@/domain/household-membership";
import {
  createHouseholdInvitation,
  leaveHousehold,
  removeHouseholdMember,
  revokeHouseholdInvitation,
  selectHousehold,
  transferHouseholdOwnership
} from "@/infrastructure/household-membership-client";
import { purgeOfflineHouseholdData } from "@/infrastructure/offline-outbox";

type HouseholdManagementProps = {
  currentUserId: string;
  currentHouseholdId: string;
  households: HouseholdSummaryRow[];
  members: HouseholdMemberRow[];
  pendingInvitations: PendingHouseholdInvitationRow[];
  onChanged: () => void;
};

type UiState =
  | { kind: "idle" }
  | { kind: "busy"; action: string }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

function memberLabel(member: HouseholdMemberRow, currentUserId: string): string {
  if (member.user_id === currentUserId) return member.display_name ? `${member.display_name} (du)` : "Du";
  return member.display_name ?? "FoodOS-Mitglied";
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin"
  }).format(new Date(value));
}

export function HouseholdManagement({
  currentUserId,
  currentHouseholdId,
  households,
  members,
  pendingInvitations,
  onChanged
}: HouseholdManagementProps) {
  const current = households.find((household) => household.household_id === currentHouseholdId);
  const [revision, setRevision] = useState(current?.membership_revision ?? 1);
  const [ui, setUi] = useState<UiState>({ kind: "idle" });
  const [oneTimeInvitation, setOneTimeInvitation] = useState<CreatedHouseholdInvitation | null>(null);
  const [copied, setCopied] = useState(false);
  if (!current) return <p className="auth-message error" role="alert">Der ausgewählte Haushalt ist nicht mehr verfügbar.</p>;
  const selectedHousehold: HouseholdSummaryRow = current;

  const owner = canManageHouseholdMembers(selectedHousehold.member_role);
  const remainingSlots = remainingHouseholdMemberSlots({
    memberCount: selectedHousehold.member_count,
    memberLimit: selectedHousehold.member_limit,
    pendingInvitationCount: pendingInvitations.length
  });
  const busy = ui.kind === "busy";

  async function run(action: string, task: () => Promise<number>, successMessage: string) {
    setUi({ kind: "busy", action });
    try {
      const nextRevision = await task();
      setRevision(nextRevision);
      setUi({ kind: "success", message: successMessage });
      onChanged();
    } catch (error) {
      setUi({ kind: "error", message: error instanceof Error ? error.message : "Die Änderung konnte nicht sicher bestätigt werden." });
    }
  }

  async function createInvitation() {
    setUi({ kind: "busy", action: "invite" });
    setOneTimeInvitation(null);
    setCopied(false);
    try {
      const invitation = await createHouseholdInvitation({
        householdId: selectedHousehold.household_id,
        expectedRevision: revision
      });
      setRevision(invitation.membership_revision);
      setOneTimeInvitation(invitation);
      setUi({ kind: "success", message: "Der einmalige Einladungscode wurde erstellt. Er wird nach Verlassen dieser Ansicht nicht gespeichert." });
      onChanged();
    } catch (error) {
      setUi({ kind: "error", message: error instanceof Error ? error.message : "Die Einladung konnte nicht sicher erstellt werden." });
    }
  }

  async function leaveCurrentHousehold() {
    setUi({ kind: "busy", action: "leave" });
    let serverRevision: number | null = null;
    try {
      serverRevision = await leaveHousehold({
        householdId: selectedHousehold.household_id,
        expectedRevision: revision
      });
      const cleanup = await purgeOfflineHouseholdData(selectedHousehold.household_id);
      setRevision(serverRevision);
      setUi(cleanup.unreadable === 0
        ? { kind: "success", message: "Du hast den Haushalt verlassen. Seine lokalen Offline-Änderungen wurden entfernt." }
        : { kind: "error", message: "Du hast den Haushalt verlassen. Beschädigte Browserdaten konnten nicht sicher einem Haushalt zugeordnet werden; sie werden nicht synchronisiert." });
      onChanged();
    } catch (error) {
      if (serverRevision !== null) {
        setRevision(serverRevision);
        setUi({ kind: "error", message: "Du hast den Haushalt verlassen. Die lokale Bereinigung konnte auf diesem Gerät noch nicht bestätigt werden; beim Aktualisieren wird sie erneut geprüft." });
        onChanged();
        return;
      }
      setUi({ kind: "error", message: error instanceof Error ? error.message : "Der Haushalt konnte nicht sicher verlassen werden." });
    }
  }

  async function copyInvitation() {
    if (!oneTimeInvitation) return;
    try {
      await navigator.clipboard.writeText(buildHouseholdInvitationShareText({
        applicationOrigin: window.location.origin,
        inviteToken: oneTimeInvitation.invite_token,
        expiresAt: oneTimeInvitation.expires_at
      }));
      setCopied(true);
      setUi({ kind: "success", message: "Einladung kopiert. Der Code steht getrennt von der Webadresse und gelangt nicht in URL oder Serverlogs." });
    } catch {
      setCopied(false);
      setUi({ kind: "error", message: "Kopieren ist in diesem Browser nicht verfügbar. Markiere den einmaligen Code manuell." });
    }
  }

  return (
    <section className="settings-card household-management" aria-labelledby="household-management-title">
      <div className="settings-section-heading">
        <span>Gemeinsam und getrennt geschützt</span>
        <h3 id="household-management-title"><Users size={18} aria-hidden="true" /> Haushalt und Mitglieder</h3>
      </div>

      {households.length > 1 ? <label className="household-selector">
        <span>Aktiver Haushalt</span>
        <select
          value={selectedHousehold.household_id}
          disabled={busy}
          onChange={async (event) => {
            const nextHousehold = event.currentTarget.value;
            setUi({ kind: "busy", action: "switch" });
            try {
              await selectHousehold(nextHousehold);
              onChanged();
            } catch (error) {
              setUi({ kind: "error", message: error instanceof Error ? error.message : "Der Haushalt konnte nicht gewechselt werden." });
            }
          }}
        >
          {households.map((household) => <option key={household.household_id} value={household.household_id}>{household.household_name}</option>)}
        </select>
      </label> : <div className="household-current"><ShieldCheck size={18} aria-hidden="true" /><span><strong>{selectedHousehold.household_name}</strong><small>{selectedHousehold.member_count} von {selectedHousehold.member_limit} Plätzen belegt</small></span></div>}

      <ul className="household-member-list" aria-label="Aktive Haushaltsmitglieder">
        {members.map((member) => <li key={member.user_id}>
          <div className="household-member-copy">
            {member.member_role === "owner" ? <Crown size={17} aria-label="Haushaltsverwaltung" /> : <Users size={17} aria-hidden="true" />}
            <span><strong>{memberLabel(member, currentUserId)}</strong><small>{member.member_role === "owner" ? "Verwaltung" : "Mitglied"} · seit {shortDate(member.joined_at)}</small></span>
          </div>
          {owner && member.user_id !== currentUserId ? <div className="household-member-actions">
            <button type="button" disabled={busy} onClick={() => {
              if (!window.confirm(`${memberLabel(member, currentUserId)} wirklich zur Haushaltsverwaltung machen?`)) return;
              void run("transfer", () => transferHouseholdOwnership({
                householdId: selectedHousehold.household_id,
                userId: member.user_id,
                expectedRevision: revision
              }), "Die Haushaltsverwaltung wurde sicher übertragen.");
            }}><Crown size={15} aria-hidden="true" /> Übertragen</button>
            <button type="button" className="danger" disabled={busy} onClick={() => {
              if (!window.confirm(`${memberLabel(member, currentUserId)} wirklich entfernen? Lokale Änderungen dieses Kontos werden beim nächsten Serverkontakt verworfen.`)) return;
              void run("remove", () => removeHouseholdMember({
                householdId: selectedHousehold.household_id,
                userId: member.user_id,
                expectedRevision: revision
              }), "Das Mitglied wurde entfernt und der Zugriff serverseitig gesperrt.");
            }}><UserMinus size={15} aria-hidden="true" /> Entfernen</button>
          </div> : null}
        </li>)}
      </ul>

      {owner ? <div className="household-invitations">
        <div className="household-invite-heading"><div><strong>Sicher einladen</strong><small>Ein Code ist höchstens 24 Stunden gültig und nur einmal nutzbar.</small></div><button className="secondary-button" type="button" disabled={busy || remainingSlots === 0} onClick={() => void createInvitation()}>{ui.kind === "busy" && ui.action === "invite" ? <LoaderCircle className="spin" size={16} /> : <Link2 size={16} />} Code erstellen</button></div>
        {remainingSlots === 0 ? <p className="settings-form-copy">{selectedHousehold.member_limit === 1 ? "Gemeinsame Haushalte sind im aktiven Tarif geschlossen. Dafür ist Family erforderlich." : "Alle verfügbaren Plätze oder Einladungen sind vergeben."}</p> : null}
        {oneTimeInvitation ? <div className="household-invite-secret" role="group" aria-label="Einmaliger Einladungscode">
          <p><strong>Nur jetzt sichtbar</strong><span>Gültig bis {shortDate(oneTimeInvitation.expires_at)}</span></p>
          <code>{oneTimeInvitation.invite_token}</code>
          <button type="button" onClick={() => void copyInvitation()}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "Kopiert" : "Einladung kopieren"}</button>
        </div> : null}
        {pendingInvitations.length ? <ul className="household-pending-list" aria-label="Offene Einladungen">{pendingInvitations.map((invitation) => <li key={invitation.invitation_id}><span><strong>Offene Einladung</strong><small>bis {shortDate(invitation.expires_at)}</small></span><button type="button" disabled={busy} onClick={() => void run("revoke", () => revokeHouseholdInvitation({ householdId: selectedHousehold.household_id, invitationId: invitation.invitation_id, expectedRevision: revision }), "Die Einladung wurde widerrufen.")}>Widerrufen</button></li>)}</ul> : null}
      </div> : <button className="settings-action danger" type="button" disabled={busy} onClick={() => {
        if (!window.confirm("Diesen Haushalt wirklich verlassen? Dein Zugriff und nicht synchronisierte lokale Änderungen dieses Haushalts werden entfernt.")) return;
        void leaveCurrentHousehold();
      }}><DoorOpen aria-hidden="true" /><span><strong>Haushalt verlassen</strong><small>Entfernt deinen Zugriff; die gemeinsamen Daten bleiben beim Haushalt.</small></span></button>}

      {ui.kind === "error" ? <p className="auth-message error" role="alert">{ui.message}</p> : null}
      {ui.kind === "success" ? <p className="auth-message success" role="status">{ui.message}</p> : null}
    </section>
  );
}
