# Phase 0 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the runnable foundation for The Hub — a typed Next.js full-stack app with Postgres+PostGIS, auth + server-side RBAC, tri-lingual i18n with RTL, day-one interaction logging, error monitoring, and CI — so every later feature slice plugs into a tested skeleton.

**Architecture:** One Next.js (App Router, TypeScript) application over a modular `src/services/` layer, per the approved build-plan spec (`docs/superpowers/specs/2026-06-23-the-hub-build-plan-design.md`). Data lives in PostgreSQL+PostGIS via Prisma. RBAC is enforced in server-side helpers (not just middleware). i18n routing uses next-intl with a `[locale]` segment. Tests are Vitest; DB-backed tests run against a local Docker Postgres and a CI service container.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, pnpm, Prisma 6 + PostgreSQL 16 + PostGIS, NextAuth v5 (Auth.js), next-intl 3, zod, Vitest 3 + @testing-library/react, @sentry/nextjs, GitHub Actions.

**Conventions for every task:** commit at the end of each task; **do not push until the final task** (push-after-every-phase rule). Test commands assume pnpm. DB-backed tests require the Docker Postgres from Task 2 to be running.

---

## File Structure (created across this phase)

| Path | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs` | Project + build config |
| `vitest.config.ts`, `vitest.setup.ts` | Test harness |
| `docker-compose.yml` | Local Postgres+PostGIS |
| `.env.example` | Documented env contract (no secrets) |
| `src/lib/env.ts` | Typed, validated environment loader (zod) |
| `prisma/schema.prisma` | Data model (User, Role, InteractionEvent baseline) |
| `prisma/migrations/**` | Migrations, incl. PostGIS extension enable |
| `src/lib/db.ts` | Prisma client singleton |
| `src/auth.ts` | NextAuth v5 config |
| `src/lib/auth-helpers.ts` | `attachRole`, session typing |
| `src/lib/rbac.ts` | `requireRole`, role hierarchy — server-side authz |
| `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/direction.ts` | Locale config + RTL direction |
| `src/middleware.ts` | next-intl locale routing |
| `messages/{en,ar,fr}.json` | Translation catalogs |
| `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx` | Localized root layout (sets `dir`) + landing |
| `src/services/interaction-log.ts` | `logInteraction` — day-one analytics capture |
| `src/lib/monitoring.ts` | Sentry init (guarded, no-ops without DSN) |
| `.github/workflows/ci.yml` | Lint + typecheck + test (with Postgres service) |
| `CLAUDE.md` | Living architecture map (keeps sessions cheap) |

---

## Task 1: Project scaffold + test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/globals.css`
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Test: `src/lib/__tests__/sanity.test.ts`

- [ ] **Step 1: Scaffold the app**

Run:
```bash
pnpm dlx create-next-app@latest . --ts --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-pnpm
```
When prompted to proceed in a non-empty directory, accept (existing `docs/`, scope files, `.git` are preserved).

- [ ] **Step 2: Add test dependencies**

Run:
```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Write Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

Create `vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add test scripts**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 5: Write the sanity test**

Create `src/lib/__tests__/sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs and reports pass", () => {
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 6: Run the test**

Run: `pnpm test`
Expected: PASS — 1 test passed.

- [ ] **Step 7: Verify typecheck + build wiring**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest harness"
```

---

## Task 2: Local Postgres+PostGIS + typed env loader

**Files:**
- Create: `docker-compose.yml`, `.env.example`, `.env` (local, gitignored)
- Create: `src/lib/env.ts`
- Test: `src/lib/__tests__/env.test.ts`

- [ ] **Step 1: Write the Docker Compose file**

Create `docker-compose.yml`:
```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_USER: hub
      POSTGRES_PASSWORD: hub
      POSTGRES_DB: hub
    ports:
      - "5432:5432"
    volumes:
      - hub_pgdata:/var/lib/postgresql/data
volumes:
  hub_pgdata:
```

- [ ] **Step 2: Write the env contract**

Create `.env.example`:
```bash
# Database
DATABASE_URL="postgresql://hub:hub@localhost:5432/hub?schema=public"

# Auth (NextAuth v5) — generate with: openssl rand -base64 32
AUTH_SECRET="replace-me"

# Error monitoring (optional locally; set in prod via secrets manager)
SENTRY_DSN=""

# Default locale
DEFAULT_LOCALE="en"
```
Then copy it for local use:
```bash
cp .env.example .env
```
Set a real `AUTH_SECRET` in `.env`:
```bash
pnpm dlx tsx -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
(or `openssl rand -base64 32`) and paste the value into `.env`.

- [ ] **Step 3: Write the failing test**

Create `src/lib/__tests__/env.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseEnv } from "@/lib/env";

const valid = {
  DATABASE_URL: "postgresql://hub:hub@localhost:5432/hub",
  AUTH_SECRET: "x".repeat(32),
  SENTRY_DSN: "",
  DEFAULT_LOCALE: "en",
};

describe("parseEnv", () => {
  it("parses a valid environment", () => {
    const env = parseEnv(valid);
    expect(env.DATABASE_URL).toContain("postgresql://");
    expect(env.DEFAULT_LOCALE).toBe("en");
  });

  it("throws when DATABASE_URL is missing", () => {
    const { DATABASE_URL, ...rest } = valid;
    expect(() => parseEnv(rest as Record<string, string>)).toThrow();
  });

  it("rejects an unsupported default locale", () => {
    expect(() => parseEnv({ ...valid, DEFAULT_LOCALE: "de" })).toThrow();
  });
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `pnpm test src/lib/__tests__/env.test.ts`
Expected: FAIL — cannot import `parseEnv`.

- [ ] **Step 5: Implement the env loader**

Create `src/lib/env.ts`:
```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  AUTH_SECRET: z.string().min(32),
  SENTRY_DSN: z.string().default(""),
  DEFAULT_LOCALE: z.enum(["en", "ar", "fr"]).default("en"),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment: ${result.error.message}`);
  }
  return result.data;
}

export const env = parseEnv();
```

- [ ] **Step 6: Add zod**

Run: `pnpm add zod`

- [ ] **Step 7: Run the test**

Run: `pnpm test src/lib/__tests__/env.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 8: Start the database**

Run: `docker compose up -d`
Then: `docker compose ps`
Expected: `db` container is `running`/healthy.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add Postgres+PostGIS compose and validated env loader"
```

---

## Task 3: Prisma baseline + PostGIS extension + base schema

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`
- Create (generated): `prisma/migrations/**`
- Test: `src/lib/__tests__/db.test.ts`

- [ ] **Step 1: Install Prisma**

Run:
```bash
pnpm add -D prisma
pnpm add @prisma/client
```

- [ ] **Step 2: Write the schema**

Create `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  SUPER_ADMIN
  ADMIN
  END_USER
  AGENCY
  INDIVIDUAL_LOCATION
}

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  displayName   String
  role          Role     @default(END_USER)
  emailVerified Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  interactions  InteractionEvent[]
}

model InteractionEvent {
  id        String   @id @default(cuid())
  userId    String?
  type      String
  metadata  Json     @default("{}")
  createdAt DateTime @default(now())

  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([type])
  @@index([createdAt])
}
```

- [ ] **Step 3: Create the first migration**

Run:
```bash
pnpm prisma migrate dev --name init
```
Expected: migration created and applied; Prisma Client generated.

- [ ] **Step 4: Add a PostGIS-enable migration**

Run:
```bash
pnpm prisma migrate dev --create-only --name enable_postgis
```
Open the newly created `prisma/migrations/*_enable_postgis/migration.sql` and set its contents to exactly:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```
Then apply it:
```bash
pnpm prisma migrate dev
```

- [ ] **Step 5: Write the Prisma client singleton**

Create `src/lib/db.ts`:
```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 6: Write the failing DB test**

Create `src/lib/__tests__/db.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";

describe("database", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("has the PostGIS extension installed", async () => {
    const rows = await prisma.$queryRaw<{ postgis_version: string }[]>`
      SELECT postgis_version() AS postgis_version
    `;
    expect(rows[0].postgis_version).toMatch(/^\d+\.\d+/);
  });

  it("can create and read a User", async () => {
    const email = `t-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, displayName: "Test" },
    });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.email).toBe(email);
    expect(found?.role).toBe("END_USER");
    await prisma.user.delete({ where: { id: user.id } });
  });
});
```

- [ ] **Step 7: Run the test (DB must be up)**

Run: `pnpm test src/lib/__tests__/db.test.ts`
Expected: PASS — 2 tests (PostGIS version matches, User round-trips).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema, PostGIS extension, and db client"
```

---

## Task 4: Auth.js (NextAuth v5) shell with role on session

**Files:**
- Create: `src/auth.ts`, `src/lib/auth-helpers.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/types/next-auth.d.ts`
- Test: `src/lib/__tests__/auth-helpers.test.ts`

- [ ] **Step 1: Install NextAuth v5**

Run: `pnpm add next-auth@^5`

- [ ] **Step 2: Write the failing test for role attachment**

Create `src/lib/__tests__/auth-helpers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { attachRole } from "@/lib/auth-helpers";

describe("attachRole", () => {
  it("copies the role from token onto session.user", () => {
    const session = { user: { email: "a@b.com", name: "A" } } as any;
    const token = { role: "ADMIN" } as any;
    const result = attachRole(session, token);
    expect(result.user.role).toBe("ADMIN");
  });

  it("defaults to END_USER when token has no role", () => {
    const session = { user: { email: "a@b.com", name: "A" } } as any;
    const result = attachRole(session, {} as any);
    expect(result.user.role).toBe("END_USER");
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `pnpm test src/lib/__tests__/auth-helpers.test.ts`
Expected: FAIL — cannot import `attachRole`.

- [ ] **Step 4: Implement the helper**

Create `src/lib/auth-helpers.ts`:
```ts
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

export type AppRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "END_USER"
  | "AGENCY"
  | "INDIVIDUAL_LOCATION";

export function attachRole(session: Session, token: JWT): Session {
  const role = (token.role as AppRole) ?? "END_USER";
  return { ...session, user: { ...session.user, role } };
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm test src/lib/__tests__/auth-helpers.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 6: Add the session type augmentation**

Create `src/types/next-auth.d.ts`:
```ts
import type { AppRole } from "@/lib/auth-helpers";

declare module "next-auth" {
  interface Session {
    user: {
      role: AppRole;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
  }
}
```

- [ ] **Step 7: Write the NextAuth config (shell)**

Create `src/auth.ts`:
```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { attachRole } from "@/lib/auth-helpers";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    // Shell provider only; real OAuth/email providers land in Phase 2.
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async () => null,
    }),
  ],
  callbacks: {
    jwt: ({ token }) => token,
    session: ({ session, token }) => attachRole(session, token),
  },
});
```

- [ ] **Step 8: Wire the route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 9: Verify typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add NextAuth v5 shell with role on session"
```

---

## Task 5: Server-side RBAC helper

**Files:**
- Create: `src/lib/rbac.ts`
- Test: `src/lib/__tests__/rbac.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/rbac.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hasRole, assertRole, ForbiddenError } from "@/lib/rbac";

describe("rbac", () => {
  it("grants access when the user's role meets the requirement", () => {
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
  });

  it("grants higher roles access to lower-required actions", () => {
    expect(hasRole("SUPER_ADMIN", "ADMIN")).toBe(true);
  });

  it("denies lower roles", () => {
    expect(hasRole("END_USER", "ADMIN")).toBe(false);
  });

  it("assertRole throws ForbiddenError when denied", () => {
    expect(() => assertRole("END_USER", "ADMIN")).toThrow(ForbiddenError);
  });

  it("assertRole passes silently when allowed", () => {
    expect(() => assertRole("ADMIN", "ADMIN")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test src/lib/__tests__/rbac.test.ts`
Expected: FAIL — cannot import from `@/lib/rbac`.

- [ ] **Step 3: Implement RBAC**

Create `src/lib/rbac.ts`:
```ts
import type { AppRole } from "@/lib/auth-helpers";

// Higher number = more authority. SUPER_ADMIN outranks all.
// AGENCY and INDIVIDUAL_LOCATION are business roles, not above END_USER
// in the admin sense; they get the same baseline authority level here and
// are gated by ownership checks (added in later phases), not the hierarchy.
const RANK: Record<AppRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  AGENCY: 40,
  INDIVIDUAL_LOCATION: 40,
  END_USER: 20,
};

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function hasRole(actual: AppRole, required: AppRole): boolean {
  return RANK[actual] >= RANK[required];
}

export function assertRole(actual: AppRole, required: AppRole): void {
  if (!hasRole(actual, required)) {
    throw new ForbiddenError(`Requires ${required}, has ${actual}`);
  }
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test src/lib/__tests__/rbac.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add server-side RBAC role hierarchy and guards"
```

---

## Task 6: i18n (en/ar/fr) with RTL direction

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/direction.ts`, `src/middleware.ts`
- Create: `messages/en.json`, `messages/ar.json`, `messages/fr.json`
- Modify: `next.config.ts`
- Create: `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`
- Delete: `src/app/page.tsx`, `src/app/layout.tsx` (replaced by `[locale]` versions)
- Test: `src/i18n/__tests__/direction.test.ts`

- [ ] **Step 1: Install next-intl**

Run: `pnpm add next-intl`

- [ ] **Step 2: Write the failing direction test**

Create `src/i18n/__tests__/direction.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getDirection, locales, defaultLocale } from "@/i18n/direction";

describe("locale direction", () => {
  it("returns rtl for Arabic", () => {
    expect(getDirection("ar")).toBe("rtl");
  });

  it("returns ltr for English and French", () => {
    expect(getDirection("en")).toBe("ltr");
    expect(getDirection("fr")).toBe("ltr");
  });

  it("exposes the three supported locales", () => {
    expect(locales).toEqual(["en", "ar", "fr"]);
    expect(defaultLocale).toBe("en");
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `pnpm test src/i18n/__tests__/direction.test.ts`
Expected: FAIL — cannot import `@/i18n/direction`.

- [ ] **Step 4: Implement direction + locale constants**

Create `src/i18n/direction.ts`:
```ts
export const locales = ["en", "ar", "fr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

const RTL: Locale[] = ["ar"];

export function getDirection(locale: Locale): "rtl" | "ltr" {
  return RTL.includes(locale) ? "rtl" : "ltr";
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm test src/i18n/__tests__/direction.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Configure next-intl routing**

Create `src/i18n/routing.ts`:
```ts
import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "@/i18n/direction";

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale,
});
```

Create `src/i18n/request.ts`:
```ts
import { getRequestConfig } from "next-intl/server";
import { routing } from "@/i18n/routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

Create `src/middleware.ts`:
```ts
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

- [ ] **Step 7: Add the next-intl plugin to Next config**

Replace `next.config.ts` with:
```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 8: Add message catalogs**

Create `messages/en.json`:
```json
{ "landing": { "title": "The Hub", "tagline": "Discover what you'll love." } }
```
Create `messages/ar.json`:
```json
{ "landing": { "title": "ذا هَب", "tagline": "اكتشف ما ستحبه." } }
```
Create `messages/fr.json`:
```json
{ "landing": { "title": "The Hub", "tagline": "Découvrez ce que vous allez aimer." } }
```

- [ ] **Step 9: Replace root layout/page with localized versions**

Delete `src/app/layout.tsx` and `src/app/page.tsx`.

Create `src/app/[locale]/layout.tsx`:
```tsx
import "../globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getDirection, type Locale } from "@/i18n/direction";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as any)) notFound();

  const messages = await getMessages();
  const dir = getDirection(locale as Locale);

  return (
    <html lang={locale} dir={dir}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

Create `src/app/[locale]/page.tsx`:
```tsx
import { useTranslations } from "next-intl";

export default function Landing() {
  const t = useTranslations("landing");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">{t("title")}</h1>
      <p className="text-lg text-gray-600">{t("tagline")}</p>
    </main>
  );
}
```

- [ ] **Step 10: Verify the app boots in all three locales**

Run: `pnpm dev` then visit `http://localhost:3000/en`, `/ar`, `/fr`.
Expected: `/ar` renders with `<html dir="rtl">` (inspect element); `/en` and `/fr` show `dir="ltr"`. Stop the dev server.

- [ ] **Step 11: Run the full test suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all PASS, no type errors.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add tri-lingual i18n routing with RTL support"
```

---

## Task 7: Interaction logging (day-one analytics capture)

**Files:**
- Create: `src/services/interaction-log.ts`
- Test: `src/services/__tests__/interaction-log.test.ts`

This implements scope §8/§14: every meaningful action is logged from day one so the Phase 4 ML model has training data.

- [ ] **Step 1: Write the failing test**

Create `src/services/__tests__/interaction-log.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { logInteraction } from "@/services/interaction-log";

describe("logInteraction", () => {
  afterAll(async () => {
    await prisma.interactionEvent.deleteMany({ where: { type: "TEST_EVENT" } });
    await prisma.$disconnect();
  });

  it("persists an anonymous interaction event", async () => {
    const event = await logInteraction({
      type: "TEST_EVENT",
      metadata: { query: "ramen" },
    });
    const found = await prisma.interactionEvent.findUnique({
      where: { id: event.id },
    });
    expect(found?.type).toBe("TEST_EVENT");
    expect((found?.metadata as { query: string }).query).toBe("ramen");
    expect(found?.userId).toBeNull();
  });

  it("associates an event with a user when userId is given", async () => {
    const user = await prisma.user.create({
      data: { email: `il-${Date.now()}@example.com`, displayName: "IL" },
    });
    const event = await logInteraction({
      userId: user.id,
      type: "TEST_EVENT",
      metadata: {},
    });
    expect(event.userId).toBe(user.id);
    await prisma.user.delete({ where: { id: user.id } });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test src/services/__tests__/interaction-log.test.ts`
Expected: FAIL — cannot import `logInteraction`.

- [ ] **Step 3: Implement the service**

Create `src/services/interaction-log.ts`:
```ts
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface InteractionInput {
  userId?: string;
  type: string;
  metadata?: Prisma.InputJsonValue;
}

export function logInteraction(input: InteractionInput) {
  return prisma.interactionEvent.create({
    data: {
      userId: input.userId ?? null,
      type: input.type,
      metadata: input.metadata ?? {},
    },
  });
}
```

- [ ] **Step 4: Run the test (DB must be up)**

Run: `pnpm test src/services/__tests__/interaction-log.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add interaction-logging service for day-one analytics"
```

---

## Task 8: Error monitoring (Sentry, guarded)

**Files:**
- Create: `src/lib/monitoring.ts`
- Test: `src/lib/__tests__/monitoring.test.ts`

- [ ] **Step 1: Install Sentry**

Run: `pnpm add @sentry/nextjs`

- [ ] **Step 2: Write the failing test**

Create `src/lib/__tests__/monitoring.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { initMonitoring } from "@/lib/monitoring";

describe("initMonitoring", () => {
  it("returns false and does not throw when no DSN is set", () => {
    expect(initMonitoring("")).toBe(false);
  });

  it("returns true when a DSN is provided", () => {
    const spy = vi.fn();
    expect(initMonitoring("https://abc@o0.ingest.sentry.io/1", spy)).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `pnpm test src/lib/__tests__/monitoring.test.ts`
Expected: FAIL — cannot import `initMonitoring`.

- [ ] **Step 4: Implement guarded init**

Create `src/lib/monitoring.ts`:
```ts
import * as Sentry from "@sentry/nextjs";

type Initializer = (opts: { dsn: string; tracesSampleRate: number }) => void;

/**
 * Initialize error monitoring. No-ops (returns false) when no DSN is set,
 * so local/dev and CI runs never require a Sentry account.
 * The optional `init` arg exists for testing.
 */
export function initMonitoring(
  dsn: string,
  init: Initializer = Sentry.init,
): boolean {
  if (!dsn) return false;
  init({ dsn, tracesSampleRate: 0.1 });
  return true;
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm test src/lib/__tests__/monitoring.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add guarded Sentry error-monitoring init"
```

---

## Task 9: CI pipeline (lint, typecheck, test with Postgres service)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Confirm scripts exist locally**

Run: `pnpm typecheck && pnpm test`
Expected: both PASS (DB up). This is what CI will reproduce.

- [ ] **Step 2: Write the CI workflow**

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_USER: hub
          POSTGRES_PASSWORD: hub
          POSTGRES_DB: hub
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://hub:hub@localhost:5432/hub?schema=public
      AUTH_SECRET: ${{ secrets.CI_AUTH_SECRET || 'ci-secret-ci-secret-ci-secret-32x' }}
      SENTRY_DSN: ""
      DEFAULT_LOCALE: en
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma migrate deploy
      - run: pnpm prisma generate
      - run: pnpm typecheck
      - run: pnpm test
```

- [ ] **Step 3: Sanity-check the workflow YAML**

Run: `pnpm dlx js-yaml .github/workflows/ci.yml > /dev/null && echo "YAML OK"`
Expected: `YAML OK` (parses without error).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "ci: add lint/typecheck/test workflow with Postgres service"
```

---

## Task 10: Architecture map + phase push

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write the living architecture map**

Create `CLAUDE.md`:
```markdown
# The Hub — Architecture Map

Solo + Claude build. Full scope, no feature cuts. Token-frugal *process*.
Authoritative scope: `The Hub - Project Scope.md`.
Build plan: `docs/superpowers/specs/2026-06-23-the-hub-build-plan-design.md`.

## Stack
- Next.js 15 (App Router, TS) — one full-stack app over `src/services/`.
- PostgreSQL 16 + PostGIS via Prisma (`src/lib/db.ts`).
- Auth: NextAuth v5 (`src/auth.ts`); roles via `src/lib/auth-helpers.ts`.
- Authz: server-side `src/lib/rbac.ts` (`hasRole`/`assertRole`).
- i18n: next-intl, `[locale]` segment, en/ar/fr; RTL via `src/i18n/direction.ts`.
- Analytics: `src/services/interaction-log.ts` (log from day one).
- Monitoring: `src/lib/monitoring.ts` (Sentry, guarded).

## Conventions
- TDD: failing test first, then minimal impl. Vitest.
- One vertical slice per change; commit on green.
- Server-side RBAC on every protected action — never UI-only.
- Push to origin after every completed phase (not per commit).

## Commands
- `docker compose up -d` — start DB
- `pnpm test` / `pnpm typecheck` / `pnpm dev`
- `pnpm prisma migrate dev` — apply schema changes

## Phases
0 Foundations (done) · 1 Catalog+Discovery · 2 Accounts+Trust ·
3 Monetization · 4 Intelligence · 5 Mobile+Hardening.
```

- [ ] **Step 2: Full green check before push**

Run: `pnpm test && pnpm typecheck`
Expected: all PASS, no type errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: add architecture map (CLAUDE.md)"
```

- [ ] **Step 4: Push the completed phase**

Run:
```bash
git push origin main
```
Expected: all Phase 0 commits land on `github.com/MichelFayad/the-hub`.

---

## Phase 0 Done — Definition of Complete

- `pnpm dev` boots; `/en`, `/ar` (RTL), `/fr` render.
- `docker compose up -d` + `pnpm test` → all suites green (env, db+PostGIS, auth-helpers, rbac, direction, interaction-log, monitoring, sanity).
- `pnpm typecheck` clean.
- CI workflow present and YAML-valid.
- All work committed and pushed to `main`.
