# Multi-Tenant Company Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a brand-new user (via Google OAuth or a new public email/password signup) create and own their own new `CompanyProfile` through a guided onboarding wizard, instead of silently joining whichever company already exists — while existing admin-created teammates keep joining their admin's own company, and the platform owner gets a super-admin panel that can list every company and temporarily "view as" one of them.

**Architecture:** A new `PENDING_ONBOARDING` user status gates every brand-new self-registered user (both the Google OAuth path, via a Better Auth field default, and a new public email/password signup form, via the existing-but-unreachable `/api/v1/auth/register` endpoint) until they complete a two-step `/onboarding` wizard that creates their `CompanyProfile` and promotes them to `ADMIN`/`ACTIVE` of it. `proxy.ts` redirects any `PENDING_ONBOARDING` session to `/onboarding`. Every remaining "fall back to whichever company exists first" code path is replaced with "use the caller's own `companyId`, or fail." A new `isSuperAdmin` flag (manually set, no self-service UI) grants one account a `/admin/companies` panel and a "view as" cookie that `getSessionUser` overlays onto `companyId` for the rest of that session.

**Tech Stack:** Next.js 16, Prisma + Postgres, Better Auth 1.7.7, Zod, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-21-multi-tenant-onboarding-design.md`

## Global Constraints

- No automated test suite exists in this project yet (tracked separately as backlog item R9) — verify every task with `pnpm build` (typecheck + lint) plus the manual steps each task specifies, not with assertion-based test files.
- Never introduce a hardcoded personal default (name/email/phone/payment handle) for a *new* company — only `DEFAULT_COMPANY_SETTINGS` (Renata's own company) may use those; a new company gets `GENERIC_COMPANY_DEFAULTS` plus whatever the onboarding form actually collected.
- Every "use `prisma.companyProfile.findFirst()` when there's no caller-specific `companyId`" fallback must be removed, not relocated — multi-tenancy means there is no longer a sensible single "first" company.
- Git commit after each task, following this repo's existing commit style (`type(scope): summary`, body explaining why, `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer).

---

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | `UserStatus.PENDING_ONBOARDING`, drop `CompanyProfile.name/email/phone/paymentMethods` hardcoded defaults, add `User.isSuperAdmin`. |
| `src/lib/company-defaults.ts` | Split into `GENERIC_COMPANY_DEFAULTS` (reusable for any new company) and `DEFAULT_COMPANY_SETTINGS` (Renata's own, extends the generic set). |
| `src/lib/auth.ts` | Better Auth config — `status` field default becomes `PENDING_ONBOARDING`. |
| `src/lib/security/tokens.ts` | `SessionPayload` gains `status?: string` and `isSuperAdmin?: boolean`. |
| `src/lib/security/auth.ts` | `registerUser` takes explicit `companyId?`; `authenticateCredentials` allows `PENDING_ONBOARDING` login and returns `status`; new `getPendingOnboardingUser` helper; `getSessionUser` overlays the super-admin "view as" cookie. |
| `src/proxy.ts` | Redirect `PENDING_ONBOARDING` sessions (Better Auth or legacy cookie) to `/onboarding`. |
| `src/lib/company-context.ts` | `getTargetCompanyId` drops the auto-create-or-find-first fallback; requires a real `companyId`. |
| `src/lib/security/permissions.ts` | `requirePermission` drops its own `findFirst()` fallback. |
| `src/app/api/v1/auth/register/route.ts` | Public signup now issues a session cookie immediately (`PENDING_ONBOARDING`, no company). |
| `src/app/api/v1/users/route.ts` | Admin-created users pass `companyId: session.companyId` explicitly. |
| `src/app/api/v1/onboarding/complete/route.ts` *(new)* | Creates the new `CompanyProfile` + promotes the caller to `ADMIN`/`ACTIVE` of it. |
| `src/app/onboarding/page.tsx` *(new)* | Two-step wizard (company info, profile info). |
| `src/app/login/page.tsx` | Adds a "Criar conta" toggle posting to `/api/v1/auth/register`. |
| `src/app/api/v1/admin/companies/route.ts` *(new)* | Super-admin-only: lists every company with owner/user-count/created-date. |
| `src/app/(dashboard)/admin/companies/page.tsx` *(new)* | Renders that list + "Ver como" action. |
| `src/app/api/v1/admin/companies/[id]/view-as/route.ts` *(new)* | Sets the view-as cookie (super-admin only). |
| `src/app/api/v1/admin/view-as/route.ts` *(new)* | `DELETE` clears the view-as cookie. |
| `src/app/api/v1/auth/me/route.ts` | Exposes `isSuperAdmin` and `viewingAsCompany`. |
| `src/lib/hooks/use-current-user.ts` | Exposes the same two fields to client components. |
| `src/components/dashboard/view-as-banner.tsx` *(new)* | The "Visualizando como: X — Sair" banner. |
| `src/components/dashboard/sidebar.tsx` | Adds the `/admin/companies` nav link, super-admin only. |
| `src/app/(dashboard)/layout.tsx` | Renders `<ViewAsBanner />`. |

---

### Task 1: Schema migration — `PENDING_ONBOARDING`, drop personal defaults, `isSuperAdmin`

**Files:**
- Modify: `prisma/schema.prisma:16-20` (UserStatus enum), `:81-93` (CompanyProfile), `:167-193` (User)

**Interfaces:**
- Produces: `UserStatus` values `"PENDING_ONBOARDING" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED"`; `User.isSuperAdmin: boolean`; `CompanyProfile.name/email/phone/paymentMethods` are now required with no schema-level default.

- [ ] **Step 1: Edit the `UserStatus` enum**

In `prisma/schema.prisma`, change:

```prisma
enum UserStatus {
  PENDING_APPROVAL
  ACTIVE
  SUSPENDED
}
```

to:

```prisma
enum UserStatus {
  PENDING_ONBOARDING
  PENDING_APPROVAL
  ACTIVE
  SUSPENDED
}
```

- [ ] **Step 2: Drop the hardcoded personal defaults on `CompanyProfile`**

Change:

```prisma
model CompanyProfile {
  id                 String           @id @default(uuid())
  name               String           @default("Renata Matos de Oliveira")
  tradeName          String?
  email              String           @default("renatamatoz@gmail.com")
  phone              String           @default("9704129406")
  monthlyRevenueGoal Decimal          @default(6000.00) @db.Decimal(10, 2)
  paymentMethods     String           @default("Zelle: 9704129406\nVenmo: @RenataMatoz\nCheck payable to: Renata Matos de Oliveira")
  terms              String           @default("Payment is due within 7 days of invoice date. Late payments are subject to a 1.5% monthly finance charge.")
```

to:

```prisma
model CompanyProfile {
  id                 String           @id @default(uuid())
  name               String
  tradeName          String?
  email              String
  phone              String
  monthlyRevenueGoal Decimal          @default(6000.00) @db.Decimal(10, 2)
  paymentMethods     String
  terms              String           @default("Payment is due within 7 days of invoice date. Late payments are subject to a 1.5% monthly finance charge.")
```

(`monthlyRevenueGoal` and `terms` keep their defaults — they're generic/harmless for any new business, not personal to Renata. `name`/`email`/`phone`/`paymentMethods` are personal and must always be supplied explicitly from here on — every existing call site that creates a `CompanyProfile` already does, per Tasks 3 and 6 below.)

- [ ] **Step 3: Add `isSuperAdmin` to `User`**

In the `User` model (`prisma/schema.prisma:167-193`), add one field right after `status`:

```prisma
  status              UserStatus      @default(PENDING_APPROVAL)
  isSuperAdmin        Boolean         @default(false)
```

- [ ] **Step 4: Generate and apply the migration**

Run (against whatever `DATABASE_URL` this project's `.env` currently points at, same as every prior migration this session):

```bash
npx prisma migrate dev --name multi_tenant_onboarding
```

Expected: Prisma reports the migration applied cleanly. If it complains about `CompanyProfile.name`/`email`/`phone`/`paymentMethods` becoming non-nullable with no default against existing rows — it won't, because the one existing row (Renata's company) already has all four columns populated — but if any seed/test data elsewhere lacks one of them, fill it in via a one-off `UPDATE` before re-running, rather than reintroducing a default.

- [ ] **Step 5: Verify the generated Prisma Client**

Run: `npx prisma generate` (migrate dev already does this, but confirm no errors), then `npx tsc --noEmit -p tsconfig.json`.
Expected: clean. `prisma.user.create(...)` call sites that don't yet pass `isSuperAdmin` still compile (it has a default), but `prisma.companyProfile.create(...)` call sites that *don't* pass `name`/`email`/`phone`/`paymentMethods` will now fail to typecheck — note which files break; they're exactly `src/lib/seed-data.ts`, `src/lib/security/auth.ts` (`registerUser`), and `src/lib/company-context.ts` (`findOrCreateCompanyId`), all fixed in later tasks of this plan. If `tsc` reports errors in any OTHER file at this step, stop and investigate before continuing — that means some other `companyProfile.create` call exists that this plan hasn't accounted for.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "$(cat <<'EOF'
feat(auth): add PENDING_ONBOARDING status and isSuperAdmin flag

Multi-tenant onboarding (R8) foundation: a brand-new self-registered
user now has a status distinct from PENDING_APPROVAL (which means "an
existing company is reviewing them") - PENDING_ONBOARDING means "has
not created their company yet." Also drops CompanyProfile's hardcoded
name/email/phone/paymentMethods defaults (all Renata's real info -
every new company must supply its own, never inherit hers) and adds
User.isSuperAdmin (platform-owner-only, no self-service grant path).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Split `company-defaults.ts` into generic vs. Renata-personal

**Files:**
- Modify: `src/lib/company-defaults.ts` (full rewrite)

**Interfaces:**
- Produces: `GENERIC_COMPANY_DEFAULTS` (object, no `name`/`email`/`phone`/`paymentMethods`/`signatureUrl`/`logoUrl`/`icloudCalendarUrl`), `DEFAULT_COMPANY_SETTINGS` (unchanged shape/values, now `{ ...GENERIC_COMPANY_DEFAULTS, name, email, phone, paymentMethods, signatureUrl, logoUrl, icloudCalendarUrl, icloudSyncWindowDays }`).
- Consumes: nothing new.

- [ ] **Step 1: Rewrite the file**

Replace the full contents of `src/lib/company-defaults.ts` with:

```ts
/**
 * Valores-padrão de uma CompanyProfile. Dividido em dois conjuntos:
 *
 * - GENERIC_COMPANY_DEFAULTS: seguro reaproveitar em QUALQUER empresa nova
 *   (termos de pagamento genéricos, horário de trabalho, textos de
 *   recuperação de orçamento abandonado). Usado pelo onboarding
 *   (POST /api/v1/onboarding/complete) ao criar a empresa de um dono novo.
 *
 * - DEFAULT_COMPANY_SETTINGS: os valores de UMA empresa específica (a da
 *   Renata) - nome, e-mail, telefone, Zelle/Venmo reais dela, assinatura
 *   dela. Nunca deve ser usado como base pra criar uma empresa nova; é só
 *   o fallback/estado inicial da tela de Configurações dela mesma e do
 *   seed de dados de exemplo (seed-data.ts).
 */
export const GENERIC_COMPANY_DEFAULTS = {
  monthlyRevenueGoal: 6000,
  terms:
    "Payment is due within 7 days of invoice date. Late payments are subject to a 1.5% monthly finance charge.",
  icloudSyncWindowDays: 60,
  abandonedRecoveryEnabled: true,
  abandonedRecoveryMinutes: 30,
  abandonedRecoveryDiscount: 10,
  abandonedRecoveryDiscountType: "PERCENTAGE",
  abandonedRecoverySubject: "Oferta especial para a limpeza da sua casa! ✨",
  abandonedRecoveryBody:
    "Olá [cliente]!\n\nVimos que você calculou o orçamento para a limpeza da sua casa no valor de $[valor].\n\nPara ajudar você a fechar conosco hoje, liberamos um desconto exclusivo de [desconto]!\n\nSeu valor especial com desconto fica por apenas $[valor_final].\n\nClique no botão abaixo para garantir sua vaga e agendar seu atendimento.",
  workDayStartHour: "08:00",
  workDayEndHour: "18:00",
  workDays: "MON,TUE,WED,THU,FRI",
  travelBufferMinutes: 10,
  defaultStandardDurationMinutes: 120,
  defaultDeepDurationMinutes: 300,
  recurrenceHorizonMonths: 2,
};

export const DEFAULT_COMPANY_SETTINGS = {
  ...GENERIC_COMPANY_DEFAULTS,
  name: "Renata Matos de Oliveira",
  email: "renatamatoz@gmail.com",
  phone: "9704129406",
  paymentMethods:
    "Zelle: 9704129406\nVenmo: @RenataMatoz\nCheck payable to: Renata Matos de Oliveira",
  signatureUrl: "/signatures/renata-signature.svg",
  logoUrl: "",
  icloudCalendarUrl: "",
};
```

- [ ] **Step 2: Verify existing consumers still compile unchanged**

`src/app/(dashboard)/settings/page.tsx` and `src/lib/seed-data.ts` both reference `DEFAULT_COMPANY_SETTINGS.<field>` for every field this object already had (`name`, `email`, `phone`, `monthlyRevenueGoal`, `paymentMethods`, `terms`, `signatureUrl`, `logoUrl`, `icloudCalendarUrl`, `icloudSyncWindowDays`, `abandonedRecovery*`, `workDay*`, `travelBufferMinutes`, `defaultStandardDurationMinutes`, `defaultDeepDurationMinutes`, `recurrenceHorizonMonths`) — all of those still exist on the merged `DEFAULT_COMPANY_SETTINGS` object, just assembled from two spread objects instead of one flat literal. No changes needed in either consumer file.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean (no new errors in `settings/page.tsx` or `seed-data.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/company-defaults.ts
git commit -m "$(cat <<'EOF'
refactor(company): split generic defaults from Renata-personal ones

GENERIC_COMPANY_DEFAULTS is safe to reuse for any new company created
through onboarding (R8); DEFAULT_COMPANY_SETTINGS (Renata's actual
name/email/phone/Zelle handle) stays exactly as settings/page.tsx and
seed-data.ts already use it today, just now built on top of the
generic set instead of duplicating every field.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Public self-registration creates a `PENDING_ONBOARDING` user, never joins an existing company

**Files:**
- Modify: `src/lib/auth.ts:46-51`
- Modify: `src/lib/security/tokens.ts:6-14` (`SessionPayload`)
- Modify: `src/lib/security/auth.ts:105-171` (`registerUser`), `:177-223` (`authenticateCredentials`)
- Modify: `src/app/api/v1/users/route.ts:89-96`
- Modify: `src/app/api/v1/auth/register/route.ts`
- Modify: `src/app/api/v1/auth/login/route.ts:86-94`

**Interfaces:**
- Produces: `registerUser(params: { email, password?, name?, phone?, role?, status?, companyId?: string })` — when `companyId` is omitted, the new user is `PENDING_ONBOARDING`/no company/`OPERATOR`, never attached to any existing company. `authenticateCredentials(...)` now also returns `user.status` and allows login (doesn't block) when `status === "PENDING_ONBOARDING"`.
- Consumes: nothing new from earlier tasks (this task is independent of Tasks 1-2 at the type level, but requires Task 1's migrated `PENDING_ONBOARDING` enum value to exist in the DB).

- [ ] **Step 1: Change the Better Auth status field default**

In `src/lib/auth.ts`, change:

```ts
      status: {
        type: "string",
        defaultValue: "PENDING_APPROVAL",
        required: false,
        input: false,
      },
```

to:

```ts
      status: {
        type: "string",
        defaultValue: "PENDING_ONBOARDING",
        required: false,
        input: false,
      },
```

(This is the entire fix for Google OAuth signup — nothing in this codebase ever passes an explicit `status` to Better Auth's create path, so every freshly-created Google user now starts `PENDING_ONBOARDING` instead of `PENDING_APPROVAL`, with no company, exactly as the spec requires. `role` already defaults to `OPERATOR` and `companyId` already has no default — neither needs to change.)

- [ ] **Step 2: Extend `SessionPayload`**

In `src/lib/security/tokens.ts`, change:

```ts
export interface SessionPayload {
  sub: string; // User ID
  email: string; // User Email
  role: string; // Role (ADMIN, OPERATOR, FINANCIAL, VIEWER)
  name: string; // User Name
  companyId?: string;
  exp: number; // Expiration epoch in seconds
  iat: number; // Issued epoch in seconds
}
```

to:

```ts
export interface SessionPayload {
  sub: string; // User ID
  email: string; // User Email
  role: string; // Role (ADMIN, OPERATOR, FINANCIAL, VIEWER)
  name: string; // User Name
  companyId?: string;
  status?: string; // UserStatus - only populated where the caller needs it
  isSuperAdmin?: boolean;
  exp: number; // Expiration epoch in seconds
  iat: number; // Issued epoch in seconds
}
```

- [ ] **Step 3: `registerUser` takes an explicit `companyId`, drops the `findFirst()` fallback**

In `src/lib/security/auth.ts`, change the function signature and body:

```ts
export async function registerUser({
  email,
  password,
  name,
  phone,
  role,
  status,
}: {
  email: string;
  password?: string;
  name?: string;
  phone?: string;
  role?: "ADMIN" | "FINANCIAL" | "OPERATOR" | "VIEWER";
  status?: "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED";
}) {
  const normalizedEmail = email.trim().toLowerCase();

  let company = await prisma.companyProfile.findFirst();
  if (!company) {
    company = await prisma.companyProfile.create({
      data: {
        name: DEFAULT_ADMIN_NAME,
        email: DEFAULT_ADMIN_EMAIL,
      },
    });
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    throw new Error("Este e-mail já está cadastrado no sistema.");
  }

  const totalUsers = await prisma.user.count();
  const isFirstUser = totalUsers === 0;

  // Self-registration is never auto-elevated: role/status only come from an
  // authenticated ADMIN caller (see POST /api/v1/users); otherwise this is
  // always a pending, unprivileged account.
  const assignedRole = role || "OPERATOR";
  const assignedStatus = status || "PENDING_APPROVAL";

  // Admin-created users (POST /api/v1/users) may omit a password; the UI
  // documents this default and instructs the new user to change it on
  // first login. Self-registration always supplies its own password.
  const passwordHash = await hashPassword(password || "Mudar@1234");

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name?.trim() || "Usuário",
      phone: phone?.trim() || null,
      role: assignedRole,
      status: assignedStatus,
      companyId: company.id,
      passwordHash,
      verificationToken: null,
      emailVerified: false,
    },
  });

  return {
    user,
    isFirstUser,
  };
}
```

to:

```ts
export async function registerUser({
  email,
  password,
  name,
  phone,
  role,
  status,
  companyId,
}: {
  email: string;
  password?: string;
  name?: string;
  phone?: string;
  role?: "ADMIN" | "FINANCIAL" | "OPERATOR" | "VIEWER";
  status?: "PENDING_ONBOARDING" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED";
  // Caller's own company (admin-created teammate, see POST /api/v1/users).
  // Omitted entirely for public self-registration - that path creates a
  // user with no company at all, pending the /onboarding wizard, never
  // "whichever company happens to exist first."
  companyId?: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    throw new Error("Este e-mail já está cadastrado no sistema.");
  }

  const totalUsers = await prisma.user.count();
  const isFirstUser = totalUsers === 0;

  // Public self-registration (no companyId passed) is never auto-elevated
  // and never joins an existing company - it always starts a brand-new
  // company via /onboarding. Only an authenticated ADMIN caller (passing
  // companyId) may set role/status explicitly, to add a teammate directly.
  const assignedRole = companyId ? role || "OPERATOR" : "OPERATOR";
  const assignedStatus = companyId
    ? status || "ACTIVE"
    : "PENDING_ONBOARDING";

  // Admin-created users (POST /api/v1/users) may omit a password; the UI
  // documents this default and instructs the new user to change it on
  // first login. Self-registration always supplies its own password.
  const passwordHash = await hashPassword(password || "Mudar@1234");

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name?.trim() || "Usuário",
      phone: phone?.trim() || null,
      role: assignedRole,
      status: assignedStatus,
      companyId: companyId || null,
      passwordHash,
      verificationToken: null,
      emailVerified: false,
    },
  });

  return {
    user,
    isFirstUser,
  };
}
```

(`DEFAULT_ADMIN_NAME`/`DEFAULT_ADMIN_EMAIL` stay defined and used elsewhere in this file by `ensureAdminUser` — only `registerUser`'s own `findFirst()`-or-create block is removed.)

- [ ] **Step 4: `authenticateCredentials` allows `PENDING_ONBOARDING` to log in, returns `status`**

In `src/lib/security/auth.ts`, change the return type and the status check:

```ts
): Promise<{
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId?: string | null;
  };
}> {
```

to:

```ts
): Promise<{
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId?: string | null;
    status: string;
  };
}> {
```

and:

```ts
    if (user.status !== "ACTIVE") {
      return {
        success: false,
        error:
          user.status === "PENDING_APPROVAL"
            ? "Sua conta ainda está pendente de aprovação pelo administrador."
            : "Sua conta foi suspensa. Entre em contato com o suporte.",
      };
    }
```

to:

```ts
    if (user.status !== "ACTIVE" && user.status !== "PENDING_ONBOARDING") {
      return {
        success: false,
        error:
          user.status === "PENDING_APPROVAL"
            ? "Sua conta ainda está pendente de aprovação pelo administrador."
            : "Sua conta foi suspensa. Entre em contato com o suporte.",
      };
    }
```

and the final success return:

```ts
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || "Usuário",
        role: user.role,
        companyId: user.companyId,
      },
    };
```

to:

```ts
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || "Usuário",
        role: user.role,
        companyId: user.companyId,
        status: user.status,
      },
    };
```

- [ ] **Step 5: `POST /api/v1/users` passes the admin's own `companyId` explicitly**

In `src/app/api/v1/users/route.ts`, change:

```ts
    const { user, isFirstUser } = await registerUser({
      email: parsed.data.email,
      name: parsed.data.name,
      phone: parsed.data.phone,
      password: parsed.data.password,
      role: parsed.data.role,
      status: parsed.data.status,
    });
```

to:

```ts
    if (!session.companyId) {
      return NextResponse.json(
        { error: "Sua própria conta não está vinculada a uma empresa." },
        { status: 400 }
      );
    }

    const { user, isFirstUser } = await registerUser({
      email: parsed.data.email,
      name: parsed.data.name,
      phone: parsed.data.phone,
      password: parsed.data.password,
      role: parsed.data.role,
      status: parsed.data.status,
      companyId: session.companyId,
    });
```

- [ ] **Step 6: `POST /api/v1/auth/register` issues a session cookie on success**

Replace the full contents of `src/app/api/v1/auth/register/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import {
  registerUser,
  createSessionToken,
  getSessionCookieOptions,
} from "@/lib/security/auth";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  name: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres"),
  phone: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Rate Limiting: max 10 registration attempts per 15 minutes per IP
  const rate = checkRateLimit(`auth_reg_${ip}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!rate.success) {
    return NextResponse.json(
      {
        error: `Muitas tentativas de cadastro. Aguarde ${Math.ceil(
          rate.reset - Date.now() / 1000
        )} segundos antes de tentar novamente.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados de cadastro inválidos.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // No companyId passed - this is always "someone creating their own
    // company," never "joining whichever one exists" (see registerUser).
    const { user } = await registerUser({
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
      phone: parsed.data.phone,
    });

    // Log the new PENDING_ONBOARDING user straight in, same mechanism
    // /api/v1/auth/login uses, so they land on /onboarding immediately
    // instead of being told to go log in separately.
    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name || "Usuário",
      role: user.role,
      companyId: user.companyId || undefined,
    });
    const cookieOptions = getSessionCookieOptions(false);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
      message: "Cadastro realizado! Vamos configurar sua empresa.",
    });
    response.cookies.set({ ...cookieOptions, value: token });
    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao processar o cadastro." },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 7: `/api/v1/auth/login` redirect hint for `PENDING_ONBOARDING`**

In `src/app/api/v1/auth/login/route.ts`, the response already echoes back `user: { id, email, name, role }` on success — add `status` so the login page (Task 8) knows to send a returning `PENDING_ONBOARDING` user back to `/onboarding` instead of their normal destination. Change:

```ts
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
```

to:

```ts
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    });
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean.

Run: `pnpm build`
Expected: clean.

Manual check (dev server, `pnpm dev`):

```bash
curl -i -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"teste-onboarding@example.com","password":"Teste@1234","name":"Teste Onboarding"}'
```

Expected: `200`, JSON body `"success": true`, `"status": "PENDING_ONBOARDING"`, and a `Set-Cookie: invoice_session=...` header present.

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth.ts src/lib/security/tokens.ts src/lib/security/auth.ts \
  src/app/api/v1/users/route.ts src/app/api/v1/auth/register/route.ts \
  src/app/api/v1/auth/login/route.ts
git commit -m "$(cat <<'EOF'
fix(auth): self-registration never joins "whichever company exists"

Both signup paths - Google OAuth (via Better Auth's status field
default) and the legacy public email/password endpoint (previously
unreachable from any UI, see Task 8) - now create a PENDING_ONBOARDING
user with no companyId, instead of silently attaching to
prisma.companyProfile.findFirst(). registerUser takes an explicit
companyId param: present (admin-created teammate, POST /api/v1/users)
means "join my own company, ACTIVE"; absent (public self-registration)
always means PENDING_ONBOARDING with no company at all, routed to the
onboarding wizard next. authenticateCredentials now lets a
PENDING_ONBOARDING account log back in (to resume onboarding) instead
of rejecting it like a suspended account.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Route `PENDING_ONBOARDING` sessions to `/onboarding`

**Files:**
- Modify: `src/lib/security/auth.ts` (add `getPendingOnboardingUser`)
- Modify: `src/proxy.ts:47-70`

**Interfaces:**
- Consumes: `SessionPayload` from Task 3; `PENDING_ONBOARDING` enum value from Task 1.
- Produces: `getPendingOnboardingUser(req: Request | NextRequest): Promise<{ id: string; email: string; name: string | null } | null>` — used by Task 5's onboarding API route.

- [ ] **Step 1: Add `getPendingOnboardingUser`**

In `src/lib/security/auth.ts`, add this function right after `getSessionUser` (which ends around line 360):

```ts
/**
 * Like getSessionUser, but for the one narrow case getSessionUser
 * deliberately rejects: a user who IS authenticated but hasn't finished
 * onboarding yet (no company, PENDING_ONBOARDING). Used only by the
 * onboarding API route - every other route keeps requiring ACTIVE via
 * getSessionUser/requirePermission, unchanged.
 */
export async function getPendingOnboardingUser(
  req: Request | NextRequest
): Promise<{ id: string; email: string; name: string | null } | null> {
  try {
    const betterSession = await betterAuth.api.getSession({ headers: req.headers });
    const u = betterSession?.user as any;
    if (u && u.status === "PENDING_ONBOARDING") {
      return { id: u.id, email: u.email, name: u.name || null };
    }
  } catch {}

  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  const token = match ? decodeURIComponent(match[1]) : null;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { status: true, email: true, name: true },
  });
  if (!dbUser || dbUser.status !== "PENDING_ONBOARDING") return null;

  return { id: payload.sub, email: dbUser.email, name: dbUser.name };
}
```

- [ ] **Step 2: Add the proxy.ts gate**

In `src/proxy.ts`, immediately after step 3's Better Auth session lookup block (right after the `} catch {}` on the line that currently reads, in full, lines 47-65) and **before** the legacy-cookie fallback (`if (!session) { ... }`) and before the `isLoginPage && session` redirect, insert a fresh lookup of the *raw* Better Auth user (not the already-ACTIVE-filtered `session` variable) plus a parallel check against the legacy cookie:

Change:

```ts
  // 3. Extract and cryptographically verify session (Better Auth or legacy token)
  let session: any = null;
  try {
    const betterSession = await auth.api.getSession({ headers: req.headers });
    const betterUser = betterSession?.user as any;
    // Mirrors getSessionUser's ACTIVE check - Better Auth's own autoSignIn
    // doesn't know about this app's PENDING_APPROVAL/SUSPENDED statuses, so
    // without this a newly self-registered or suspended user would hold a
    // valid Better Auth cookie that still gets past this page gate.
    if (betterUser && (!betterUser.status || betterUser.status === "ACTIVE")) {
      session = {
        sub: betterUser.id,
        email: betterUser.email,
        name: betterUser.name,
        role: betterUser.role,
        companyId: betterUser.companyId,
      };
    }
  } catch {}

  if (!session) {
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    session = sessionCookie ? await verifySessionToken(sessionCookie) : null;
  }

  // If already authenticated and accesses /login, redirect directly to dashboard
  if (isLoginPage && session) {
```

to:

```ts
  // 3. Extract and cryptographically verify session (Better Auth or legacy token)
  let session: any = null;
  let pendingOnboardingStatus: string | null = null;
  try {
    const betterSession = await auth.api.getSession({ headers: req.headers });
    const betterUser = betterSession?.user as any;
    if (betterUser?.status === "PENDING_ONBOARDING") {
      pendingOnboardingStatus = "PENDING_ONBOARDING";
    }
    // Mirrors getSessionUser's ACTIVE check - Better Auth's own autoSignIn
    // doesn't know about this app's PENDING_APPROVAL/SUSPENDED statuses, so
    // without this a newly self-registered or suspended user would hold a
    // valid Better Auth cookie that still gets past this page gate.
    if (betterUser && (!betterUser.status || betterUser.status === "ACTIVE")) {
      session = {
        sub: betterUser.id,
        email: betterUser.email,
        name: betterUser.name,
        role: betterUser.role,
        companyId: betterUser.companyId,
      };
    }
  } catch {}

  if (!session && !pendingOnboardingStatus) {
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const legacyPayload = sessionCookie ? await verifySessionToken(sessionCookie) : null;
    if (legacyPayload) {
      // The legacy token doesn't carry a live status (it's a long-lived
      // signed JWT, not re-checked against the DB on every page load like
      // getSessionUser does for API routes) - re-check it here so a
      // PENDING_ONBOARDING self-registration (see Task 3) is routed to
      // /onboarding at the page level too, not just rejected later when an
      // API call 401s.
      const dbUser = await prisma.user.findUnique({
        where: { id: legacyPayload.sub },
        select: { status: true },
      });
      if (dbUser?.status === "PENDING_ONBOARDING") {
        pendingOnboardingStatus = "PENDING_ONBOARDING";
      } else if (dbUser?.status === "ACTIVE") {
        session = legacyPayload;
      }
      // Any other status (PENDING_APPROVAL, SUSPENDED) leaves both
      // `session` and `pendingOnboardingStatus` unset, i.e. "no session" -
      // same outcome getSessionUser already produces for API routes.
    }
  }

  // A PENDING_ONBOARDING user (either auth mechanism) can only reach the
  // onboarding wizard itself and its API, no matter what else they request.
  if (pendingOnboardingStatus) {
    const isOnboardingPath =
      pathname === "/onboarding" || pathname.startsWith("/api/v1/onboarding/");
    if (!isOnboardingPath) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
    return next();
  }

  // If already authenticated and accesses /login, redirect directly to dashboard
  if (isLoginPage && session) {
```

(Note the `prisma` import this introduces — add `import { prisma } from "@/lib/prisma";` to `src/proxy.ts`'s import block at the top of the file.)

The legacy-cookie branch only runs at all when neither a Better Auth session nor a Better Auth `PENDING_ONBOARDING` status was already found (`!session && !pendingOnboardingStatus`) — so a real Better Auth session is never second-guessed by a stale legacy cookie that might also be present. Within that branch, the live DB status lookup now decides the outcome instead of trusting the JWT payload blindly: `ACTIVE` sets `session`, `PENDING_ONBOARDING` sets the redirect flag, and anything else (`PENDING_APPROVAL`, `SUSPENDED`) leaves both unset — which previously wasn't checked here at all, so a suspended user's still-valid legacy cookie incorrectly passed this page-level gate until an API call separately 401'd them. This closes that pre-existing gap as a side effect.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean.

Run: `pnpm build`
Expected: clean.

Manual check (dev server): repeat Task 3 Step 8's `curl` to register a new user, capture the `Set-Cookie` value, then:

```bash
curl -i http://localhost:3000/ -H "Cookie: invoice_session=<value from Set-Cookie>"
```

Expected: `307`/`308` redirect to `/onboarding`, not a `200` dashboard page or a redirect to `/login`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/security/auth.ts src/proxy.ts
git commit -m "$(cat <<'EOF'
feat(auth): redirect PENDING_ONBOARDING sessions to /onboarding

proxy.ts previously treated any non-ACTIVE status identically to "no
session" (bounce to /login). A PENDING_ONBOARDING user - from either
auth mechanism (Google via Better Auth, or the legacy cookie from the
new public signup in Task 3) - is now redirected to /onboarding
instead, on every path except /onboarding itself and its API. The
legacy-cookie branch also gained the live DB status re-check
getSessionUser already does for API routes, which incidentally closes
a separate pre-existing gap: a SUSPENDED user holding an old legacy
cookie no longer passes this page-level gate on a stale JWT payload.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Fix the remaining "fall back to the first company" call sites

**Files:**
- Modify: `src/lib/company-context.ts` (full rewrite)
- Modify: `src/lib/security/permissions.ts:44-54`

**Interfaces:**
- Produces: `getTargetCompanyId(companyId: string | null | undefined): Promise<string>` — now throws `Error("Nenhuma empresa associada a esta sessão.")` instead of ever auto-creating/guessing one.
- Consumes: nothing new.

- [ ] **Step 1: Rewrite `company-context.ts`**

Replace the full contents of `src/lib/company-context.ts` with:

```ts
/**
 * Resolves which CompanyProfile a request should operate on. With real
 * multi-tenancy (see docs/superpowers/specs/2026-10-21-multi-tenant-
 * onboarding-design.md) there is no longer a single "the one company" to
 * fall back to when the caller doesn't have one - every ACTIVE session
 * has a companyId by construction (the only path to ACTIVE is completing
 * /onboarding, which always assigns one), so reaching this function
 * without one means something upstream is broken, not that this is a
 * fresh single-tenant database.
 */
export async function getTargetCompanyId(
  companyId: string | null | undefined
): Promise<string> {
  if (!companyId) {
    throw new Error("Nenhuma empresa associada a esta sessão.");
  }
  return companyId;
}
```

- [ ] **Step 2: Drop `requirePermission`'s own fallback**

In `src/lib/security/permissions.ts`, change:

```ts
  // Scoped to the caller's own company — falling back to findFirst() here
  // would apply whichever company happens to sort first's custom permission
  // overrides to every other company's users too.
  const company = session.companyId
    ? await prisma.companyProfile.findUnique({
        where: { id: session.companyId },
        select: { rolePermissions: true },
      })
    : await prisma.companyProfile.findFirst({
        select: { rolePermissions: true },
      });
  const matrix =
    (company?.rolePermissions as unknown as RolePermissionsMatrix | null) ||
    DEFAULT_ROLE_PERMISSIONS;
```

to:

```ts
  // Scoped to the caller's own company only - there is no longer a
  // sensible "first" company to fall back to. Unreachable for any ACTIVE
  // session in practice (see company-context.ts), but fails safe to the
  // default matrix instead of leaking one company's custom permission
  // overrides onto another's users.
  const company = session.companyId
    ? await prisma.companyProfile.findUnique({
        where: { id: session.companyId },
        select: { rolePermissions: true },
      })
    : null;
  const matrix =
    (company?.rolePermissions as unknown as RolePermissionsMatrix | null) ||
    DEFAULT_ROLE_PERMISSIONS;
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean. (If any file fails to compile because it called `getTargetCompanyId()` with zero arguments, fix that call site to pass its session's `companyId` explicitly — every current call site already does.)

Run: `pnpm build`
Expected: clean.

Manual check: with the dev server running and logged in as the existing admin (Renata), load the Dashboard, Agenda, and Reports pages - all three call `getTargetCompanyId(session.companyId)` indirectly and must still work exactly as before, since that session's `companyId` is already set.

- [ ] **Step 4: Commit**

```bash
git add src/lib/company-context.ts src/lib/security/permissions.ts
git commit -m "$(cat <<'EOF'
fix(auth): stop guessing a company when none is on the session

getTargetCompanyId and requirePermission both fell back to
prisma.companyProfile.findFirst() when the caller had no companyId -
sensible for a single-tenant app, actively wrong for a multi-tenant
one (it would silently operate on, or leak permission overrides from,
an arbitrary other company). Both now require the caller's own
companyId and fail instead of guessing; unreachable in practice since
every ACTIVE session has one by construction.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `POST /api/v1/onboarding/complete`

**Files:**
- Create: `src/app/api/v1/onboarding/complete/route.ts`
- Create: `src/lib/validations/onboarding.ts`

**Interfaces:**
- Consumes: `getPendingOnboardingUser` (Task 4), `GENERIC_COMPANY_DEFAULTS` (Task 2).
- Produces: `POST /api/v1/onboarding/complete` — body `{ companyName: string; companyPhone?: string; city?: string; state?: string; userPhone?: string }`, response `{ success: true }` on success, used by Task 7's wizard UI.

- [ ] **Step 1: Validation schema**

Create `src/lib/validations/onboarding.ts`:

```ts
import { z } from "zod";

export const onboardingCompleteSchema = z.object({
  companyName: z.string().trim().min(2, "O nome da empresa deve ter pelo menos 2 caracteres"),
  companyPhone: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().max(2).optional(),
  userPhone: z.string().trim().optional(),
});
```

- [ ] **Step 2: The route**

Create `src/app/api/v1/onboarding/complete/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPendingOnboardingUser } from "@/lib/security/auth";
import { onboardingCompleteSchema } from "@/lib/validations/onboarding";
import { GENERIC_COMPANY_DEFAULTS } from "@/lib/company-defaults";

export async function POST(req: NextRequest) {
  const pending = await getPendingOnboardingUser(req);
  if (!pending) {
    return NextResponse.json(
      { error: "Sessão de cadastro inválida ou expirada. Faça login novamente." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parsed = onboardingCompleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: pending.id },
      select: { companyId: true },
    });
    if (currentUser?.companyId) {
      return NextResponse.json(
        { error: "O cadastro desta conta já foi concluído." },
        { status: 400 }
      );
    }

    const { companyName, companyPhone, city, state, userPhone } = parsed.data;

    await prisma.$transaction(async (tx) => {
      const company = await tx.companyProfile.create({
        data: {
          ...GENERIC_COMPANY_DEFAULTS,
          name: companyName,
          email: pending.email,
          phone: companyPhone || "",
          paymentMethods: "",
          ...(city || state
            ? {
                addresses: {
                  create: [
                    {
                      label: "Principal",
                      street: "",
                      city: city || "",
                      state: state || "",
                      zipCode: "",
                      isDefault: true,
                    },
                  ],
                },
              }
            : {}),
        },
      });

      await tx.user.update({
        where: { id: pending.id },
        data: {
          companyId: company.id,
          role: "ADMIN",
          status: "ACTIVE",
          ...(userPhone ? { phone: userPhone } : {}),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao concluir onboarding:", error);
    return NextResponse.json(
      { error: "Não foi possível concluir o cadastro da empresa." },
      { status: 500 }
    );
  }
}
```

The address fields used above (`label`, `street`, `city`, `state`, `zipCode`, `isDefault`) match `prisma/schema.prisma`'s `CompanyAddress` model exactly (confirmed against the schema directly — `company.addresses` is a `CompanyAddress[]` relation, `@@map("company_addresses")`).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean.

Manual check (dev server): using the session cookie captured in Task 4 Step 3 (or a fresh `curl -X POST /api/v1/auth/register` as in Task 3 Step 8):

```bash
curl -i -X POST http://localhost:3000/api/v1/onboarding/complete \
  -H "Content-Type: application/json" \
  -H "Cookie: invoice_session=<value>" \
  -d '{"companyName":"Empresa Teste LLC","companyPhone":"5551234567","city":"Denver","state":"CO","userPhone":"5559876543"}'
```

Expected: `200`, `{"success":true}`. Then re-run the same request again with the same cookie — expected `400` ("já foi concluído"), proving the double-submit guard works. Confirm in the DB (`npx prisma studio` or a quick `SELECT`) that a new `CompanyProfile` named "Empresa Teste LLC" exists with no `name`/`email`/`phone` matching Renata's, and that the test user's row now has that company's id, `role = ADMIN`, `status = ACTIVE`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/v1/onboarding/complete/route.ts src/lib/validations/onboarding.ts
git commit -m "$(cat <<'EOF'
feat(onboarding): add POST /api/v1/onboarding/complete

Creates a brand-new CompanyProfile from GENERIC_COMPANY_DEFAULTS plus
whatever the onboarding wizard collected, and promotes the calling
PENDING_ONBOARDING user to ADMIN/ACTIVE of it, in one transaction.
Rejects a second call once companyId is already set, so the endpoint
can't be used to re-run onboarding or hijack a different company.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `/onboarding` wizard page

**Files:**
- Create: `src/app/onboarding/page.tsx`

**Interfaces:**
- Consumes: `POST /api/v1/onboarding/complete` (Task 6).

- [ ] **Step 1: Write the page**

Create `src/app/onboarding/page.tsx`:

```tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, User, ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [userPhone, setUserPhone] = useState("");

  const goToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Por favor, informe o nome da sua empresa.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          companyPhone: companyPhone.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          userPhone: userPhone.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Não foi possível concluir o cadastro.");
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao concluir o cadastro.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl shadow-2xl p-8 sm:p-10 space-y-7">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 mb-1">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Vamos configurar sua empresa
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Passo {step} de 2 — {step === 1 ? "Dados da Empresa" : "Seu Perfil"}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={goToStep2} className="space-y-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Building2 className="w-3.5 h-3.5" />
                Nome da Empresa
              </label>
              <input
                type="text"
                required
                autoFocus
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Limpeza Rápida LLC"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Telefone da Empresa</label>
              <input
                type="tel"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                placeholder="(opcional)"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Cidade</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="(opcional)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Estado</label>
                <input
                  type="text"
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  placeholder="CO"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleFinish} className="space-y-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <User className="w-3.5 h-3.5" />
                Seu Telefone
              </label>
              <input
                type="tel"
                autoFocus
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                placeholder="(opcional)"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Concluir</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm build`
Expected: clean.

Manual check (dev server, real browser): clear cookies, click "Entrar ou Cadastrar com o Google" on `/login` with a Google account that has never logged into this app before. Expected: lands on `/onboarding` Step 1, not the dashboard. Fill in a company name, click Continuar, fill in a phone (or leave blank), click Concluir. Expected: redirected to `/`, dashboard loads normally, and `/admin/companies` work from Task 9 would show this new company once that task exists (not yet at this point in the plan).

- [ ] **Step 3: Commit**

```bash
git add src/app/onboarding/page.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): add the two-step onboarding wizard page

Step 1 collects the new company's name/phone/city/state; step 2
collects the user's own phone (name already comes from Google when
available). Posts both steps together to
POST /api/v1/onboarding/complete and redirects to / on success.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Public "Criar conta" signup form on `/login`

**Files:**
- Modify: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `POST /api/v1/auth/register` (Task 3).

- [ ] **Step 1: Add signup state and handler to `LoginForm`**

In `src/app/login/page.tsx`, inside `function LoginForm()`, change the state declarations:

```ts
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
```

to:

```ts
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupName, setSignupName] = useState("");
```

Add a new handler right after `handleSubmit` (which ends around line 132):

```ts
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName || !email || !password) {
      showToast("Por favor, preencha nome, e-mail e senha.", "error");
      return;
    }
    if (password.length < 6) {
      showToast("A senha deve ter pelo menos 6 caracteres.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signupName.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || "Não foi possível criar sua conta.", "error");
        setLoading(false);
        return;
      }

      setSuccess(true);
      showToast("Conta criada! Vamos configurar sua empresa...", "success");
      setTimeout(() => {
        router.push("/onboarding");
        router.refresh();
      }, 500);
    } catch {
      showToast("Não foi possível conectar ao servidor. Verifique sua conexão.", "error");
      setLoading(false);
    }
  };
```

- [ ] **Step 2: Add the mode toggle and conditional form**

Change the divider + form block:

```tsx
        {/* Divider */}
        <div className="relative flex items-center justify-center pt-1">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-[11px] text-slate-400 font-medium uppercase tracking-wider shrink-0">
            ou credenciais de acesso
          </span>
          <div className="border-t border-slate-200 w-full" />
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            E-mail de Acesso
          </label>
```

to:

```tsx
        {/* Divider */}
        <div className="relative flex items-center justify-center pt-1">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-[11px] text-slate-400 font-medium uppercase tracking-wider shrink-0">
            ou credenciais de acesso
          </span>
          <div className="border-t border-slate-200 w-full" />
        </div>
      </div>

      {/* Form */}
      <form onSubmit={mode === "login" ? handleSubmit : handleSignup} className="space-y-4">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Seu Nome
            </label>
            <input
              type="text"
              required
              autoFocus
              value={signupName}
              onChange={(e) => setSignupName(e.target.value)}
              placeholder="Nome completo"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            E-mail de Acesso
          </label>
```

Then, right after the password input's closing `</div>` and before the "Lembrar-me" block (which should only show in `login` mode), change:

```tsx
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
            />
            <span className="text-xs text-slate-600 font-medium">
              Lembrar-me neste dispositivo
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || success}
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Entrar no Sistema</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
```

to:

```tsx
        {mode === "login" && (
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
              <span className="text-xs text-slate-600 font-medium">
                Lembrar-me neste dispositivo
              </span>
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || success}
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : mode === "login" ? (
            <>
              <span>Entrar no Sistema</span>
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <>
              <span>Criar Conta</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="w-full text-center text-[11px] text-slate-500 hover:text-indigo-600 font-semibold transition-colors cursor-pointer"
        >
          {mode === "login" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
      </form>
```

- [ ] **Step 3: Handle the `PENDING_ONBOARDING` case on an existing-account login**

In `handleSubmit`, change the success branch:

```ts
      setSuccess(true);
      showToast("Autenticado com sucesso! Redirecionando...", "success");

      // Brief delay for visual confirmation before redirect
      setTimeout(() => {
        const destination = from.startsWith("/") && from !== "/login" ? from : "/";
        router.push(destination);
        router.refresh();
      }, 500);
```

to:

```ts
      setSuccess(true);
      showToast("Autenticado com sucesso! Redirecionando...", "success");

      // Brief delay for visual confirmation before redirect
      setTimeout(() => {
        const destination =
          data.user?.status === "PENDING_ONBOARDING"
            ? "/onboarding"
            : from.startsWith("/") && from !== "/login"
            ? from
            : "/";
        router.push(destination);
        router.refresh();
      }, 500);
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean.

Run: `pnpm build`
Expected: clean.

Manual check (dev server, real browser): on `/login`, click "Não tem conta? Criar conta", fill in name/email/password, submit. Expected: toast "Conta criada!", redirected to `/onboarding` Step 1. Complete the wizard (Task 7) and confirm the dashboard loads.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "$(cat <<'EOF'
feat(auth): add public "Criar conta" signup form to /login

POST /api/v1/auth/register (Task 3) was already live and reachable,
just with no UI pointing at it. Adds a mode toggle on the login form -
"Criar conta" swaps in name/email/password fields; success redirects
straight into /onboarding, same destination a fresh Google signup
reaches. An existing PENDING_ONBOARDING account logging back in via
email/password also gets routed to /onboarding instead of their
normal destination.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Super-admin companies list (`/admin/companies`)

**Files:**
- Create: `src/app/api/v1/admin/companies/route.ts`
- Create: `src/app/(dashboard)/admin/companies/page.tsx`
- Modify: `src/components/dashboard/sidebar.tsx`
- Modify: `src/app/api/v1/auth/me/route.ts:19-37` (select `isSuperAdmin`)
- Modify: `src/lib/hooks/use-current-user.ts`

**Interfaces:**
- Produces: `GET /api/v1/admin/companies` → `{ data: Array<{ id, name, ownerEmail, userCount, createdAt }> }`, 403 for non-super-admins.
- Consumes: `User.isSuperAdmin` (Task 1).

- [ ] **Step 1: Expose `isSuperAdmin` on `/api/v1/auth/me`**

In `src/app/api/v1/auth/me/route.ts`, both `select` blocks (`GET` at line ~19-37 and `PATCH` at line ~85-103) list the same fields - add `isSuperAdmin: true` to both, right after `companyId: true,`:

```ts
        companyId: true,
        isSuperAdmin: true,
        createdAt: true,
```

- [ ] **Step 2: Expose it on the client hook**

In `src/lib/hooks/use-current-user.ts`, add to `CurrentUserData`:

```ts
export interface CurrentUserData {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  phone?: string | null;
  gender?: "MALE" | "FEMALE" | string | null;
  role: Role;
  status: UserStatus;
  companyId?: string | null;
  isSuperAdmin?: boolean;
  createdAt?: string;
  company?: {
    id: string;
    name: string;
    tradeName?: string | null;
  } | null;
}
```

and to the hook's return value:

```ts
  return {
    user,
    loading,
    refresh: fetchUser,
    isAdmin: user?.role === "ADMIN",
    isFinancial: user?.role === "FINANCIAL",
    isOperator: user?.role === "OPERATOR",
    isViewer: user?.role === "VIEWER",
    isActive: user?.status === "ACTIVE",
    isPending: user?.status === "PENDING_APPROVAL",
    isSuspended: user?.status === "SUSPENDED",
    isSuperAdmin: Boolean(user?.isSuperAdmin),
  };
```

- [ ] **Step 3: The companies-list API route**

Create `src/app/api/v1/admin/companies/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/security/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const caller = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { isSuperAdmin: true },
  });
  if (!caller?.isSuperAdmin) {
    return NextResponse.json({ error: "Acesso restrito ao super-admin." }, { status: 403 });
  }

  const companies = await prisma.companyProfile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      users: {
        where: { role: "ADMIN", status: "ACTIVE" },
        select: { email: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json({
    data: companies.map((c) => ({
      id: c.id,
      name: c.name,
      ownerEmail: c.users[0]?.email || "—",
      userCount: c._count.users,
      createdAt: c.createdAt,
    })),
  });
}
```

(Confirmed directly against `prisma/schema.prisma:137` — `CompanyProfile.users` is a `User[]` relation, matching the `select`/`_count` field names used above.)

- [ ] **Step 4: The page**

Create `src/app/(dashboard)/admin/companies/page.tsx`:

```tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Building2, Users, Calendar, Eye } from "lucide-react";

interface CompanyRow {
  id: string;
  name: string;
  ownerEmail: string;
  userCount: number;
  createdAt: string;
}

export default function AdminCompaniesPage() {
  const router = useRouter();
  const { user, loading: userLoading, isSuperAdmin } = useCurrentUser();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && user && !isSuperAdmin) {
      router.push("/");
    }
  }, [userLoading, user, isSuperAdmin, router]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/companies");
      if (res.ok) {
        const json = await res.json();
        setCompanies(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) fetchCompanies();
  }, [isSuperAdmin]);

  const handleViewAs = async (companyId: string) => {
    setSwitchingId(companyId);
    try {
      const res = await fetch(`/api/v1/admin/companies/${companyId}/view-as`, {
        method: "POST",
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      }
    } finally {
      setSwitchingId(null);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        title="Painel de Super-Admin"
        subtitle="Todas as empresas cadastradas na plataforma"
        onRefresh={fetchCompanies}
        loading={loading}
      />
      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
              <tr>
                <th className="text-left px-4 py-3">Empresa</th>
                <th className="text-left px-4 py-3">Dono</th>
                <th className="text-left px-4 py-3">Usuários</th>
                <th className="text-left px-4 py-3">Criada em</th>
                <th className="text-right px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.ownerEmail}</td>
                  <td className="px-4 py-3 text-slate-600 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {c.userCount}
                  </td>
                  <td className="px-4 py-3 text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleViewAs(c.id)}
                      disabled={switchingId === c.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Eye className="w-3 h-3" />
                      Ver como
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

(The `view-as` route it calls is Task 10 — this page is still correct to write now; the button just 404s until that task lands, which is fine since Task 9 and 10 are committed back-to-back in this same plan.)

- [ ] **Step 5: Sidebar nav link**

In `src/components/dashboard/sidebar.tsx`, add the import:

```ts
import { useCurrentUser } from "@/lib/hooks/use-current-user";
```

and inside `export function Sidebar() {`, add right after `const pathname = usePathname();`:

```ts
  const { isSuperAdmin } = useCurrentUser();
```

then change the "CATEGORIA 5: Sistema" block (`src/components/dashboard/sidebar.tsx:423-426`):

```tsx
          {/* CATEGORIA 5: Sistema */}
          <div className="space-y-1">
            {renderNavLink({ name: "Configurações", href: "/settings", icon: Settings })}
          </div>
```

to:

```tsx
          {/* CATEGORIA 5: Sistema */}
          <div className="space-y-1">
            {renderNavLink({ name: "Configurações", href: "/settings", icon: Settings })}
            {isSuperAdmin &&
              renderNavLink({ name: "Super-Admin: Empresas", href: "/admin/companies", icon: ShieldCheck })}
          </div>
```

(`ShieldCheck` is already imported in this file's icon list - confirm it's there; it is, used elsewhere for the "Auth & RBAC Ativos" footer line.)

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean.

Run: `pnpm build`
Expected: clean.

Manual check: `npx prisma studio` (or a raw `UPDATE`) and set `isSuperAdmin = true` on willcwb666's own `User` row. Log in, confirm "Super-Admin: Empresas" appears in the sidebar only for this account, and `/admin/companies` lists both the original company and the test company created in Task 6/7's manual checks. Confirm a non-super-admin account still gets redirected away from `/admin/companies` and gets `403` from `GET /api/v1/admin/companies` directly.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/v1/admin/companies/route.ts \
  "src/app/(dashboard)/admin/companies/page.tsx" \
  src/components/dashboard/sidebar.tsx \
  src/app/api/v1/auth/me/route.ts \
  src/lib/hooks/use-current-user.ts
git commit -m "$(cat <<'EOF'
feat(admin): add super-admin companies list panel

/admin/companies (gated by the new User.isSuperAdmin flag, set
manually - no self-service grant path exists) lists every
CompanyProfile with its owner's email, user count, and creation date.
Sidebar link only renders for isSuperAdmin accounts. The "Ver como"
button is wired up in the next commit.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: "View as company" switching

**Files:**
- Create: `src/app/api/v1/admin/companies/[id]/view-as/route.ts`
- Create: `src/app/api/v1/admin/view-as/route.ts`
- Create: `src/components/dashboard/view-as-banner.tsx`
- Modify: `src/lib/security/auth.ts` (`getSessionUser`)
- Modify: `src/app/api/v1/auth/me/route.ts`
- Modify: `src/lib/hooks/use-current-user.ts`
- Modify: `src/app/(dashboard)/layout.tsx`

**Interfaces:**
- Produces: `POST /api/v1/admin/companies/[id]/view-as` (sets cookie `super_admin_viewing_company_id`), `DELETE /api/v1/admin/view-as` (clears it). `getSessionUser` overlays `companyId` from that cookie onto `SessionPayload` whenever the real session's `isSuperAdmin` is `true`.
- Consumes: `isSuperAdmin` (Task 9), `getTargetCompanyId` (Task 5, unchanged — it just receives whatever `companyId` `getSessionUser` now produces).

- [ ] **Step 1: Set/clear the cookie**

Create `src/app/api/v1/admin/companies/[id]/view-as/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/security/auth";

const COOKIE_NAME = "super_admin_viewing_company_id";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const caller = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { isSuperAdmin: true },
  });
  if (!caller?.isSuperAdmin) {
    return NextResponse.json({ error: "Acesso restrito ao super-admin." }, { status: 403 });
  }

  const { id } = await params;
  const company = await prisma.companyProfile.findUnique({ where: { id }, select: { id: true } });
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: id,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h - a support session, not a persistent login
  });
  return response;
}
```

Create `src/app/api/v1/admin/view-as/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "super_admin_viewing_company_id";

export async function DELETE(_req: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
```

- [ ] **Step 2: `getSessionUser` honors the cookie, only for a real super-admin**

In `src/lib/security/auth.ts`, the Better Auth success branch of `getSessionUser` currently returns early:

```ts
    if (betterSession?.user) {
      const u = betterSession.user as any;
      // Ensure user is active in DB
      if (u.status && u.status !== "ACTIVE") {
        return null;
      }
      const sessionExpires = betterSession.session?.expiresAt
        ? Math.floor(new Date(betterSession.session.expiresAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
      const sessionIat = betterSession.session?.createdAt
        ? Math.floor(new Date(betterSession.session.createdAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      return {
        sub: u.id,
        email: u.email,
        name: u.name || "Usuário",
        role: u.role || "OPERATOR",
        companyId: u.companyId || undefined,
        exp: sessionExpires,
        iat: sessionIat,
      };
    }
```

Change the final `return` to go through a shared helper instead of returning directly — add this small helper right above `getSessionUser`'s own declaration:

```ts
function applyViewAsOverride(
  req: Request | NextRequest,
  base: SessionPayload,
  isSuperAdmin: boolean
): SessionPayload {
  if (!isSuperAdmin) return base;
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)super_admin_viewing_company_id=([^;]+)/);
  const viewingCompanyId = match ? decodeURIComponent(match[1]) : null;
  if (!viewingCompanyId) return base;
  return { ...base, companyId: viewingCompanyId, isSuperAdmin: true };
}
```

Then change the Better Auth branch's return to:

```ts
      return applyViewAsOverride(
        req,
        {
          sub: u.id,
          email: u.email,
          name: u.name || "Usuário",
          role: u.role || "OPERATOR",
          companyId: u.companyId || undefined,
          exp: sessionExpires,
          iat: sessionIat,
        },
        Boolean(u.isSuperAdmin)
      );
```

And the legacy-token branch's return (currently ending the function):

```ts
    return {
      ...payload,
      role: dbUser.role,
      name: dbUser.name || payload.name,
      companyId: dbUser.companyId ?? payload.companyId,
    };
```

to:

```ts
    return applyViewAsOverride(
      req,
      {
        ...payload,
        role: dbUser.role,
        name: dbUser.name || payload.name,
        companyId: dbUser.companyId ?? payload.companyId,
      },
      Boolean((dbUser as any).isSuperAdmin)
    );
```

— which requires adding `isSuperAdmin: true` to that branch's `select`:

```ts
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true, role: true, companyId: true, name: true },
    });
```

to:

```ts
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true, role: true, companyId: true, name: true, isSuperAdmin: true },
    });
```

Also add `isSuperAdmin` to Better Auth's `user.additionalFields` in `src/lib/auth.ts`, right after `companyId`:

```ts
      companyId: {
        type: "string",
        required: false,
        input: false,
      },
      isSuperAdmin: {
        type: "boolean",
        defaultValue: false,
        required: false,
        input: false,
      },
```

(`input: false` means a client can never set this on signup/update — it only ever changes via a direct DB write, matching the spec's "no self-service grant path" requirement.)

- [ ] **Step 3: Expose `viewingAsCompany` on `/api/v1/auth/me`**

In `src/app/api/v1/auth/me/route.ts`'s `GET`, after fetching `user` (which reflects the super-admin's OWN row, unaffected by the override — `getSessionUser`'s override only changes what `session.companyId` resolves to for authorization/data-scoping purposes elsewhere, not this endpoint's own lookup), add a second lookup when the session's `companyId` differs from the user's real one:

```ts
    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Usuário inativo ou não encontrado." },
        { status: 401 }
      );
    }

    let viewingAsCompany: { id: string; name: string } | null = null;
    if (user.isSuperAdmin && session.companyId && session.companyId !== user.companyId) {
      viewingAsCompany = await prisma.companyProfile.findUnique({
        where: { id: session.companyId },
        select: { id: true, name: true },
      });
    }

    return NextResponse.json({ data: { ...user, viewingAsCompany } });
```

(replacing the existing `return NextResponse.json({ data: user });` line — the `if (!user || ...)` block right above it stays unchanged.)

- [ ] **Step 4: Expose it on the client hook**

In `src/lib/hooks/use-current-user.ts`, add to `CurrentUserData`:

```ts
  viewingAsCompany?: { id: string; name: string } | null;
```

- [ ] **Step 5: The banner component**

Create `src/components/dashboard/view-as-banner.tsx`:

```tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

export function ViewAsBanner() {
  const router = useRouter();
  const { user, refresh } = useCurrentUser();

  if (!user?.viewingAsCompany) return null;

  const handleExit = async () => {
    await fetch("/api/v1/admin/view-as", { method: "DELETE" });
    await refresh();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="sticky top-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-xs font-bold print:hidden">
      <span className="flex items-center gap-1.5">
        <Eye className="w-3.5 h-3.5" />
        Visualizando como: {user.viewingAsCompany.name}
      </span>
      <button
        onClick={handleExit}
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 transition-colors cursor-pointer"
      >
        <X className="w-3 h-3" />
        Sair
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Render it in the dashboard layout**

In `src/app/(dashboard)/layout.tsx`, add the import:

```ts
import { ViewAsBanner } from "@/components/dashboard/view-as-banner";
```

and render it as the first child inside the outermost `<div>`:

```tsx
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white print:bg-white print:block">
      <ViewAsBanner />
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean.

Run: `pnpm build`
Expected: clean.

Manual check (dev server, real browser, logged in as the `isSuperAdmin` account from Task 9): go to `/admin/companies`, click "Ver como" on the test company created in Tasks 6/7. Expected: redirected to `/`, dashboard shows that company's (empty/test) data, not Renata's, and the amber banner reads "Visualizando como: Empresa Teste LLC" with a working "Sair" button that returns to Renata's own data. While viewing-as, confirm a page like `/clients` only shows the test company's clients, never Renata's.

Also confirm: `curl -i -X POST http://localhost:3000/api/v1/admin/companies/<test-company-id>/view-as -H "Cookie: invoice_session=<a NON-super-admin session cookie>"` returns `403`.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/v1/admin/companies/\[id\]/view-as/route.ts \
  src/app/api/v1/admin/view-as/route.ts \
  src/components/dashboard/view-as-banner.tsx \
  src/lib/security/auth.ts src/lib/auth.ts \
  src/app/api/v1/auth/me/route.ts \
  src/lib/hooks/use-current-user.ts \
  "src/app/(dashboard)/layout.tsx"
git commit -m "$(cat <<'EOF'
feat(admin): add super-admin "view as company" switching

getSessionUser now overlays an httpOnly cookie's company id onto the
returned SessionPayload, but ONLY when the real, authenticated
session's isSuperAdmin is true - a non-super-admin setting this cookie
has zero effect, since the override branch never runs for them. Every
existing company-scoped route (reports, invoices, clients, etc.)
respects this automatically, with no changes to any of them, since
they all already resolve their companyId through session.companyId.
A persistent amber banner shows which company is being viewed and
exits back to the super-admin's own context.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Clean build**

```bash
pnpm build
```

Expected: typecheck + lint + production build all pass with no new errors.

- [ ] **Step 2: Walk the spec's manual verification checklist end to end**

Using a real browser against the dev server (`pnpm dev`), in order:

1. Fresh Google signup (an email that has never logged into this app) → lands on `/onboarding`, not the dashboard; completing it creates a new `CompanyProfile`; confirm via `npx prisma studio` that its `name`/`email`/`phone`/`paymentMethods` are exactly what the wizard collected, never Renata's values.
2. Existing admin (Renata) logs in via Google → unaffected, lands on the dashboard directly, sees only her own company's data.
3. Renata, as `ADMIN`, creates a teammate via Users & RBAC (`/users`) → confirm that teammate's `companyId` is Renata's company, `status = ACTIVE` immediately (no onboarding).
4. New public "Criar conta" signup on `/login` → same onboarding path as step 1.
5. A returning `PENDING_ONBOARDING` user (closed the tab mid-onboarding, logs back in via email/password) → sent back to `/onboarding`, not the dashboard and not an error.
6. With `isSuperAdmin` set on willcwb666's row: `/admin/companies` lists both companies from steps 1-4; "Ver como" the new one shows only its (empty) data with the banner visible; "Sair" returns to Renata's own data.
7. A non-super-admin account: `GET /api/v1/admin/companies` → `403`; `/admin/companies` page → redirected away.

- [ ] **Step 3: Clean up test data**

Delete the test company/users created during this plan's manual checks (via `npx prisma studio`, or a short Prisma script) so they don't linger in what is now a production database — identify them by the company name(s) used in Task 6/7's checks ("Empresa Teste LLC") and the test email(s) used in Task 3/8's checks.

- [ ] **Step 4: Final commit (if Step 3 touched any tracked files — normally it won't, since cleanup is DB-only)**

No commit expected for this task unless a fix was needed during verification; if one was, commit it with a message describing exactly what broke and how it was fixed.
