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
0 Foundations (done) · 1 Catalog+Discovery (done) · 2 Accounts+Trust ·
3 Monetization · 4 Intelligence · 5 Mobile+Hardening.

Phase 1 services live in `src/services/`: `taxonomy` (category tree +
seed), `locations` (CRUD + localized profile view-model), `search`
(FTS + PostGIS discovery), `favorites` (favorites/lists/share links),
`import-locations` (admin bulk import). Deferred hooks noted in code:
secondary-category search, open-now (needs P2 hours schema), boosted
surfacing (P3), search GIN/GiST indexes (hardening).
