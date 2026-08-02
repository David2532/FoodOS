# FoodOS security policy

FoodOS is pre-commercial and this repository is intended to remain private while the
security, privacy, food-data and release controls are implemented and independently
reviewed.

## Report a vulnerability

Do not open a normal issue or include a vulnerability in a public discussion. Use the
repository's GitHub **Security → Report a vulnerability** private reporting flow. If
private vulnerability reporting is not enabled, contact the repository owner through a
previously verified private channel and share only enough information to establish a
secure reporting path.

Do not send credentials, authentication factors, production database exports or real
FoodOS user data as proof. Use a minimal fictional account/fixture and redact tokens,
cookies, personal/product/date/health data and infrastructure secrets.

## Useful report content

- affected commit/version/environment and platform;
- vulnerability class and concrete security impact;
- reproducible steps with the smallest safe proof;
- required account/role/AAL level and whether another household is affected;
- relevant request/response shape with sensitive values removed;
- suggested mitigation if known;
- whether disclosure timing or active exploitation creates urgency.

Do not test against accounts or households you do not own, disrupt service, access more
data than needed, persist access, exfiltrate data, run denial-of-service/load attacks or
contact affected users.

## Response expectations

No public response-time SLA is promised until an accountable security contact and
on-call process are operational. The owner should acknowledge a valid private report,
set a severity/owner, preserve evidence, contain the issue, build a regression test,
rotate/revoke affected secrets or sessions, and coordinate disclosure only after users
and systems are protected.

Potential personal-data breaches, unsafe food-date/recall behavior, cross-household
access, MFA recovery bypass, payment/entitlement abuse, signed-update compromise and
deletion/backup resurrection follow the incident and legal-assessment process in the
repository plans. Do not make a legal or safety conclusion from this file alone.

## Supported versions

There is no commercially supported public release yet. Only the current protected main
line and explicitly active beta builds receive planned security fixes. Old previews,
local builds and superseded beta artifacts are unsupported and must not be represented as
production-safe.

## Security development baseline

- mandatory AAL2/TOTP for private household data and tested Supabase RLS isolation;
- no service-role, signing or production secret in web/native bundles;
- strict validation and least-privilege provider/service jobs;
- idempotent transactional mutations and durable deletion tombstones;
- typed allowlisted telemetry with forbidden sensitive fields;
- dependency, SAST/secret, API/database, mobile, privacy and restore testing as defined in
  `plans/QUALITY_ENGINEERING_PLAN.md`;
- staged releases, signed artifacts/updates, kill switches, rollback and evidence binding;
- accepted risk has an owner, compensating control and expiry.
