# The Hub — Build Plan (Design Spec)

**Date:** 2026-06-23
**Author:** Michel + Claude
**Status:** Approved for planning
**Source of truth for product scope:** `The Hub - Project Scope.md` (19 sections) — this build plan does not restate features, it sequences and architects their construction.

---

## 1. Purpose & Constraints

This document is the **build plan** for The Hub: how a solo builder (Michel) plus Claude constructs the full-scope product without sacrificing features or quality, while keeping Claude **token cost** low.

Three fixed constraints:

1. **Full scope.** Every feature in the Project Scope ships. Nothing is cut.
2. **No quality sacrifice.** Architecture choices must not lower the quality ceiling; security, correctness, and UX stay first-class.
3. **Token-frugal process.** "Doesn't break the bank" refers to Claude usage during the build, not the product's runtime cost. Frugality applies to *how we work*, never to *what gets built*.

"Token-frugal process" is achieved structurally, not by doing less:

- **Vertical slices, one at a time.** Each feature is built end-to-end (schema → service → API → UI → test) → committed → next. Small, focused files keep Claude's working context small and its edits reliable.
- **Living architecture map.** A maintained `CLAUDE.md` plus the memory store let each session boot cheaply without re-reading the 46 KB scope doc.
- **No subagent fan-out by default.** Work proceeds in the main thread unless a task genuinely needs isolation.
- **Caveman communication mode** active for chat (substance unchanged, ~75% fewer tokens).
- **Decisions batched**, context reused within a session.

---

## 2. Architecture Decision (Approved)

The Project Scope suggests a polyglot, multi-service stack (NestJS API + separate Next.js web + Python FastAPI recsys + Elasticsearch/Algolia + React Native). For a **solo + Claude** build, a leaner unified stack delivers **identical user-facing features at higher quality** (fewer integration seams = fewer bugs) and lower token cost. Four swaps were reviewed and **all four approved**:

| # | Scope suggested | Approved choice (V1) | Why it's equal-or-better here | Upgrade path |
|---|---|---|---|---|
| A | NestJS API + separate Next.js web | **One Next.js full-stack app** (App Router + route handlers/server actions) over a clean `services/` layer | One codebase/deploy/language; shared TS types catch mismatches at compile time; RBAC enforced server-side in handlers per scope §2/§12.2. Two-repo split only pays off at team size. | Lift the `services/` layer into a standalone NestJS service when a team or independent API scaling is needed. |
| B | Elasticsearch / Algolia | **Postgres full-text search + PostGIS** | Every §4.2 search/filter/geo/sort feature present; no datastore-to-index sync bug surface; fast at Lebanon-MVP scale; multilingual FTS config (ar/en/fr). | Add Elasticsearch as a read index fed from Postgres when catalog/traffic demand it; search interface unchanged. |
| C | Python FastAPI recsys from start | **TS rule-based recsys now; Python ML service at Phase 4** | Matches scope §8's own cold-start rollout — ML has no data to train on at launch. Rule-based (profile interests → category tags) is trivial in TS. | Build the Python FastAPI hybrid (content + collaborative) service in Phase 4, A/B tested vs the rule-based baseline. |
| D | Web + mobile in parallel | **Web first, Expo (React Native) mobile after core proven** | Matches scope §16 phasing; mobile reuses settled, tested TS logic instead of chasing a moving core across two clients. | Ship iOS + Android via Expo in Phase 5 with full deep-linking; nothing cut. |

**Everything else in scope stays fully in:** RBAC, phone OTP verification, TOTP MFA, claim/registration/approval lifecycle, reviews + votes + reviewer score, content moderation, notifications, boosts + agency discounts, payment-provider abstraction (2Checkout/Verifone), i18n ar/en/fr + RTL, the full §12 security checklist, and analytics/interaction logging from day one.

### Confirmed Stack (V1)

| Layer | Choice |
|---|---|
| Language | TypeScript end-to-end (Python only at Phase 4 ML) |
| App | Next.js (App Router) + Tailwind CSS, modular `services/` layer |
| Database | PostgreSQL + PostGIS, accessed via Prisma |
| Search | Postgres full-text + PostGIS (no external engine at launch) |
| Auth | Auth.js — OAuth social for End Users; email/password for Agency & Individual Location; server-side RBAC |
| File storage | AWS S3 or Cloudflare R2, signed/expiring URLs |
| Push / Email | Firebase Cloud Messaging; transactional email (SendGrid/Mailgun) |
| SMS OTP | Provider TBD — Lebanon delivery confirmed before launch (scope risk §18) |
| Payments | Provider abstraction; 2Checkout/Verifone as first implementation |
| ML (Phase 4) | Python FastAPI microservice (hybrid content + collaborative filtering) |
| Mobile (Phase 5) | Expo / React Native, sharing TS logic + API client |
| Ops | Error monitoring (Sentry), CI, secrets manager, WAF/DDoS at hardening |

---

## 3. Phase Roadmap

The Project Scope's three-phase plan (§16) is refined into six finer, solo-buildable slices. **No features are removed** — open risks (§18) are tracked as gates inside the phase that depends on them.

### Phase 0 — Foundations
Monorepo + Next.js app skeleton; PostgreSQL + PostGIS provisioned; Prisma baseline; Auth.js shell; **server-side RBAC middleware**; i18n (ar/en/fr) + RTL wired from the start (scope §9, §15); secrets manager; CI pipeline; error monitoring; **interaction/analytics logging live from day one** (scope §8, §14).
*Scope:* §2, §9, §11, §12, §14.

### Phase 1 — Catalog + Discovery
Core data model (§6); category taxonomy (§3); Admin bulk-seed/import (§5.1, §4.7); Location profile page (§4.3); search & discovery via Postgres FTS + PostGIS — keyword, category/subcategory, distance radius, price, rating threshold, open-now, sorting, boosted-listing surfacing (§4.2); favorites + custom lists + share links + deep-link foundation (§4.5).
*Scope:* §3, §4.2, §4.3, §4.5, §5.1, §6.

### Phase 2 — Accounts + Trust
Full auth (OAuth + email per role); phone OTP verification (§5); TOTP MFA, mandatory for Admin/Super Admin (§12.1); listing lifecycle — claim, self-registration, Admin approval gate (§5); reviews + ratings + photos + votes + reviewer score (§4.4); content moderation queue + fake-review/conflict-of-interest heuristics (§13); notifications across push/email/in-app (§4.6); onboarding questionnaire (§4.1) + rule-based recommendations (§8 phase 1).
*Scope:* §4.1, §4.4, §4.6, §4.7, §5, §8(P1), §12.1, §13.

### Phase 3 — Monetization
Boost/Campaign model; boost-eligibility rating floor (§7); agency discount (flat or volume-tiered, stored as rate on Agency record); checkout through the payment abstraction (2Checkout/Verifone) with no-refund disclosure at checkout (§7, §10); Agency console (§4.8); Admin console completion (§4.7); analytics dashboard surfacing the day-one logged metrics (§14).
*Scope:* §4.7, §4.8, §7, §10, §14.

### Phase 4 — Intelligence
Python FastAPI recsys microservice — hybrid content + collaborative filtering, evaluation harness, A/B test vs rule-based baseline (§8 phase 2+); LLM recommendation chatbot as a conversational layer that calls the recsys engine via tool-calling (never reasons over the dataset itself), with prompt-injection guards and abuse flagging into the moderation queue (§4.9).
*Scope:* §4.9, §8(P2).

### Phase 5 — Mobile + Hardening
Expo iOS + Android app sharing TS logic; full iOS Universal Links / Android App Links deep-linking with app-store fallback (§9, §11); security hardening — WAF + DDoS mitigation, third-party pentest, tested backup/restore, written incident-response plan (§12.6); legal — ToS + Privacy Policy with lawyer sign-off (§12.7); accessibility + RTL/localization QA pass (§15).
*Scope:* §9, §11, §12.6, §12.7, §15.

---

## 4. Risk Gates (from Scope §18)

Tracked inside the phase that first depends on each — none are surprises:

| Risk | Gated in |
|---|---|
| 2Checkout/Verifone merchant approval for a Lebanon entity | Phase 3 (start application early — it blocks revenue) |
| SMS/OTP provider reliable in Lebanon | Phase 2 (blocks listing go-live) |
| Initial data-seeding source (Google-Maps-breadth dataset) | Phase 1 |
| Claim ownership-verification method | Phase 2 |
| Agency discount model (flat vs volume-tiered) | Phase 3 |
| ML cold-start (needs accumulated interaction data) | Phase 4 (logging starts Phase 0) |
| Local legal compliance (Law 81/2018) | Phase 5 |

---

## 5. Working Agreement

- One vertical slice at a time; commit on green.
- Security controls (§12) are built *with* each feature, not bolted on later.
- `CLAUDE.md` is kept current as the architecture map so sessions start cheap.
- Each phase produces its own implementation plan when it begins (this doc is the umbrella).
