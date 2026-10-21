# Multi-Tenant Company Onboarding — Design

## Context

This app (`kreatorinvoice`) was built single-tenant: one `CompanyProfile`
exists, and every bootstrap path (admin seeding, self-registration, the
Google OAuth login fixed earlier this session) attaches every user to
"whichever company already exists" via `getTargetCompanyId` /
`registerUser` falling back to `prisma.companyProfile.findFirst()`. The
data model already carries `companyId` correctly on every business table
(`Client`, `Appointment`, `Invoice`, `Estimate`, `Expense`, `Professional`,
`Notification`, etc.) and most queries already scope by it — an earlier
audit this session closed the remaining cross-tenant IDOR gaps. What's
missing is entirely on the "how does a second company come into
existence, and how does a user end up correctly attached to the right
one" side.

The user (willcwb666, sole owner/operator of this business and the one
who will administer any additional companies) wants to onboard a second,
unrelated business soon, with **full data isolation**: each company has
its own separate users; no user belongs to more than one company. The
one exception is the platform owner, who needs a super-admin view across
all companies — not a general "users can belong to multiple companies"
feature.

## Goals

1. A brand-new user who authenticates via Google (self-serve, already
   live) or via a new public email/password signup becomes the owner of
   their **own new company**, not a pending member of whatever company
   happened to exist first.
2. An existing company's admin keeps adding teammates exactly as today
   (Users & RBAC screen) — those always join the admin's own company,
   never anyone else's.
3. The platform owner gets a super-admin panel listing every company, and
   can temporarily "view as" any one of them for support purposes, with a
   clearly visible exit path. No other user gets this capability.
4. Every "fall back to the first company" code path in the app is
   replaced with either "use the caller's own company" or a hard failure
   — there is no longer a sensible single "first" company to fall back to.

## Non-goals (explicitly out of scope for this spec)

- A general multi-company-membership model for regular (non-super-admin)
  users.
- Billing/plan tiers per company, company deletion/suspension workflows.
- Migrating the legacy HMAC-based email/password login
  (`/api/v1/auth/login`, `authenticateCredentials`) to Better Auth's
  native email/password — it stays as-is; this spec only adds a public
  signup *form* in front of the already-existing (currently unreachable)
  `/api/v1/auth/register` endpoint and fixes its company-resolution bug.

## New user lifecycle

`UserStatus` gains a new value, inserted before the existing ones:

```prisma
enum UserStatus {
  PENDING_ONBOARDING
  PENDING_APPROVAL
  ACTIVE
  SUSPENDED
}
```

- **`PENDING_ONBOARDING`** — a brand-new self-registered user (via Google
  or the new public signup form) who has not yet created their company.
  `companyId` is `null`. Can only reach `/onboarding` and its API.
- **`PENDING_APPROVAL`** — unchanged meaning: an existing company already
  has this user queued for an admin's approval (this status is not
  reachable through self-registration anymore — see below — but is kept
  for the admin-created-user flow where an admin may still set it
  explicitly via `/api/v1/users`).
- **`ACTIVE`** / **`SUSPENDED`** — unchanged.

`CompanyProfile.name` loses its hardcoded personal default:

```prisma
// before: name String @default("Renata Matos de Oliveira")
name String
```

No migration data concern — the existing row already has `name` set.

## Component 1 — New users are never attached to "whichever company exists"

### 1a. Better Auth-created users (Google OAuth, and Better Auth's native
email/password if ever enabled)

The only way a Better Auth-native user gets created today is Google
OAuth self-signup — nothing in this codebase ever passes an explicit
`role`/`status`/`companyId` to Better Auth's create path, so the field
defaults in `src/lib/auth.ts`'s `user.additionalFields` are already the
single source of truth. `role` already defaults to `"OPERATOR"` and
`companyId` already has no default (stays `null`) — only `status` needs
to change, from `"PENDING_APPROVAL"` to `"PENDING_ONBOARDING"`:

```ts
status: {
  type: "string",
  defaultValue: "PENDING_ONBOARDING", // was "PENDING_APPROVAL"
  required: false,
  input: false,
},
```

No `databaseHooks` needed — a plugin-level hook would be solving a
problem the field defaults already solve.

### 1b. Legacy self-registration (`registerUser` in `src/lib/security/auth.ts`)

Today `registerUser` always does
`prisma.companyProfile.findFirst()` → attach to it, with
`status = PENDING_APPROVAL`. It is called from two places with different
intent:

- `POST /api/v1/auth/register` — **public**, no session. This is the
  "someone is creating their own company" case.
- `POST /api/v1/users` — **admin-only**, authenticated. This is "an
  existing admin is adding a teammate to their own company."

`registerUser` gains an explicit `companyId?: string` parameter instead
of resolving one itself:

- When `companyId` is provided (the admin-created path), the new user is
  created `ACTIVE` with that `companyId`, exactly as today (admin may
  still pass `role`/`status` explicitly, unchanged).
- When `companyId` is omitted (the public self-registration path), the
  new user is created `status: "PENDING_ONBOARDING"`, `companyId: null`,
  `role: "OPERATOR"` — no more `findFirst()` fallback.

`POST /api/v1/users/route.ts` is updated to pass
`companyId: session.companyId` explicitly (today it doesn't pass one at
all, silently relying on the same `findFirst()` fallback — this is a
second, independent instance of the same bug, fixed the same way).

## Component 2 — Routing a `PENDING_ONBOARDING` user to `/onboarding`

`proxy.ts` already fetches the Better Auth session and currently treats
any non-`ACTIVE` status identically to "no session" (redirect to
`/login`). It needs one more branch, inserted immediately after step 3
(the Better Auth session lookup) and **before** both the
`isLoginPage && session` redirect and the "allow public routes" block —
so a `PENDING_ONBOARDING` user hitting `/login` (or any other public
path) while mid-onboarding is sent to continue onboarding instead of
seeing the login form again:

```ts
if (betterUser?.status === "PENDING_ONBOARDING") {
  const isOnboardingPath =
    pathname === "/onboarding" || pathname.startsWith("/api/v1/onboarding/");
  if (!isOnboardingPath) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }
  return next();
}
```

This does not touch the existing `session` variable or the
`getSessionUser`/`requirePermission` contract used by every other route —
those keep requiring `status === "ACTIVE"` exactly as today, so no
existing route needs to change its auth check.

A **separate, narrow** helper serves the onboarding API only:

```ts
// src/lib/security/auth.ts
export async function getPendingOnboardingUser(req: Request | NextRequest) {
  const betterSession = await betterAuth.api.getSession({ headers: req.headers });
  const u = betterSession?.user as any;
  if (!u || u.status !== "PENDING_ONBOARDING") return null;
  return { id: u.id as string, email: u.email as string, name: u.name as string | null };
}
```

`POST /api/v1/onboarding/complete` uses this instead of
`getSessionUser`/`requirePermission` (which would reject a non-`ACTIVE`
caller). It additionally re-reads the user row and rejects (400) if
`companyId` is already set, so the endpoint can't be called twice.

## Component 3 — `/onboarding` page (two-step wizard)

A standalone route, `src/app/onboarding/page.tsx` — no sidebar/header
(reuses the `(public)` layout's bare-page style, but is NOT in the
`(public)` group since it requires a `PENDING_ONBOARDING` session, not
anonymous access).

- **Step 1 — Dados da Empresa**: business name (required), phone,
  city, state. Pre-fills nothing from `DEFAULT_COMPANY_SETTINGS` except
  the genuinely generic fields (see Component 4) — never the name/phone
  fields, which are personal to the existing business.
- **Step 2 — Seu Perfil**: the user's own phone (name comes from Google
  when available, editable; required if signing up via the new
  email/password form, which already asks for it at signup — see
  Component 6 — so Step 2 pre-fills and lets them confirm/edit it rather
  than asking twice).
- "Concluir" posts both steps' data in one call to
  `POST /api/v1/onboarding/complete`, then redirects to `/`.

## Component 4 — What a new company inherits vs. starts blank

`DEFAULT_COMPANY_SETTINGS` (`src/lib/company-defaults.ts`) mixes two
kinds of values:

- Genuinely generic, safe to reuse for any new business: `terms`,
  `abandonedRecovery*` copy, `workDay*`, `travelBufferMinutes`,
  `defaultStandardDurationMinutes`, `defaultDeepDurationMinutes`,
  `recurrenceHorizonMonths`.
- Personal to the existing business and **must never** leak into a new
  company: `name`, `email`, `phone`, `paymentMethods` (contains Renata's
  real Zelle/Venmo handles), `signatureUrl` (points at her signature
  file), `icloudCalendarUrl`.

`company-defaults.ts` is split accordingly:

```ts
export const GENERIC_COMPANY_DEFAULTS = {
  terms: "...",
  abandonedRecoveryEnabled: true,
  abandonedRecoveryMinutes: 30,
  abandonedRecoveryDiscount: 10,
  abandonedRecoveryDiscountType: "PERCENTAGE",
  abandonedRecoverySubject: "...",
  abandonedRecoveryBody: "...",
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
  paymentMethods: "...",
  signatureUrl: "/signatures/renata-signature.svg",
  logoUrl: "",
  icloudCalendarUrl: "",
  icloudSyncWindowDays: 60,
};
```

`settings/page.tsx` and `seed-data.ts` keep using
`DEFAULT_COMPANY_SETTINGS` unchanged (that's still correct for Renata's
own company). `POST /api/v1/onboarding/complete` uses
`GENERIC_COMPANY_DEFAULTS` plus the Step 1 form fields instead.

## Component 5 — Fixing every remaining "fall back to the first company" spot

Three call sites, each fixed the same way — require the caller's own
`companyId`, never guess:

1. **`src/lib/company-context.ts`** — `getTargetCompanyId` drops the
   `findOrCreateCompanyId()` fallback entirely. New signature:
   `getTargetCompanyId(companyId: string | null | undefined): string` —
   throws a plain `Error` if `companyId` is falsy. No caller needs to
   change: every one of the ~20 call sites is inside a route handler's
   existing `try/catch`, which already turns an unexpected thrown error
   into a generic 500 today — this just changes what triggers that same
   existing path. In practice it's unreachable for any route gated by
   `requirePermission`, since `getSessionUser` already requires
   `status === "ACTIVE"`, and an `ACTIVE` user always has a `companyId`
   by construction once onboarding is the only path to `ACTIVE`.
2. **`src/lib/security/permissions.ts`** (`requirePermission`) — the
   `: await prisma.companyProfile.findFirst(...)` fallback (used when
   `session.companyId` is falsy, to resolve the custom permissions
   matrix) is removed. Falls back to `DEFAULT_ROLE_PERMISSIONS` directly
   when there's no `companyId` — again, unreachable in practice for the
   same reason as above, but now fails safe instead of leaking one
   company's custom permission overrides onto another's users.
3. **`src/app/api/v1/users/route.ts`** — covered in Component 1b above.

## Component 6 — Public email/password signup (legacy endpoint, new UI)

`POST /api/v1/auth/register` already exists, is rate-limited, and is
already in `proxy.ts`'s public allowlist (`/api/v1/auth/*`) — it's just
never been called from any page. Two changes:

- `/login` gains a "Criar conta" toggle that swaps the form into
  name + email + password + phone, posting to `/api/v1/auth/register`.
  On success, redirects straight into `/onboarding` (the user is now
  `PENDING_ONBOARDING`, exactly like a fresh Google signup) rather than
  showing the old "aguarde aprovação" message (that message/path still
  applies to the admin-created, explicitly-`PENDING_APPROVAL` case, just
  not to public self-registration anymore).
- `registerUser`'s public-path behavior, per Component 1b.

## Component 7 — Super-admin panel + "view as company"

- `User.isSuperAdmin Boolean @default(false)` — set manually (direct DB
  update or a one-off script) on willcwb666's own account only; there is
  no UI to grant it, by design.
- `src/app/(dashboard)/admin/companies/page.tsx` (URL `/admin/companies`,
  reuses the existing dashboard Header/Sidebar chrome; gated: redirect
  away unless `session.isSuperAdmin`) lists every `CompanyProfile`: name,
  owner email (first `ACTIVE` `ADMIN` user), user count, created date. A
  nav entry for it is added to `sidebar.tsx`, rendered only when
  `isSuperAdmin`.
- `POST /api/v1/admin/companies/[id]/view-as` (super-admin only) sets an
  httpOnly cookie `super_admin_viewing_company_id`.
  `DELETE /api/v1/admin/view-as` clears it.
- `getSessionUser` honors this cookie **only** when the resolved
  session's `isSuperAdmin` is `true`: it overlays
  `companyId = cookie value` onto the returned `SessionPayload`. A
  non-super-admin setting this cookie has no effect, since the override
  branch never runs for them.
- A small persistent banner (rendered in the dashboard layout whenever
  the cookie is present and `isSuperAdmin` is true) shows
  "Visualizando como: {company.name}" with a "Sair" button calling the
  `DELETE` endpoint and refreshing.
- `GET /api/v1/auth/me` and `useCurrentUser()` gain `isSuperAdmin` and
  `viewingAsCompany: { id, name } | null` so the UI can render the
  banner and the nav link to `/admin/companies`.

## Testing / verification

No automated test suite exists yet (separate backlog item, R9). Manual
verification plan:

1. `pnpm build` clean (typecheck + lint) after each component.
2. Fresh Google signup (new email) → lands on `/onboarding`, not the
   dashboard; completing it creates a new `CompanyProfile` with only the
   generic defaults; the new user is `ADMIN`/`ACTIVE` of only that
   company.
3. Existing admin (Renata) still logs in normally, unaffected.
4. Existing admin creates a teammate via Users & RBAC → teammate lands in
   Renata's company, not a new one.
5. New public "Criar conta" signup → same onboarding path as Google.
6. Super-admin flag set on willcwb666's row manually → `/admin/companies`
   lists both companies; "Ver como" the new company shows only that
   company's data with the banner visible; "Sair" returns to normal.
7. A non-super-admin hitting the view-as API directly gets 403.
