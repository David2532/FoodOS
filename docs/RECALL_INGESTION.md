# Amtliche Rückruf-Ingestion

FoodOS verwendet ausschließlich den von `lebensmittelwarnung.de` offiziell angebotenen
RSS-Zugang und die dort verlinkten Meldungsdetailseiten. Das Portal wird von den
Bundesländern und dem Bundesamt für Verbraucherschutz und Lebensmittelsicherheit (BVL)
für öffentliche Meldungen genutzt. Der Adapter akzeptiert nur HTTPS-Links unter dem
festen Authority-Origin und filtert Detailseiten auf den Produkttyp `Lebensmittel`.

## Fail-closed-Freigabe

Migration `0011_official_recall_ingestion.sql` registriert die Quelle bewusst mit
`approved = false` und ohne `license_reviewed_at`. Der Cron-Endpunkt antwortet bis zur
dokumentierten Quellen-, Nutzungs- und Coverage-Prüfung mit HTTP 409 und lädt keine
Daten. Nach einer echten Prüfung setzt ein berechtigter Betreiber in Supabase genau für
`de-lebensmittelwarnung-rss` `approved = true` und `license_reviewed_at` auf den
Prüfzeitpunkt. Diese Freigabe ist keine Behauptung vollständiger Rückrufabdeckung.

## Betrieb

Server-only benötigt werden:

- `CRON_SECRET` für `Authorization: Bearer …`;
- `SUPABASE_SERVICE_ROLE_KEY` ausschließlich im Server-Secret-Store;
- `RECALL_USER_AGENT` mit überwachter Kontaktadresse.

Vercel ruft `/api/jobs/recalls` täglich um 04:17 UTC auf. Der Job lädt zuerst den RSS-
Feed, validiert anschließend alle referenzierten Detailseiten und persistiert erst danach
Datensätze. Jeder Datensatz enthält Quell-ID, Abruf-/Publikationszeit, Parser-Version,
SHA-256 und den unveränderten Feed-/Detail-Rohbeleg. Derselbe Hash ist ein Replay; ein
geänderter Hash erzeugt eine neue Version und markiert die alte Version als korrigiert/
superseded. Ein Fetch-, Parse- oder Persistenzfehler setzt einen Fehlercode und darf nicht
als „kein Rückruf“ oder als erfolgreiche Aktualisierung erscheinen.

## Verifizierter Stand

Am 02.08.2026 antwortete der veröffentlichte Gesamtfeed unter
`https://www.lebensmittelwarnung.de/___LMW-Redaktion/RSSNewsfeed/Functions/RssFeeds/rssnewsfeed_Alle_DE.xml`
lokal mit HTTP 200 und `text/xml`. Das ist Connectivity-/Format-Evidence, keine
Produktions-Ingestion: Die Registry-Freigabe und ein Remote-Deployment stehen aus.
