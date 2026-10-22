# Single-Line Payments & Appointment Completion Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Payments page into a clean single-line per appointment layout with real-time status dots (green, red, orange) and two instant interactive flags (Concluído and Pago), and integrate the completion flag into the appointment creation/editing workflow.

**Architecture:** Update `PaymentService.listPayments` to include non-cancelled billable appointments (`SCHEDULED` and `COMPLETED`) with their associated service relations. Add completion toggle actions to `PaymentService` and the `/api/v1/payments/[id]` & `/api/v1/payments/bulk` endpoints. Redesign `src/app/(dashboard)/payments/page.tsx` into a responsive single-line table/list format. Add a dedicated "Atendimento Concluído" flag to `AppointmentModal`.

**Tech Stack:** Next.js 16 (App Router), Prisma ORM, TypeScript, Tailwind CSS, Lucide icons, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-22-single-line-payments-completion-flag-design.md`

## Global Constraints

- Never break existing payment calculation or billing isolation: `invoiced: false` and `billable: true` remain mandatory.
- Appointment completion is represented by the native `AppointmentStatus` (`COMPLETED` vs `SCHEDULED`) to preserve 100% synchrony with Agenda, Commissions, and Reports.
- Status dot colors:
  - 🟢 Green (`#10b981`): Paid (`paid === true`).
  - 🔴 Red (`#ef4444`): Overdue (`paid === false` and date < today).
  - 🟠 Orange (`#f59e0b`): Pending (`paid === false` and date >= today).
- Single-line guarantee: Each appointment row on the Payments page renders in a single horizontal line (`Data - Hora | Cliente | Serviço | Bolinha Total: $Valor | Flag Concluído | Flag Pago`).
- All existing tests and production builds must pass with zero errors.

## Review Focus

- Unscheduled/future appointments: must appear in payments list and allow marking as completed and/or paid.
- Toggling completed on an appointment: must immediately update status to `COMPLETED` or revert to `SCHEDULED` without throwing errors.
- Toggling paid on an appointment: must update `paid` without requiring prior manual completion.
- Formatting of date and time: must display `DD/MM/YYYY - hh:mm AM/PM` cleanly in the Colorado business timezone.
- Mobile view: must keep the single-line structure intact via horizontal scroll container (`min-w-[720px]`) rather than breaking onto multiple lines.

---

### Task 1: Backend Service & Route Updates (TDD)

**Files:**
- Modify: `src/services/payment-service.ts`
- Modify: `src/app/api/v1/payments/[id]/route.ts`
- Modify: `src/app/api/v1/payments/bulk/route.ts`
- Create: `src/__tests__/payment-completion-service.test.ts`

- [ ] **Step 1: Write the failing unit tests**
  Create `src/__tests__/payment-completion-service.test.ts` testing:
  - `PaymentService.listPayments` retrieves both `SCHEDULED` and `COMPLETED` appointments with service relations.
  - `PaymentService.toggleCompleted` flips status between `COMPLETED` and `SCHEDULED`.
  - `PaymentService.markPaid` successfully marks an appointment paid without throwing status mismatch errors.
  - `PATCH /api/v1/payments/[id]` processes `action: "toggle_completed"`, `action: "mark_completed"`, and `action: "mark_uncompleted"`.

- [ ] **Step 2: Run test to make sure it fails**
  Run `pnpm test src/__tests__/payment-completion-service.test.ts`.

- [ ] **Step 3: Implement Backend Changes**
  In `src/services/payment-service.ts`:
  - Update `listPayments` query:
    ```ts
    status: { in: ["SCHEDULED", "COMPLETED", "IN_PROGRESS"] }
    ```
    and include:
    ```ts
    services: { include: { service: { select: { id: true, name: true } } } }
    ```
  - Add `toggleCompleted(id: string, companyId: string)`:
    - Fetches appointment.
    - If status === "COMPLETED", updates to "SCHEDULED".
    - Else updates to "COMPLETED".
  - In `markPaid`: remove `if (appt.status !== "COMPLETED") throw new Error(...)` to allow flexible standalone payment registration.
  In `src/app/api/v1/payments/[id]/route.ts`:
  - Support `action === "toggle_completed"`, `action === "mark_completed"`, `action === "mark_uncompleted"`.
  In `src/app/api/v1/payments/bulk/route.ts`:
  - Support `action === "COMPLETE"` and `action === "UNCOMPLETE"` in addition to `PAID` / `UNPAID`.

- [ ] **Step 4: Run tests and verify**
  Run `pnpm test src/__tests__/payment-completion-service.test.ts`.

- [ ] **Step 5: Commit**
  Run `git add src/services/payment-service.ts src/app/api/v1/payments/ src/__tests__/payment-completion-service.test.ts` and commit as `feat(payments): allow scheduled appointments, service inclusion, and completion toggles`.

---

### Task 2: Single-Line Layout on Payments Page

**Files:**
- Modify: `src/app/(dashboard)/payments/page.tsx`

- [ ] **Step 1: Update payment list items to single-line format**
  In `src/app/(dashboard)/payments/page.tsx`:
  - Format date & time helper: `formatDateTime(appt.date, appt.startTime)` -> `DD/MM/YYYY - hh:mm AM/PM`.
  - Service name helper: extract `appt.services?.[0]?.service?.name || appt.title`.
  - Status dot:
    - 🟢 Green if `appt.paid`
    - 🔴 Red if `isOverdue(appt)`
    - 🟠 Orange if `!appt.paid && !isOverdue(appt)`
  - Value format: `Total: $XX.XX`
  - Flag Concluído:
    - Checkbox with label "Concluído"
    - Checked when `appt.status === "COMPLETED"`
    - Handler: calls `PATCH /api/v1/payments/${appt.id}` with `{ action: "toggle_completed" }`
  - Flag Pago:
    - Checkbox with label "Pago"
    - Checked when `appt.paid === true`
    - Handler: calls `markPaid(appt.id)` or `markUnpaid(appt.id)`

- [ ] **Step 2: Ensure responsive single-line layout**
  - Implement a dedicated table/row header and rows with:
    `min-w-[780px]` horizontal scroll container to guarantee that all 6 elements remain strictly on a single line on any screen size.
  - Apply clean borders, hover states, and smooth checkbox toggling with processing spinner state.

- [ ] **Step 3: Update bulk actions**
  - Add quick bulk actions: "Marcar Concluído" / "Desmarcar Concluído" alongside "Marcar Pago" / "Marcar Pendente".

- [ ] **Step 4: Run tests & verify**
  Run `pnpm test` and `pnpm exec tsc --noEmit`.

- [ ] **Step 5: Commit**
  Run `git add src/app/(dashboard)/payments/page.tsx` and commit as `feat(ui): redesign payments page into single-line rows with completion and payment flags`.

---

### Task 3: Appointment Modal Completion Flag

**Files:**
- Modify: `src/components/ui/appointment-modal.tsx`

- [ ] **Step 1: Add completion checkbox to AppointmentModal**
  In `src/components/ui/appointment-modal.tsx`:
  - Add a dedicated, clean checkbox / toggle section:
    - Label: *"Atendimento Concluído"*
    - Subtitle: *"Marque quando o serviço na residência tiver sido finalizado"*
    - State: `status === "COMPLETED"`
    - When checked: `setStatus("COMPLETED")`
    - When unchecked: `setStatus("SCHEDULED")`
  - Display this control prominently in the form, accessible both when creating a new appointment and when editing an existing appointment.

- [ ] **Step 2: Run verification**
  Run `pnpm exec tsc --noEmit` and `pnpm test`.

- [ ] **Step 3: Commit**
  Run `git add src/components/ui/appointment-modal.tsx` and commit as `feat(agenda): add clear completion flag in AppointmentModal for creation and editing`.

---

### Task 4: Full Verification & Vercel Deployment

**Files:**
- Run: `pnpm test`
- Run: `pnpm build`
- Git: `git push origin main`

- [ ] **Step 1: Run complete test suite**
  Run `pnpm test` and verify 100% pass rate.

- [ ] **Step 2: Run production Next.js build**
  Run `pnpm build` and verify all routes compile cleanly.

- [ ] **Step 3: Deploy to Vercel via Git Push**
  Run `git push origin main`.
