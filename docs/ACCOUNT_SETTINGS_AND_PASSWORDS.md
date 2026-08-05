# Konto-Einstellungen und Passwort-Flows

Stand: **implementiert im Web-MVP; Produktionskonfiguration separat nachweisen.**

## Nutzerfluss

- Der rechte Konto-Button öffnet eine eigene Einstellungsansicht. Die fünf Hauptbereiche
  bleiben unverändert; Datenschutz-Dialoge werden nicht in einem weiteren Modal
  verschachtelt.
- Die Darstellung ist pro Gerät zwischen **System**, **Hell** und **Dunkel** wählbar.
  Die nicht sensible Präferenz wird validiert in Cookie und `localStorage` gespeichert,
  damit Auth- und App-Ansicht ohne sichtbaren Farbwechsel starten können. Sie wird nicht
  mit Profil- oder Ernährungsdaten synchronisiert.
- Ein Passwortwechsel ist nur im bereits AAL2-geschützten App-Bereich erreichbar. Er
  verlangt das aktuelle Passwort, nutzt mindestens zwölf Zeichen für das neue Passwort
  und unterstützt den Supabase-E-Mail-Nonce für nicht mehr frische Anmeldungen. Nach
  Erfolg werden andere Sitzungen widerrufen; falls das serverseitig fehlschlägt, zeigt
  die Oberfläche genau diesen eingeschränkten Zustand an.
- „Passwort vergessen?“ bleibt im bestehenden E-Mail-Zugang. Die Rücksetzung zeigt für
  vorhandene und nicht vorhandene Adressen denselben Erfolgstext. `/auth/confirm` leitet
  nur dann zu `/auth/passwort-zuruecksetzen`, wenn Supabase nach einem erfolgreich
  eingelösten Link einen serverseitig verifizierten JWT mit `amr.method = recovery` und
  `session_id` liefert. Ein frei gewähltes `next`, ein OAuth-Code oder eine normale
  AAL1-Passwortsitzung kann den Reset-Screen nicht öffnen.
- Das neue Passwort geht ausschließlich an die gleichartig geprüfte Server-Route. Sie
  widerruft sofort alle Auth-Sitzungen. Die Oberfläche meldet den Abschluss erst, wenn
  auch die lokale verschlüsselte Offline-Datenbank `cleared` meldet und die Browser-
  Sitzung entfernt ist. `pending` und `unconfirmed` bleiben jeweils auf einem konkreten
  Wiederholen-Pfad; FoodOS behauptet dabei keinen vollständigen Sicherheitsabschluss.
  Der nächste Zugang ist AAL1 und muss für private Daten erneut TOTP AAL2 erfüllen.
- Apple- oder Google-only-Konten erhalten im Recovery-Flow den Hinweis, ihr Passwort bei
  dem jeweiligen Anbieter zu verwalten. E-Mail, Passwörter, Nonces und Provider-
  Fehlermeldungen werden weder in URLs noch in UI-Fehlertexten oder Telemetrie ausgegeben.

## Lokale Supabase-Absicherung

`supabase/config.toml` aktiviert die Mindestlänge von zwölf Zeichen,
`secure_password_change = true`, die lokale Passwort-geändert-Benachrichtigung und nur
drei exakte lokale Callback-URLs: HTTP/HTTPS auf Port 3000 sowie HTTP für den Auth-E2E-
Server auf Port 3101. Es gibt keine Redirect-Wildcards. Die lokale Mailpit-Oberfläche
kann die Benachrichtigung sichtbar machen. Die lokale Konfiguration lässt E-Mail-
Bestätigungen weiterhin aus, damit die bestehende isolierte Auth-E2E-Suite reproduzierbar
bleibt; das ist **keine** Production-Freigabe.

## Verpflichtende Managed-Production-Konfiguration

`FOODOS_APP_ORIGIN` muss die exakte öffentliche Production-Origin ohne Pfad enthalten.
Der Passwort-Reset vergleicht den Browser-Origin ausschließlich damit und akzeptiert
keine per Request gelieferten `Host`- oder Forwarded-Origin-Informationen.

Vor einem echten Release müssen in der verwendeten EU-Supabase-Instanz nachweisbar
gesetzt und getestet werden:

1. bestätigte E-Mail-Adressen, sichere Passwortänderungen, ein Mindestwert von mindestens
   zwölf Zeichen und angemessene Auth-/Mail-Rate-Limits;
2. die exakte Production-URL und ausschließlich
   `https://<production-host>/auth/confirm` als Auth-Redirect, ohne Wildcards;
3. die Rücksetz- und Passwort-geändert-Mails über eine eigene, überwachte Maildomäne
   inklusive SPF, DKIM, DMARC, Bounce-/Complaint-Monitoring und getesteter Zustellung;
4. CAPTCHA/WAF-Entscheidung, Incident-Runbook sowie echte Recovery-, AAL1- und AAL2-
   E2E-Evidence. Ein E-Mail-Link darf niemals allein AAL2 oder Haushaltszugriff geben.

Diese Einstellungen enthalten externe Betriebsdaten und werden bewusst nicht mit
erfundenen Werten im Repository hinterlegt.
