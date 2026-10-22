# Payments Actions Buttons, Past/Today Filter & Invoice Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify completion and payment toggles on the Payments page into a standard "Ações" column using `ActionButton`, restrict payments strictly to today and past appointments, and synchronize invoice payment status directly with all linked appointments.

**Architecture:** Update `PaymentService.listPayments` to enforce `date <= endOfTodayInDenver`. Enhance `InvoiceService.updateInvoiceStatus` and `createInvoice` to update all linked appointments (`where: { invoiceId }`) to `paid: true` when `status === "PAID"` and `paid: false` when reverted. Update `src/app/(dashboard)/payments/page.tsx` with `<ActionButton />` components for completion and payment toggles.

**Tech Stack:** Next.js 16 (App Router), Prisma ORM, TypeScript, Tailwind CSS, `ActionButton` component, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-22-payments-actions-buttons-and-invoice-sync-design.md`

## Global Constraints

- Payments must NEVER display future appointments (strictly today and older).
- Invoices marked as `PAID` must automatically mark their linked appointments (`appointment.invoiceId === invoice.id`) as `paid: true`.
- Reverting an invoice away from `PAID` must revert its linked appointments to `paid: false`.
- The Payments page must use the shared `<ActionButton />` component (`@/components/ui/action-button`) with standard tooltips and colors.
- All existing tests and `pnpm build` must pass with zero errors.

## Review Focus

- Appointments scheduled for tomorrow or later: must not be returned by `PaymentService.listPayments`.
- Appointments for today: must be included and allow toggling completion and payment.
- Invoice paid status transition: marking an invoice paid must immediately update all its linked appointments in the database.
- ActionButton click isolation: clicking an ActionButton inside the row must not trigger row-level click events (`stopPropagation`).

---

### Task 1: Past/Today Payments Filter & Invoice-Appointment Sync (TDD)

**Files:**
- Modify: `src/services/payment-service.ts`
- Modify: `src/services/invoice-service.ts`
- Modify: `src/__tests__/payment-completion-service.test.ts`
- Create: `src/__tests__/invoice-appointment-sync.test.ts`

- [ ] **Step 1: Write failing unit tests**
  - In `src/__tests__/payment-completion-service.test.ts`, add test ensuring `PaymentService.listPayments` caps `date` to end of today.
  - In `src/__tests__/invoice-appointment-sync.test.ts`, test:
    - `InvoiceService.updateInvoiceStatus(id, companyId, "PAID")` updates linked appointments to `paid: true, paidAt: Date`.
    - `InvoiceService.updateInvoiceStatus(id, companyId, "PENDING")` reverts linked appointments to `paid: false, paidAt: null`.
    - `InvoiceService.createInvoice` with `data.status: "PAID"` sets linked appointments to `paid: true`.

- [ ] **Step 2: Run test to make sure it fails**
  Run `pnpm test src/__tests__/invoice-appointment-sync.test.ts`.

- [ ] **Step 3: Implement Backend Changes**
  - In `src/services/payment-service.ts`:
    - Calculate `endOfTodayInDenver`:
      ```ts
      const now = new Date();
      // Calculate end of today in Denver (23:59:59.999)
      const denverStr = now.toLocaleDateString("en-US", { timeZone: "America/Denver" });
      const [m, d, y] = denverStr.split("/").map(Number);
      const endOfToday = new Date(Date.UTC(y, m - 1, d, 23 + 6, 59, 59, 999));
      ```
    - In `listPayments` query:
      `date: { ...(from ? { gte: from } : {}), lte: to && to < endOfToday ? to : endOfToday }`
  - In `src/services/invoice-service.ts`:
    - In `updateInvoiceStatus`:
      ```ts
      if (status === "PAID") {
        await prisma.appointment.updateMany({
          where: { invoiceId: id, companyId },
          data: { paid: true, paidAt: invoice.paidAt || new Date() },
        });
      } else {
        await prisma.appointment.updateMany({
          where: { invoiceId: id, companyId },
          data: { paid: false, paidAt: null },
        });
      }
      ```
    - In `createInvoice`:
      When `appointments.length > 0`:
      ```ts
      await tx.appointment.updateMany({
        where: { id: { in: appointments.map((a) => a.id) } },
        data: {
          invoiced: true,
          invoiceId: invoice.id,
          paid: isPaid,
          paidAt: isPaid ? new Date() : null,
        },
      });
      ```

- [ ] **Step 4: Run tests and verify**
  Run `pnpm test src/__tests__/invoice-appointment-sync.test.ts` and `pnpm test`.

- [ ] **Step 5: Commit**
  Run `git add src/services/payment-service.ts src/services/invoice-service.ts src/__tests__/` and commit as `feat(payments): cap payments to past/today and sync invoice payment status with appointments`.

---

### Task 2: Single-Line Layout with ActionButton in Payments Page

**Files:**
- Modify: `src/app/(dashboard)/payments/page.tsx`

- [ ] **Step 1: Replace separate flag columns with "Ações" column using `ActionButton`**
  In `src/app/(dashboard)/payments/page.tsx`:
  - Import `ActionButton` from `@/components/ui/action-button`.
  - Update header to: `Data - Hora Início | Cliente | Serviço | Status & Total | Ações`.
  - In `renderSingleLineRow(appt)`:
    - Replace the two separate button divs with:
      ```tsx
      <div className="w-28 shrink-0 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        <ActionButton
          icon={isCompleted ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
          tooltip={isCompleted ? "Concluído (clique para reverter)" : "Marcar como Concluído"}
          hoverColor="purple"
          activeColor={isCompleted ? "none" : "none"}
          disabled={isBusy}
          onClick={() => toggleCompleted(appt.id)}
        />
        <ActionButton
          icon={appt.paid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Circle className="w-3.5 h-3.5 text-slate-400" />}
          tooltip={appt.paid ? "Pago (clique para reverter para pendente)" : "Marcar como Pago"}
          hoverColor="green"
          activeColor={appt.paid ? "green" : "none"}
          disabled={isBusy}
          onClick={() => togglePaid(appt.id, appt.paid)}
        />
      </div>
      ```

- [ ] **Step 2: Verify TypeScript & Tests**
  Run `pnpm exec tsc --noEmit` and `pnpm test`.

- [ ] **Step 3: Commit**
  Run `git add src/app/(dashboard)/payments/page.tsx` and commit as `feat(ui): use ActionButton in unified Ações column on payments page`.

---

### Task 3: Full Verification & Vercel Push

**Files:**
- Run: `pnpm test`
- Run: `pnpm build`
- Git: `git push origin main`

- [ ] **Step 1: Run complete test suite**
  Run `pnpm test` and verify 100% pass rate.

- [ ] **Step 2: Run production Next.js build**
  Run `pnpm build` and verify 0 errors.

- [ ] **Step 3: Deploy to Vercel via Git Push**
  Run `git push origin main`.
