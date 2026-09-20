# API.md — API Contracts (Recovered from Code and `AGENTS.md`)
Status: Verified. Not aspirational. Routes listed from `AGENTS.md:120-125` and confirmed by `src/app/` directory references.

## Auth Routes (`src/app/auth/`)

| Method | Path | Source / Note |
|---|---|---|
| POST | `/auth/signin` | `AGENTS.md:121` |
| POST | `/auth/signup` | `AGENTS.md:121` |
| POST | `/auth/signout` | `AGENTS.md:121` |
| POST | `/auth/refresh` | `AGENTS.md:121` |
| GET/POST | `/auth/sessions` | `AGENTS.md:121` |
| POST | `/auth/mfa` (enable/verify) | `AGENTS.md:121` |
| POST | `/auth/verification` | `AGENTS.md:121` |
| POST | `/auth/password-reset` (request/reset) | `AGENTS.md:121` |

## User Routes (`src/app/users/`)

| Method | Path | Source / Note |
|---|---|---|
| GET | `/users/me` | `AGENTS.md:123` |
| GET/POST | `/users/admin` | `AGENTS.md:123` |

## Organization Routes (`src/app/orgs/`)

| Method | Path | Source / Note |
|---|---|---|
| GET | `/orgs` | `AGENTS.md:124` |
| POST | `/orgs` | `AGENTS.md:124` |
| GET/POST | `/orgs/members` | `AGENTS.md:124` |
| POST | `/orgs/roles` | `AGENTS.md:124` |

## API Key Routes (`src/app/api-keys/`)

| Method | Path | Source / Note |
|---|---|---|
| POST | `/api-keys` (create) | `AGENTS.md:125` |
| GET | `/api-keys` (list) | `AGENTS.md:125` |
| POST | `/api-keys/:id/rotate` | `AGENTS.md:125` |
| DELETE | `/api-keys/:id` | `AGENTS.md:125` |

## Response Envelope (verified by `AGENTS.md`)

Success: `{ data: T, meta?: object }`
Error: `{ error: { code: string, message: string, details?: any } }`

Every 500 is opaque by default (`AGENTS.md:181`). `NWB_DEBUG_ERRORS=1` reveals exception and stack.

## Auth Mechanism (verified by `AGENTS.md`)

- Cookie-first: `nawebeus_access` (path `/`) and `nawebeus_refresh` (path `/api/auth`).
- Bearer alternative: `Authorization: Bearer nwb_<env>_<publicKey>_<secret>` (`AGENTS.md:171`).
- Bearer takes precedence over cookie.

## Middleware Chain (verified by `AGENTS.md`)

- `auth.ts`: session-cookie OR API-key Bearer verification + CASL ability load.
- `rbac.ts`: `requireAbility(action, subject)` guard.
- `org-match.ts`: `:orgId` URL param vs JWT `orgId` check.
- `error-handler.ts`: maps non-`AppError` to generic `INTERNAL_ERROR`.
