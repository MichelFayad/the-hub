@AGENTS.md

# The Hub — Architecture Map

Solo + Claude build. Full scope, no feature cuts. Token-frugal *process*.
Authoritative scope: `The Hub - Project Scope.md`.
Build plan: `docs/superpowers/specs/2026-06-23-the-hub-build-plan-design.md`.

## Stack
- Next.js 16 (App Router, TS) — one full-stack app over `src/services/`.
- PostgreSQL 16 + PostGIS via Prisma 7 with the `@prisma/adapter-pg`
  driver adapter. Client is generated (engine-less) to
  `src/generated/prisma/` (gitignored); singleton in `src/lib/db.ts`.
- Auth: NextAuth v5 (`src/auth.ts`); roles via `src/lib/auth-helpers.ts`.
- Authz: server-side `src/lib/rbac.ts` (`hasRole`/`assertRole`).
- i18n: next-intl v4, `[locale]` segment, en/ar/fr; RTL via
  `src/i18n/direction.ts`. Locale routing lives in `src/proxy.ts`
  (Next 16 renamed the `middleware` file convention to `proxy`).
- Analytics: `src/services/interaction-log.ts` (log from day one).
- Monitoring: `src/lib/monitoring.ts` (Sentry, guarded — no-ops without DSN).

## Conventions
- TDD: failing test first, then minimal impl. Vitest.
- DB-backed tests use `// @vitest-environment node` (default env is jsdom).
- One vertical slice per change; commit on green.
- Server-side RBAC on every protected action — never UI-only.
- Push to origin after every completed task.
- pnpm build scripts are opt-in via `pnpm-workspace.yaml`
  (`allowBuilds` + `onlyBuiltDependencies`).

## Commands
- `docker compose up -d` — start DB
- `pnpm test` / `pnpm typecheck` / `pnpm dev`
- `pnpm prisma migrate dev` — apply schema changes
- `pnpm prisma generate` — regenerate the client into `src/generated/prisma/`

## Phases
0 Foundations (done) · 1 Catalog+Discovery (done) · 2 Accounts+Trust
(done) · 3 Monetization (done) · 4 Intelligence (recsys prototype done,
chatbot deferred) · 5 Mobile+Hardening (API layer started).

Phase 1 services live in `src/services/`: `taxonomy` (category tree +
seed), `locations` (CRUD + localized profile view-model), `search`
(FTS + PostGIS discovery), `favorites` (favorites/lists/share links),
`import-locations` (admin bulk import). Deferred hooks noted in code:
secondary-category search, open-now (needs P2 hours schema), boosted
surfacing (P3), search GIN/GiST indexes (hardening).

Phase 3 so far: `boosts` (pay-per-boost purchase, eligibility floor,
agency discount) + `lib/payments` (provider abstraction, manual
stand-in pending gateway approval); `listings` extended with
suspend/reinstate/archive; `users` (admin suspend/reinstate, blocks
login). Shared admin assert+audit-log helper in `lib/admin-log.ts`.
`agency` (console: owned-locations list w/ per-location metrics,
aggregated dashboard + discount rate, bulk boost purchase across
locations). `analytics` (admin dashboard, §14: signup→questionnaire,
listing-claim, review-rate, search→view/view→favorite conversion,
DAU/MAU/30-day retention, boost conversion+repeat segmented
Individual vs Agency). `interaction-log.ts` is now actually called
from password-auth (LOGIN), search (SEARCH_PERFORMED), locations
(LOCATION_VIEWED), favorites (FAVORITE_ADDED), reviews
(REVIEW_SUBMITTED), boosts (BOOST_PURCHASED) — event-type strings
live in `lib/analytics-events.ts`, the single source both emitters
and `analytics.ts` read from. Phase 3 scope complete.

## Phase 4 — recsys prototype (`recsys/`)

Separate Python (3.14) package, not wired into the Next app — per
scope §8, real interaction volume is too thin to train on yet, so
this validates the pipeline end-to-end against a self-contained
synthetic dataset (never touches the live Postgres DB). `pip install
-r requirements.txt` into a venv, `pytest` to run tests, `python -m
app.evaluate` for the A/B report, `uvicorn app.api:app --reload` to
serve.

- `app/synthetic_data.py` — generates users/locations/categories +
  preference-driven implicit interactions (not pure noise).
- `app/rule_based_baseline.py` — Python mirror of
  `src/services/preferences.ts` `recommendForUser`, so the eval is a
  fair head-to-head against what's actually live in production.
- `app/hybrid_model.py` — content-based (category/budget/rating)
  blended with collaborative filtering via TruncatedSVD (scikit-learn)
  over the implicit interaction matrix. `implicit`/LightFM skipped —
  compiled C extensions, unreliable cross-platform builds.
- `app/evaluate.py` — train/test split + Precision@K/Recall@K for
  both models on identical held-out users.
- `app/api.py` — FastAPI `/recommend`, trained at startup on synthetic
  data; wiring to the real DB + a retraining schedule + live A/B is
  the deploy-time follow-up (scope §8 calls this an infra job, not a
  modeling job).

Honest current result: on synthetic data, rule-based beats the hybrid
model (precision@10 ~0.14 vs ~0.07). Expected, not a bug — §8 is
explicit the ML model needs real interaction volume to earn its
place; this prototype's job was proving the pipeline works, not
beating the baseline on fake data. Chatbot (§4.9) deferred — no LLM
provider chosen yet.

## Phase 5 — mobile API layer

Stack confirmed Next.js full-stack (not the scope doc's NestJS
suggestion — see top of file), so the API layer is Next route
handlers under `src/app/api/mobile/`, not a separate backend. Mobile
auth is bearer-JWT (`src/lib/mobile-auth.ts`, `jose`, same
`AUTH_SECRET` as the web session) since NextAuth's cookie session
doesn't fit React Native cleanly — login/register issue a 30-day
token, every other mobile route requires/accepts it via
`requireMobileUser`/`optionalMobileUser`. Shared error->status mapping
in `src/lib/api-error.ts`.

Routes so far: auth (login/register, End User only on mobile),
locations (search, profile — optional auth for view/search logging),
favorites (list/add/remove), reviews (list/submit), notifications
(list), preferences (get/save questionnaire), recommendations
(rule-based). Admin/Agency consoles and boosts are web-only by design
— management back-office, no mobile parity needed at V1.

## Phase 5 — Expo app (`mobile/`)

SDK 56, expo-router (file-based routing, the SDK's recommended
default — confirmed against the v56 docs, not assumed from training
data per `mobile/AGENTS.md`'s own warning). Standalone npm project,
not a pnpm workspace member — Metro can't easily resolve outside its
own root, so `mobile/src/api/types.ts` is a thin, deliberate DTO
duplicate of the mobile API's response shapes, not shared business
logic. `scheme: "thehub"` set in `app.json` as deep-linking prep
(Universal Links/App Links config itself not done).

- `src/api/client.ts` — fetch wrapper, `EXPO_PUBLIC_API_URL` base,
  attaches the bearer token from `setAuthToken`.
- `src/context/AuthContext.tsx` — token+user persisted via
  `expo-secure-store`; login/register/logout.
- `app/(auth)/` login+register; `app/(tabs)/` search+favorites+account;
  `app/location/[id].tsx` profile+reviews+favorite. Root `_layout.tsx`
  gates auth vs tabs.

**Verification ceiling in this environment:** no device/simulator, no
Xcode/Android Studio, and `expo export -p web` is blocked by an
upstream SDK56 react-native-web/react-dom peer-dep conflict (not our
code) — web support dependency was dropped rather than forced with
`--legacy-peer-deps`. Verified via `tsc --noEmit` (clean) and
`expo-doctor` (21/21 checks pass). Actually running the app on a
device/simulator is unverified and is the next thing to do once that
environment exists.
