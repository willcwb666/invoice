# RentCast Property Integration & Address Autofill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Mapbox Address Autofill and RentCast Property API into the client registration workflow, automatically capturing bedrooms, bathrooms, and square footage upon address blur and background iCloud calendar sync.

**Architecture:** Extend Prisma `Client` model with property fields. Create `RentCastService` with in-memory caching to consume `GET https://api.rentcast.io/v1/properties`. Expose `GET /api/v1/properties/lookup`. Integrate Mapbox Address suggestions and onBlur lookup with live toasts in `ClientModal`, and wire background enrichment into `CalendarSyncService`.

**Tech Stack:** Next.js 16 (Turbopack, App Router), Prisma ORM (PostgreSQL), Vitest, Zod, Mapbox Search Box API, RentCast API.

**Spec:** `docs/superpowers/specs/2026-10-22-rentcast-property-integration-design.md`

## Global Constraints

- Never break existing client registration if RentCast API key is missing or fails (graceful degradation to manual entry).
- Zero database downtime: schema fields are all optional (`Int?`, `Float?`, `String?`).
- Rate limiting and caching must protect monthly RentCast quota (50 calls/month on free tier).
- Mapbox Address Autofill must be purely additive; users can still manually type custom addresses.
- Preserve all existing tests and ensure `pnpm test` and `pnpm build` pass with zero errors.

## Review Focus

- Empty or invalid address in RentCast: must return `{ found: false }` gracefully without throwing 500 error.
- Non-US or rural addresses not in RentCast: must allow manual input of beds/baths/sqft.
- Missing `RENTCAST_API_KEY`: must log warning and return `{ found: false, message: "RentCast API key não configurada" }` without crashing.
- Duplicate address lookup: memory cache must return existing property data without burning API credit.
- Fractional bathrooms (e.g., `1.5`, `2.5`): Prisma and UI must store and display float values properly without truncating to integers.

---

### Task 1: Prisma Schema & Database Migration

**Files:**
- Modify: `prisma/schema.prisma:247-270`
- Test: `src/__tests__/client-schema.test.ts`

- [ ] **Step 1: Write the failing test**
  Create `src/__tests__/client-schema.test.ts` verifying that Prisma Client type definitions and queries recognize `bedrooms`, `bathrooms`, `squareFeet`, and `propertyType`.

- [ ] **Step 2: Run test to make sure it fails**
  Run `pnpm test src/__tests__/client-schema.test.ts`.

- [ ] **Step 3: Update Prisma schema**
  Add `bedrooms Int?`, `bathrooms Float?`, `squareFeet Int?`, and `propertyType String?` to `model Client` in `prisma/schema.prisma`.

- [ ] **Step 4: Push to Database and generate Prisma client**
  Run `npx prisma db push` to apply the nullable columns to the Supabase Postgres database and generate updated Prisma client types.

- [ ] **Step 5: Run tests and verify**
  Run `pnpm test src/__tests__/client-schema.test.ts` and ensure it passes.

- [ ] **Step 6: Commit**
  Run `git add prisma/schema.prisma src/__tests__/client-schema.test.ts` and commit as `feat(db): add property dimensions (bedrooms, bathrooms, squareFeet) to client model`.

---

### Task 2: RentCast Service & Unit Tests (TDD)

**Files:**
- Create: `src/services/rentcast-service.ts`
- Test: `src/__tests__/rentcast-service.test.ts`

- [ ] **Step 1: Write the failing unit tests**
  Create `src/__tests__/rentcast-service.test.ts` with test cases:
  - Fetches property data from RentCast API when address is provided.
  - Caches repeated calls to the same address to save API quota.
  - Returns `null` when property is not found (404/empty array).
  - Handles missing API key gracefully without throwing unhandled exceptions.

- [ ] **Step 2: Run test to make sure it fails**
  Run `pnpm test src/__tests__/rentcast-service.test.ts`.

- [ ] **Step 3: Implement RentCastService**
  Create `src/services/rentcast-service.ts`:
  - `fetchProperty(address: string): Promise<PropertyData | null>`
  - Uses `process.env.RENTCAST_API_KEY`.
  - Normalizes address string and checks in-memory `Map<string, PropertyData>` cache.
  - Calls `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}`.
  - Extracts `{ bedrooms, bathrooms, squareFeet: squareFootage, propertyType, formattedAddress }`.

- [ ] **Step 4: Run tests and make sure they pass**
  Run `pnpm test src/__tests__/rentcast-service.test.ts`.

- [ ] **Step 5: Commit**
  Run `git add src/services/rentcast-service.ts src/__tests__/rentcast-service.test.ts` and commit as `feat(services): implement RentCastService with property caching and normalizer`.

---

### Task 3: Property Lookup API Route & Client Validation

**Files:**
- Create: `src/app/api/v1/properties/lookup/route.ts`
- Modify: `src/lib/validations/client.ts`
- Modify: `src/services/client-service.ts`
- Test: `src/__tests__/properties-lookup-route.test.ts`

- [ ] **Step 1: Update client validation schema**
  In `src/lib/validations/client.ts`, add optional fields:
  - `bedrooms: z.number().int().min(0).nullable().optional()`
  - `bathrooms: z.number().min(0).nullable().optional()`
  - `squareFeet: z.number().int().min(0).nullable().optional()`
  - `propertyType: z.string().trim().max(100).nullable().optional()`

- [ ] **Step 2: Update ClientService**
  In `src/services/client-service.ts`, ensure `create` and `update` persist `bedrooms`, `bathrooms`, `squareFeet`, `propertyType`.

- [ ] **Step 3: Implement API Route**
  Create `src/app/api/v1/properties/lookup/route.ts`:
  - Validates session or token.
  - Extracts `address` from search params.
  - Calls `RentCastService.fetchProperty(address)`.
  - Returns `{ success: true, found: boolean, data: PropertyData | null }`.

- [ ] **Step 4: Write integration test**
  Create `src/__tests__/properties-lookup-route.test.ts` and verify handler response.

- [ ] **Step 5: Run tests and verify**
  Run `pnpm test`.

- [ ] **Step 6: Commit**
  Run `git add src/app/api/v1/properties/ src/lib/validations/client.ts src/services/client-service.ts src/__tests__/` and commit as `feat(api): add property lookup route and client dimension validations`.

---

### Task 4: Interactive Client Modal with Mapbox Autofill & OnBlur Toast

**Files:**
- Modify: `src/components/ui/client-modal.tsx`

- [ ] **Step 1: Add property dimension state to ClientModal**
  In `src/components/ui/client-modal.tsx`:
  - Add `bedrooms: number | ""`
  - Add `bathrooms: number | ""`
  - Add `squareFeet: number | ""`
  - Add `propertyType: string`
  - Add `isFetchingProperty: boolean`

- [ ] **Step 2: Implement onBlur handler for address**
  When address input loses focus (`handleAddressBlur`):
  - If address is at least 6 characters and has changed:
    - Trigger `showToast("Consultando dados do imóvel na RentCast...", "info", 4000)`
    - Call `/api/v1/properties/lookup?address=${encodeURIComponent(address)}`
    - If found: populate `bedrooms`, `bathrooms`, `squareFeet`, `propertyType`.
    - Trigger `showToast("✓ Imóvel encontrado: X quartos, Y banheiros, Z sqft", "success", 5000)`
    - If not found: leave inputs for manual typing without error toast.

- [ ] **Step 3: Integrate Mapbox Address suggestion dropdown**
  Add interactive Mapbox address suggestion dropdown below the address input:
  - When typing in address input, query Mapbox Search Suggestions (`api.mapbox.com/search/searchbox/v1/suggest`) if `NEXT_PUBLIC_MAPBOX_TOKEN` is present.
  - Clicking a suggestion auto-fills street, city, state, and zipCode, and triggers RentCast lookup immediately.

- [ ] **Step 4: Render property inputs in modal**
  Add a dedicated row in the modal:
  - Quartos (`bedrooms` input, `type="number"`)
  - Banheiros (`bathrooms` input, `type="number" step="0.5"`)
  - Tamanho (`squareFeet` input, `type="number"` with `sqft` label)

- [ ] **Step 5: Verify build & modal behavior**
  Run `pnpm build` to verify JSX compilation and type-safety.

- [ ] **Step 6: Commit**
  Run `git add src/components/ui/client-modal.tsx` and commit as `feat(ui): add Mapbox address autofill, onBlur RentCast toast, and property fields in ClientModal`.

---

### Task 5: Background Enrichment during iCloud Sync & Client Profile UI

**Files:**
- Modify: `src/services/calendar-sync-service.ts`
- Modify: `src/app/(dashboard)/clients/[id]/page.tsx`
- Modify: `src/app/(dashboard)/clients/page.tsx`

- [ ] **Step 1: Background enrichment on calendar sync**
  In `src/services/calendar-sync-service.ts`:
  - When a client is created or updated from iCloud calendar with an address and has no `squareFeet`:
    - Dispatch background `RentCastService.fetchProperty(client.address)` without blocking the sync loop.
    - If found, update `prisma.client.update({ where: { id: client.id }, data: { bedrooms, bathrooms, squareFeet, propertyType } })`.

- [ ] **Step 2: Client Profile Property Card**
  In `src/app/(dashboard)/clients/[id]/page.tsx`:
  - Display a "Dimensões do Imóvel" card with:
    - `🛏️ X Quartos`
    - `🚿 Y Banheiros`
    - `📐 Z sqft`
    - `🏠 Tipo de Imóvel`
  - Add button *"Consultar RentCast Agora"* to refresh property data if empty or updated.

- [ ] **Step 3: Client List Badge**
  In `src/app/(dashboard)/clients/page.tsx`:
  - In the table row, render a small badge under the address: `${client.bedrooms} qts • ${client.bathrooms} banh • ${client.squareFeet.toLocaleString()} sqft` when present.

- [ ] **Step 4: Verify build & test**
  Run `pnpm test` and `pnpm build`.

- [ ] **Step 5: Commit**
  Run `git add src/services/calendar-sync-service.ts src/app/(dashboard)/clients/` and commit as `feat(clients): add background property enrichment on iCloud sync and property metrics in client views`.

---

### Task 6: Full Verification & Vercel Deployment

**Files:**
- Modify: `.env.example`
- Run: `pnpm test` & `pnpm build`

- [ ] **Step 1: Document environment variables in .env.example**
  Add `RENTCAST_API_KEY=""` and `NEXT_PUBLIC_MAPBOX_TOKEN=""` to `.env.example`.

- [ ] **Step 2: Run complete test suite**
  Run `pnpm test` and confirm 100% pass rate.

- [ ] **Step 3: Run full production build**
  Run `pnpm build` and confirm all routes build with zero warnings or errors.

- [ ] **Step 4: Push to Git for Vercel deploy**
  Run `git push origin main`.
