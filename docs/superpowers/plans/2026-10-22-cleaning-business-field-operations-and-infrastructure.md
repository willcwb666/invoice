# Cleaning Field Operations, Resilient Infrastructure & Cleaner Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the system into a resilient field service management platform with intraday background dispatching, multi-cleaner conflict prevention, structured property access codes, a restricted mobile Cleaner Portal, room checklists with photo proofs, and post-job review boosters.

**Architecture:** Layered modular architecture (Approach 1) separating database schema & security foundations, multi-cleaner conflict detection, hybrid cron/heartbeat background workers, and dedicated mobile field UI for cleaners.

**Tech Stack:** Next.js 16 (App Router, Turbopack), Prisma ORM, PostgreSQL, Tailwind CSS v4, Lucide React, Framer Motion, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-22-cleaning-business-field-operations-and-infrastructure.md`

## Global Constraints
- Zero regressions across existing 54 routes and 44 tests.
- Zero financial exposure to `Role: CLEANER` (all prices, invoices, billing types and company revenue must be stripped).
- All changes must be verified with `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm build`.
- No mock data or unverified claims; test assertions before commits.

---

### Task 1: Prisma Schema Updates & Migration for Access Fields, Checklists, Photos & Cleaner Role

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/__tests__/schema-access-fields.test.ts`

**Interfaces:**
- Produces:
  - `Client`: `entryCode`, `alarmCode`, `pets`, `parkingInstructions`
  - `Appointment`: `entryCode`, `alarmCode`, `pets`, `parkingInstructions`
  - `CompanyProfile`: `googleReviewUrl`
  - `User`: `role: CLEANER`, `professionalId`
  - `AppointmentChecklist`: `id`, `appointmentId`, `room`, `task`, `completed`, `completedAt`, `completedBy`
  - `AppointmentPhoto`: `id`, `appointmentId`, `photoType`, `room`, `imageUrl`, `caption`, `uploadedAt`

- [ ] **Step 1: Write unit test validating schema extension fields in Prisma**
- [ ] **Step 2: Update `prisma/schema.prisma` with new models and fields**
- [ ] **Step 3: Run `npx prisma db push` or `npx prisma generate` to generate Prisma Client**
- [ ] **Step 4: Run test to confirm Prisma types match specification**
- [ ] **Step 5: Commit schema updates**

---

### Task 2: Multi-Cleaner Scheduling Conflict Detection Engine

**Files:**
- Modify: `src/lib/scheduling/conflict.ts`
- Modify: `src/services/appointment-service.ts`
- Create: `src/app/api/v1/appointments/check-conflict/route.ts`
- Modify: `src/components/ui/appointment-modal.tsx`
- Modify: `src/app/api/v1/public/estimates/[token]/book/route.ts`
- Test: `src/__tests__/scheduling-conflict-multi.test.ts`

**Interfaces:**
- Produces:
  - `AppointmentService.checkSchedulingConflict({ companyId, startTime, endTime, professionalIds, excludeAppointmentId })`
  - Endpoint: `POST /api/v1/appointments/check-conflict`

- [ ] **Step 1: Write unit tests in `src/__tests__/scheduling-conflict-multi.test.ts` covering single & multi-cleaner overlaps**
- [ ] **Step 2: Implement `checkSchedulingConflict` in `src/lib/scheduling/conflict.ts` and `AppointmentService`**
- [ ] **Step 3: Add `POST /api/v1/appointments/check-conflict` API route with RBAC protection**
- [ ] **Step 4: Add real-time conflict warning banner and override confirmation to `AppointmentModal`**
- [ ] **Step 5: Run tests and verify zero regressions**
- [ ] **Step 6: Commit conflict engine**

---

### Task 3: Unified Resilient Background Dispatcher (GPS Reminders & Abandoned Estimates)

**Files:**
- Create: `src/app/api/v1/cron/dispatcher/route.ts`
- Create: `src/lib/hooks/use-dispatcher-heartbeat.ts`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `vercel.json`
- Test: `src/__tests__/cron-dispatcher.test.ts`

**Interfaces:**
- Produces:
  - `POST /api/v1/cron/dispatcher` (Executes pending departure pushes, daily reminders sync, abandoned estimates, and 60m Google review follow-ups)
  - `useDispatcherHeartbeat()` hook running throttled background tick when app is active

- [ ] **Step 1: Write unit tests for dispatcher route logic and atomic locking in `src/__tests__/cron-dispatcher.test.ts`**
- [ ] **Step 2: Implement `/api/v1/cron/dispatcher/route.ts` with atomic DB lock and error isolation**
- [ ] **Step 3: Create `useDispatcherHeartbeat` hook with 3-minute local debounce**
- [ ] **Step 4: Mount heartbeat in dashboard layout and update `vercel.json`**
- [ ] **Step 5: Verify all tests pass**
- [ ] **Step 6: Commit dispatcher architecture**

---

### Task 4: RBAC Security & Financial Isolation for `Role: CLEANER`

**Files:**
- Modify: `src/lib/security/rbac.ts`
- Modify: `src/lib/security/permissions.ts`
- Modify: `src/services/appointment-service.ts`
- Modify: `src/app/api/v1/appointments/route.ts`
- Test: `src/__tests__/cleaner-rbac.test.ts`

**Interfaces:**
- Produces:
  - `Role: CLEANER` with screen access restricted to `cleaner` and `profile`
  - Payload sanitizer removing `price`, `invoiced`, `invoiceId`, `billingType` for cleaners

- [ ] **Step 1: Write unit tests verifying financial data stripping and route protection for `Role: CLEANER`**
- [ ] **Step 2: Update `src/lib/security/rbac.ts` and `permissions.ts` with `CLEANER` role definitions**
- [ ] **Step 3: Update `AppointmentService.listAppointments` and API route to filter by `user.professionalId` and sanitize output**
- [ ] **Step 4: Run tests to confirm zero data leakage**
- [ ] **Step 5: Commit cleaner RBAC**

---

### Task 5: Mobile-First Cleaner Portal (`/cleaner`)

**Files:**
- Create: `src/app/(dashboard)/cleaner/page.tsx`
- Modify: `src/components/dashboard/sidebar.tsx`
- Modify: `src/components/dashboard/mobile-nav.tsx`
- Modify: `src/app/(dashboard)/page.tsx` (redirect cleaner to `/cleaner`)

**Interfaces:**
- Produces:
  - `/cleaner` route displaying assigned houses today, 1-click GPS, access cards, and job progress status

- [ ] **Step 1: Implement mobile-first `/cleaner` page with house cards, access badges, and GPS integration**
- [ ] **Step 2: Add status action buttons ("Iniciar Limpeza" / "Finalizar Limpeza")**
- [ ] **Step 3: Update navigation to show only Cleaner Portal for `Role: CLEANER`**
- [ ] **Step 4: Add auto-redirect from dashboard root `/` to `/cleaner` when logged in as cleaner**
- [ ] **Step 5: Verify compilation with `tsc` and Turbopack**
- [ ] **Step 6: Commit cleaner portal**

---

### Task 6: Room-by-Room Checklists & Before/After Photo Uploads

**Files:**
- Create: `src/app/api/v1/appointments/[id]/checklists/route.ts`
- Create: `src/app/api/v1/appointments/[id]/photos/route.ts`
- Create: `src/components/cleaner/checklist-modal.tsx`
- Create: `src/components/cleaner/photo-upload-modal.tsx`
- Modify: `src/app/(dashboard)/cleaner/page.tsx`
- Test: `src/__tests__/appointment-checklists.test.ts`

**Interfaces:**
- Produces:
  - API endpoints for getting/updating checklist items and uploading before/after photos
  - Interactive room-by-room UI on cleaner portal

- [ ] **Step 1: Write unit tests for checklist template seeding and photo attachment**
- [ ] **Step 2: Create API routes for checklists and photos**
- [ ] **Step 3: Implement `ChecklistModal` and `PhotoUploadModal` components**
- [ ] **Step 4: Integrate checklist & photo triggers into `/cleaner` job cards**
- [ ] **Step 5: Verify tests pass**
- [ ] **Step 6: Commit checklists and photos**

---

### Task 7: Client "On My Way" (ETA) Alert & Google Review Booster

**Files:**
- Create: `src/app/api/v1/appointments/[id]/en-route/route.ts`
- Modify: `src/services/departure-reminder-service.ts`
- Modify: `src/app/(dashboard)/cleaner/page.tsx`
- Modify: `src/components/ui/appointment-modal.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx` (Google Review URL input)

**Interfaces:**
- Produces:
  - 1-click "Avisar que estou a caminho" with calculated drive time and pre-filled SMS/WhatsApp text
  - Automatic 60-min post-completion follow-up scheduling for Google Review

- [ ] **Step 1: Implement `POST /api/v1/appointments/[id]/en-route` calculating real ETA and returning notification payload**
- [ ] **Step 2: Hook up 60m Google review follow-up in `AppointmentService.updateStatus` when marked `COMPLETED`**
- [ ] **Step 3: Add Google Review Link configuration in `SettingsPage`**
- [ ] **Step 4: Add "A caminho" button in Cleaner Portal and Appointment cards**
- [ ] **Step 5: Verify tests and run Turbopack build**
- [ ] **Step 6: Commit ETA alert and Google review booster**

---

### Task 8: Full End-to-End Validation, Test Suite & Documentation

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run full unit test suite `pnpm test`**
- [ ] **Step 2: Run strict TypeScript type check `pnpm exec tsc --noEmit`**
- [ ] **Step 3: Run production Turbopack build `pnpm build`**
- [ ] **Step 4: Update `CHANGELOG.md` with complete documentation of all 7 deliverables**
- [ ] **Step 5: Commit and push to `origin main`**
