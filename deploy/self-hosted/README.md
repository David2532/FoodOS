# FoodOS self-hosted deployment

This directory documents the portable production target. The FoodOS application image
is defined by the root `Dockerfile`. Authentication/database/storage must use a pinned
copy of the official Supabase Docker distribution, not an improvised reduced Compose
file in this repository.

## Supported production shape

1. Provision a supported EU Linux VM. Supabase currently documents at least 4 GB RAM,
   2 CPU cores, and 40 GB SSD as minimum; commercial headroom and monitoring require
   more. Confirm the current requirement before provisioning.
2. Obtain and pin the official Supabase Docker directory from
   <https://github.com/supabase/supabase/tree/master/docker> to a reviewed commit/release.
3. Follow <https://supabase.com/docs/guides/self-hosting/docker>, generate every secret,
   configure SMTP and public URLs, and never use the example secrets.
4. Copy `.env.example` to a non-versioned `.env`, set the public Supabase endpoint/key,
   then run `docker compose -f compose.foodos.yaml build` and
   `docker compose -f compose.foodos.yaml up -d`. The app connects to Supabase through
   its HTTPS gateway. Service-role credentials are added only to separate server jobs
   that demonstrably need them.
5. Put a TLS reverse proxy/load balancer in front. Expose only 80/443; keep Postgres,
   Studio, metrics, storage internals, and Docker APIs private.
6. Apply `supabase/migrations/` using the official migration tooling, then run the AAL1,
   AAL2, two-household, scan/save, export/deletion, backup/restore smoke suite.

## Environment names for the app container

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `OPEN_FOOD_FACTS_USER_AGENT`
- `SUPABASE_SERVICE_ROLE_KEY` only for narrow server-side jobs, never client code

Next public values are embedded during the Next.js build; build the production image
with the final public endpoint/key or adopt an audited runtime-configuration layer.

## Required runbooks before production

- secret generation/rotation and leaked-secret response;
- SMTP deliverability and abuse/rate-limit handling;
- daily encrypted backup plus clean-machine restore test;
- pinned Supabase/FoodOS update, rollback, migration compatibility, and downtime plan;
- alerting, patch SLA, capacity, certificate renewal, incident and GDPR breach workflow;
- deletion propagation and backup tombstone handling.

The complete acceptance contract is in `plans/AUTH_AND_SELF_HOSTING.md`. This directory
is intentionally not labeled “one-command production” until a clean VM install and a
destructive restore drill have passed against an exact pinned Supabase revision.
