# Address Sanitization, Normalization & Automatic Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a centralized address normalizer engine that cleans noisy iCloud/Apple Calendar addresses, integrates into RentCast queries with automatic zip fallback, updates UI and iCloud sync imports, and sanitizes existing client records in the database.

**Architecture:** Implement `src/lib/address-normalizer.ts` with comprehensive unit tests in `src/__tests__/address-normalizer.test.ts`. Wire it into `RentCastService`, `ClientDetailPage`, `ClientModal`, and `icloud.ts`. Create a database hygiene script `scripts/sanitize-client-addresses.ts` to clean up existing database records and backfill property dimensions.

**Tech Stack:** Next.js 16, TypeScript, Prisma ORM, Vitest, RentCast API.

**Spec:** `docs/superpowers/specs/2026-10-22-address-sanitization-and-enrichment-design.md`

## Global Constraints

- Never mutate street address numbers or street names (only remove country noise, newlines, duplicate cities, and hyphens).
- Preserve existing companyId multi-tenant boundaries.
- Fallback queries must automatically drop the zip code when initial query yields 0 results.
- All existing tests and production builds must pass with 0 errors.

## Review Focus

- Multi-line addresses with `\n` or `\r` (common from Apple Calendar).
- Suffixes like `United States`, `USA`, `US`.
- Hyphenated state codes (`- CO` vs `, CO`).
- Discrepant zip codes (e.g. 80538 vs 80537 on Aries Dr).
- Database migration script idempotency.

---

### Task 1: Central AddressNormalizer Engine (TDD)

**Files:**
- Create: `src/lib/address-normalizer.ts`
- Create: `src/__tests__/address-normalizer.test.ts`

- [ ] **Step 1: Write failing unit tests**
  Create `src/__tests__/address-normalizer.test.ts` covering:
  - Amber's address: `"2109 Outer Banks Ct\nWindsor, CO, United States"` -> street: `"2109 Outer Banks Ct"`, city: `"Windsor"`, state: `"CO"`.
  - Alissa's address: `"3068 Aries Drive, Loveland, Loveland - CO 80538"` -> street: `"3068 Aries Drive"`, city: `"Loveland"`, state: `"CO"`, zipCode: `"80538"`.
  - Full address and fallback address generation.
  - Comma-delimited USA address: `"10309 West 11th Street, Greeley, CO, USA"` -> street: `"10309 West 11th Street"`, city: `"Greeley"`.

- [ ] **Step 2: Run test to make sure it fails**
  Run `pnpm test src/__tests__/address-normalizer.test.ts`.

- [ ] **Step 3: Implement `AddressNormalizer`**
  Implement `src/lib/address-normalizer.ts` with regex parsing, cleaning, and normalization functions.

- [ ] **Step 4: Run tests and verify**
  Run `pnpm test src/__tests__/address-normalizer.test.ts`. Verify 100% pass.

- [ ] **Step 5: Commit**
  `git add src/lib/address-normalizer.ts src/__tests__/address-normalizer.test.ts`
  `git commit -m "feat(address): add AddressNormalizer engine with comprehensive cleaning rules"`

---

### Task 2: Integrate AddressNormalizer into RentCastService & UI Pages

**Files:**
- Modify: `src/services/rentcast-service.ts`
- Modify: `src/app/(dashboard)/clients/[id]/page.tsx`
- Modify: `src/components/ui/client-modal.tsx`
- Modify: `src/__tests__/rentcast-service.test.ts`

- [ ] **Step 1: Update `RentCastService`**
  Use `AddressNormalizer.normalizeAddress` in `RentCastService.fetchProperty`.
  Try `normalized.fullAddress`. If 0 results and `normalized.fallbackAddress` exists, query `fallbackAddress`.

- [ ] **Step 2: Update `ClientDetailPage` and `ClientModal`**
  Use `AddressNormalizer` to extract clean street and full address for lookup and display.

- [ ] **Step 3: Run unit tests**
  Run `pnpm test` and verify all tests pass.

- [ ] **Step 4: Commit**
  `git add src/services/rentcast-service.ts src/app/(dashboard)/clients/[id]/page.tsx src/components/ui/client-modal.tsx src/__tests__/rentcast-service.test.ts`
  `git commit -m "feat(rentcast): integrate AddressNormalizer into RentCast queries and client views"`

---

### Task 3: Integrate into iCloud Sync Import & Database Sanitization Script

**Files:**
- Modify: `src/lib/calendar/icloud.ts`
- Create: `scripts/sanitize-client-addresses.ts`

- [ ] **Step 1: Update iCloud Sync**
  In `src/lib/calendar/icloud.ts` (lines ~1290-1325), use `AddressNormalizer` when creating `autoClient` and passing address to `RentCastService.fetchProperty`.

- [ ] **Step 2: Create Database Sanitization Script**
  Create `scripts/sanitize-client-addresses.ts`:
  - Fetch all clients with raw addresses.
  - Normalize address, city, state, zipCode.
  - Update `prisma.client`.
  - Optionally call RentCast to backfill missing property specs if API key is present.

- [ ] **Step 3: Execute the script on existing database**
  Run `pnpm exec tsx scripts/sanitize-client-addresses.ts`.
  Verify Amber and Alissa's records are now clean!

- [ ] **Step 4: Commit**
  `git add src/lib/calendar/icloud.ts scripts/sanitize-client-addresses.ts`
  `git commit -m "feat(clients): sanitize existing client addresses in db and normalize incoming icloud events"`

---

### Task 4: Full Verification & Vercel Push

**Files:**
- Run: `pnpm test`
- Run: `pnpm exec tsc --noEmit`
- Run: `pnpm build`
- Git: `git push origin main`

- [ ] **Step 1: Run full test suite and tsc**
  Ensure all unit tests and TypeScript compile cleanly.

- [ ] **Step 2: Run production Next.js build**
  Confirm 0 errors on `pnpm build`.

- [ ] **Step 3: Deploy to Vercel via Git Push**
  Push to `origin main` so production has the clean engine and deployed fixes.
