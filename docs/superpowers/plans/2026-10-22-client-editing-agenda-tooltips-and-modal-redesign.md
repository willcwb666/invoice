# Client Editing, Agenda Tooltips, Smart GPS Navigation & Appointment Modal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement inline client editing with save/cancel, unified smart GPS navigation (iOS action prompt vs direct Android/Web Google Maps), agenda appointment hover tooltips showing address and time, appointment modal layout overhaul with 20% increased width, 3-column services grid with extras toggle and 8-step reordered fields, and double-booking conflict prevention for public self-scheduling.

**Architecture:** A unified navigation launcher component/hook detects client OS (iOS vs Android/Desktop) to present Apple/Google Maps choices on iOS while auto-launching Google Maps elsewhere. Inline editing on `/clients/[id]` connects directly to `PATCH /api/v1/clients/[id]`. The `AppointmentModal` layout is restructured with a wider shell (`max-w-3xl sm:max-w-4xl`), removing redundant action buttons and ordering fields in 8 precise sections. Double-booking conflict guards are added in the public booking route and appointment service.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS, Lucide React, Framer Motion, Prisma ORM, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-22-client-editing-agenda-tooltips-and-modal-redesign.md`

## Global Constraints
- Preserve existing comment headers and docstrings.
- Maintain Next.js 15 rules (`node_modules/next/dist/docs/`).
- Do not break existing 35 unit tests in Vitest.
- Use AddressNormalizer when formatting addresses for GPS navigation.

## Review Focus
- iOS user-agent detection edge cases (iPad with MacIntel user agent).
- Client edit cancellation reverting all modified fields to persisted database values.
- Appointment hover tooltips must only appear on appointment elements; empty day cells must maintain their default creation tooltip.
- Services grid in AppointmentModal must handle name truncation gracefully with `title` tooltips.
- Public estimate self-booking must reject overlapping times with HTTP 409 and descriptive error.

---

### Task 1: Smart GPS Navigation Component & Hook
**Files:**
- Create: `src/components/ui/smart-navigation-button.tsx`
- Test: `tests/unit/smart-navigation.test.ts`

- [ ] **Step 1: Write test for navigation link generation and device detection**
  - Verify that iOS detection correctly identifies iPhone/iPad.
  - Verify that Google Maps URL is formed properly with encoded address.
  - Verify that Apple Maps URL is formed properly with encoded address.
- [ ] **Step 2: Run test to verify failure**
  - Run `pnpm test tests/unit/smart-navigation.test.ts`.
- [ ] **Step 3: Implement `SmartNavigationButton` and `useSmartNavigation`**
  - Create `src/components/ui/smart-navigation-button.tsx`.
  - On iOS, render action dialog / modal allowing user to choose "Apple Maps" or "Google Maps".
  - On Android and Desktop Web, open Google Maps directly in a new tab.
- [ ] **Step 4: Run tests and verify they pass**
  - Run `pnpm test tests/unit/smart-navigation.test.ts`.

---

### Task 2: Client Table & Inline Detail Editing
**Files:**
- Modify: `src/app/(dashboard)/clients/page.tsx`
- Modify: `src/app/(dashboard)/clients/[id]/page.tsx`
- Test: `tests/unit/client-editing.test.ts`

- [ ] **Step 1: Write test for client PATCH data contract**
  - Validate that client fields (name, phone, email, address, city, state, zipCode, billingType, notes, bedrooms, bathrooms, squareFeet) can be updated via `PATCH /api/v1/clients/[id]`.
- [ ] **Step 2: Update `/clients` table**
  - Replace dual Apple/Google Maps buttons with single `SmartNavigationButton`.
  - Replace `ArrowUpRight` "Ver Ficha Completa do Cliente" with `Pencil` icon and tooltip "Editar cadastro", linking to `/clients/${c.id}`.
- [ ] **Step 3: Update `/clients/[id]` detail page with editable fields & Save/Cancel**
  - Add editable state (`formData` initialized from `client`).
  - Add "Editar Cadastro" / "Salvar Alterações" / "Cancelar" actions.
  - On "Salvar", execute `PATCH /api/v1/clients/[id]`, show toast, update local state.
  - On "Cancelar", reset `formData` back to `client`.
  - Replace dual Apple/Google Maps buttons with single `SmartNavigationButton`.
- [ ] **Step 4: Run typecheck and tests**
  - Run `pnpm exec tsc --noEmit` and `pnpm test`.

---

### Task 3: Agenda Appointment Tooltips & Unified Navigation
**Files:**
- Modify: `src/app/(dashboard)/agenda/page.tsx`

- [ ] **Step 1: Add address & time tooltips on appointment elements**
  - In Month view: Add `title={`Horário: ${formatTime(appt.startTime)} - ${formatTime(appt.endTime)}\nEndereço: ${appt.location || "Sem endereço cadastrado"}`}` to appointment buttons.
  - In Week view: Add `title` to appointment cards.
  - In Today/List view (`renderAppointmentCard`): Add `title` to appointment cards.
- [ ] **Step 2: Ensure empty day cells keep default tooltip**
  - Keep `title="Clique em uma área em branco para criar um novo agendamento neste dia"` intact on day containers.
- [ ] **Step 3: Replace dual navigation buttons in Agenda with `SmartNavigationButton`**
  - Replace separate Apple/Google buttons in `renderAppointmentCard` with single `SmartNavigationButton`.
- [ ] **Step 4: Verify typecheck**
  - Run `pnpm exec tsc --noEmit`.

---

### Task 4: Appointment Modal Layout Overhaul (8-Step Sequence & 3-Col Services)
**Files:**
- Modify: `src/components/ui/appointment-modal.tsx`

- [ ] **Step 1: Increase modal width by ~20%**
  - Change `panelClassName` from `max-w-xl` to `w-full max-w-3xl sm:max-w-4xl`.
- [ ] **Step 2: Remove redundant `+ Cadastrar Novo Cliente` button**
  - Remove button from top right of client selection; preserve "+ Cadastrar Novo Cliente" inside search dropdown options.
- [ ] **Step 3: Reorder fields into strict 8-step sequence**
  1. Cliente Atendido
  2. Endereço do Atendimento (GPS)
  3. Título do Atendimento na Agenda
  4. Serviços / Itens Contratados:
     - Checkbox toggle: `[ ] Exibir serviços extras` (state `showExtras`, filtering services).
     - 3-column grid layout: `grid grid-cols-1 sm:grid-cols-3 gap-2`.
     - Tooltip `title={s.name}` on service buttons so truncated names are visible on hover.
  5. Observações Internas (Portão, Pet, etc.)
  6. Horizontal 4-column row: `grid grid-cols-1 sm:grid-cols-4 gap-3` (Data, Início, Término, Valor USD *).
  7. Profissionais Escalados | Categoria de Comissão (`grid grid-cols-1 sm:grid-cols-12 gap-3`).
  8. Flags: Não Faturável | Atendimento Concluído (`status === "COMPLETED"`).
  - Recurrence section & Save/Cancel/Delete buttons.
- [ ] **Step 4: Verify build and behavior**
  - Run `pnpm exec tsc --noEmit`.

---

### Task 5: Public Scheduling Double-Booking Prevention
**Files:**
- Modify: `src/app/api/v1/public/estimates/[token]/book/route.ts`
- Test: `tests/unit/public-booking-conflict.test.ts`

- [ ] **Step 1: Write test for booking conflict detection**
  - Test overlapping interval logic `[startDateTime, endDateTime]`.
- [ ] **Step 2: Implement conflict guard in `public/estimates/[token]/book/route.ts`**
  - Check for existing active appointments (`status !== "CANCELLED"`) within the same company and time slot.
  - Return HTTP 409 with user-friendly message if slot is taken.
- [ ] **Step 3: Run tests and verify they pass**
  - Run `pnpm test`.

---

### Task 6: Full System Verification & Changelog Update
**Files:**
- Modify: `CHANGELOG.md` or history file

- [ ] **Step 1: Run complete test suite**
  - Run `pnpm test`.
- [ ] **Step 2: Run production Next.js build**
  - Run `pnpm build`.
- [ ] **Step 3: Update history file with all enhancements**
  - Record date, improvements, files created/modified.
