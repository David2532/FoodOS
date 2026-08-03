# OAuth and deployment readiness — 2026-08-04

Scope: secure Google OAuth 2.0/OpenID Connect entry through Supabase Auth while
preserving the existing mandatory TOTP/AAL2 boundary before private household data.
The repository branch is `agent/foodos-mvp`; the local runner is Node 25.2.1 while the
project and CI pin Node 22.

| Gate | Result | Evidence |
|---|---|---|
| `npm install` baseline | `PASS_WITH_WARNING` | Install completed; npm reported the expected local Node 25 versus pinned Node 22 engine warning. No dependency or lockfile change is retained. |
| `npm run verify` | `PASS` | Lint, TypeScript, 14 files/45 tests and the Next.js production build passed. |
| `npm run test:coverage` | `PASS` | 93.13% statements, 89.04% branches, 98.03% functions and 97.87% lines. |
| `supabase test db` | `PASS` | 58/58 pgTAP tests passed against the local Postgres/Supabase stack. |
| `npm run test:e2e` | `PASS` | 6/6 Pixel 7 and Desktop Chrome preview tests passed, including keyboard-addressable navigation, overflow and serious/critical axe smoke. |
| `npm run test:e2e:auth` | `PASS` | 2/2: Google authorize request contains PKCE/S256, minimal OIDC scopes and an exact same-origin callback; external redirect candidates and provider details are sanitized. A real local user still must enroll and verify TOTP before AAL2 onboarding and private data access. |
| `npm audit --audit-level=high` | `PASS` | 0 vulnerabilities. |
| OAuth login visual | `REVIEWED_LOCAL` | `screenshots/auth-google-desktop.png` contains no credentials or household data. |
| Managed Supabase project and Google provider | `BLOCKED` | The local CLI has no managed-project access token. No Google client secret was requested, stored in Vercel or written to the repository. |
| Vercel production URL and remote authenticated smoke | `NOT_RUN` | A Vercel account is available, but deployment is intentionally not represented as production-ready until the managed Supabase URL/key, exact production callback and Google provider are configured. |

This evidence does not claim a successful remote Google login, production deployment,
uptime, recovery, penetration test or legal/commercial release. Those require the exact
managed environment and a post-deployment authenticated smoke test.
