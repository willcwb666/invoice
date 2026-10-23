# Design Spec: Cleaning Field Operations, Resilient Infrastructure & Cleaner Portal

**Date:** 2026-10-22  
**Status:** In Review  
**Authors:** Antigravity & User  
**Methodology:** Superpowers Brainstorming (Layered Architecture - Approach 1)

---

## 1. Executive Summary & Goals

This specification outlines the complete transformation of the **Invoice & Clean Management System** into a world-class field service operations platform tailored for residential cleaning companies (matching and exceeding industry benchmarks like ZenMaid, Jobber, and Housecall Pro).

### Core Goals:
1. **Infrastructure Reliability (Zero Gambiarras):**
   - Solidify GPS Departure Reminders (`DepartureReminderService`) and Abandoned Estimate Recovery with a resilient hybrid execution architecture (Scheduled Cron + Debounced Client Heartbeat + External Webhook support).
   - Prevent double-booking / scheduling conflicts in both the public booking flow and the internal admin `AppointmentModal`, evaluated per assigned professional.
2. **Access Intelligence:**
   - Add structured, dedicated property access fields (`entryCode`, `alarmCode`, `pets`, `parkingInstructions`) on `Client` and `Appointment` instead of buried unstructured notes.
3. **Cleaner Portal (`Role: CLEANER`):**
   - Dedicated mobile-first view (`/cleaner`) where cleaners see only their assigned daily houses, 1-click GPS navigation, entry codes, and service scope, with strict RBAC shielding all company financial metrics, pricing, invoices, and other staff members' data.
4. **Field Quality & Verification:**
   - Room-by-room digital checklists (Kitchen, Bathrooms, Living, Bedrooms) and Before/After photo uploads for quality control and dispute prevention.
5. **Client Communications & Post-Job Review Booster:**
   - 1-click "On my way!" (ETA) client alert.
   - Automated post-job follow-up (+60 min after `COMPLETED`) requesting a 5-star Google Review.

---

## 2. Architecture & Subsystem Design

```
+-----------------------------------------------------------------------------------+
|                                  USER / ROLE                                      |
|   [ADMIN / OPERATOR]                                      [CLEANER / FIELD STAFF] |
|   - Full Dashboard & Financials                           - Restricted /cleaner   |
|   - Invoices, Reports, Settings                           - My Jobs Today Only    |
|   - Calendar & Conflict Warnings                          - GPS, Access, Checklists|
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                               NEXT.JS APPLICATION                                 |
|                                                                                   |
|  +--------------------+  +----------------------+  +---------------------------+  |
|  | Conflict Engine    |  | Dispatcher & Cron    |  | Role-Based Access Control |  |
|  | - Per-professional |  | - ScheduledPush      |  | - Role: CLEANER           |  |
|  | - Interval overlap |  | - Abandoned Recovery |  | - Zero financial access  |  |
|  | - Real-time warning|  | - Multi-tier trigger |  | - Scoped to assignments  |  |
|  +--------------------+  +----------------------+  +---------------------------+  |
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                             DATABASE SCHEMA (PRISMA)                              |
|  - Client / Appointment: entryCode, alarmCode, pets, parkingInstructions          |
|  - User: role CLEANER, professionalId relation                                    |
|  - AppointmentChecklist: room, task, completed, completedAt                       |
|  - AppointmentPhoto: photoType (BEFORE/AFTER), room, imageUrl                     |
|  - CompanyProfile: googleReviewUrl                                                |
+-----------------------------------------------------------------------------------+
```

---

## 3. Phase-by-Phase Technical Specifications

### Phase 1: Core Engines, Cron Architecture & Access Intelligence

#### 1.1 Resilient Dispatcher Architecture (`/api/v1/cron/dispatcher`)
- **Problem:** Vercel Hobby plan only executes crons 1x/day (`0 12 * * *`). Departure reminders (30m & 10m before each job) and abandoned estimate recoveries must be dispatched throughout the business day.
- **Solution (Zero Gambiarras):**
  1. **Unified Endpoint:** `POST /api/v1/cron/dispatcher` (and `GET` for simple health/cron pings).
     - Claims an atomic Redis/Prisma execution lock (`lastCronDispatchAt`) with a 60-second debounce.
     - Calls `DepartureReminderService.dispatchPendingReminders()` (sends all due `ScheduledPush` records).
     - Calls `DepartureReminderService.syncDailyReminders()` (ensures all daily appointments have scheduled pushes).
     - Calls `processAbandonedEstimates(companyId)` (dispatches recovery emails for stale draft estimates).
     - Dispatches due Google Review follow-ups for completed appointments.
  2. **Multi-Tier Execution:**
     - **Tier 1 (Vercel Cron):** Daily trigger at 6:00 AM MT (`0 12 * * *`) via `vercel.json`.
     - **Tier 2 (Browser Heartbeat):** Lightweight React hook `useDispatcherHeartbeat()` embedded in the Dashboard & Cleaner layout:
       - Runs automatically when an authenticated user has the application open.
       - Throttled to max once every 3 to 5 minutes using server-side debounce.
     - **Tier 3 (External Webhook Support):** Accepts `Authorization: Bearer <CRON_SECRET>` or `x-cron-key` allowing external pingers (Upstash, cron-job.org, Cloudflare Workers) to trigger it 24/7 if needed.

#### 1.2 Multi-Cleaner Scheduling Conflict Engine (`src/lib/scheduling/conflict.ts`)
- **Problem:** The internal admin appointment modal does not check for double-booking, and the public booking route only checked company-wide rather than per assigned cleaner.
- **Solution:**
  - Create `AppointmentService.checkSchedulingConflict({ companyId, startTime, endTime, professionalIds, excludeAppointmentId })`:
    - If `professionalIds` are provided: checks if ANY of those specific professionals already have an active (`status != "CANCELLED"`) overlapping appointment.
    - If no `professionalIds` (unassigned): checks against default company capacity.
  - API endpoint: `POST /api/v1/appointments/check-conflict` (returns `{ hasConflict: boolean, conflictingAppointment: { id, title, clientName, professionalName, startTime, endTime } }`).
  - Internal UI (`AppointmentModal`):
    - Debounced check whenever `date`, `startTime`, `endTime`, or `professionals` change.
    - Visual warning: Amber alert banner stating: *"Conflito de Horário: [Profissional] já possui atendimento agendado com [Cliente] das [Início] às [Fim]."*
    - Provides explicit checkbox *"Estou ciente da sobreposição e desejo agendar mesmo assim"* for intentional double-booking (e.g. 2 helpers on same house).
  - Public Booking API (`POST /api/v1/public/estimates/[token]/book`):
    - Blocks conflicts with HTTP 409 and user-friendly explanation.

#### 1.3 Structured Property Access Fields
- **Database Schema Updates (`prisma/schema.prisma`):**
  - In `Client`:
    - `entryCode`: String? (e.g. "Portão #4590 / Chave no lockbox 1234")
    - `alarmCode`: String? (e.g. "Armar/Desarmar: 9912 (espera 30s)")
    - `pets`: String? (e.g. "2 cães dóceis, deixar no quintal")
    - `parkingInstructions`: String? (e.g. "Estacionar na garagem ou lado esquerdo da rua")
  - In `Appointment`:
    - Inherits client's access data by default, with optional appointment-specific overrides:
      - `entryCode`: String?
      - `alarmCode`: String?
      - `pets`: String?
      - `parkingInstructions`: String?
- **UI Enhancements:**
  - `ClientModal`: Dedicated "Acesso & Segurança do Imóvel" section with clear inputs and icons (Key, ShieldAlert, Dog, Car).
  - `AppointmentModal`: Prominent collapsible badge with access details pre-populated from the selected client.

---

### Phase 2: Cleaner Portal (`Role: CLEANER`) & Strict RBAC Isolation

#### 2.1 Role & Security Model (`src/lib/security/rbac.ts`)
- Add `CLEANER` to `Role` enum in `prisma/schema.prisma`.
- Add `professionalId` to `User` model (`User.professionalId -> Professional.id`).
- Define permissions for `CLEANER`:
  - Allowed Screens: `cleaner` (or `my-schedule`), `profile`.
  - Blocked Screens: `dashboard`, `invoices`, `estimates`, `payments`, `expenses`, `financeiro`, `commissions`, `professionals`, `settings`, `users`, `reports`.
  - Scoped Query Enforcement:
    - In `AppointmentService`, if user has `role === "CLEANER"`, enforce `where: { professionals: { some: { professionalId: user.professionalId } } }`.
    - Strip all financial fields (`price`, `billingType`, `invoiced`, `invoiceId`) from the API payload before sending to a cleaner client.
- Redirection: When a user with `role === "CLEANER"` logs in, automatically redirect from `/` to `/cleaner`.

#### 2.2 Cleaner View Interface (`src/app/(dashboard)/cleaner/page.tsx`)
- **Mobile-First Layout:**
  - Date selector: Today (Default), Tomorrow, or date picker.
  - Daily summary card: Number of homes to clean today, completion progress bar.
  - Job Card Components:
    - **Header:** House order (#1, #2, #3), Client name, Scheduled Time window (e.g. 8:30 AM - 11:30 AM).
    - **Smart Navigation:** Large 1-click "Navegar (GPS)" button with device detection (Apple Maps / Google Maps).
    - **Access Intelligence Card:** Prominent badges:
      - 🔑 Portão / Lockbox: `entryCode` (with 1-click copy button).
      - 🛡️ Alarme: `alarmCode`.
      - 🐾 Pets: `pets`.
      - 🚗 Estacionamento: `parkingInstructions`.
    - **Service & Scope:** Badges for Standard Cleaning, Deep Cleaning, Extra services (Oven, Fridge, Windows), and special notes.
    - **Action Buttons:**
      - "Iniciar Limpeza" (`status: IN_PROGRESS`).
      - "Finalizar Limpeza" (`status: COMPLETED`).
      - "Abrir Checklist & Fotos".

---

### Phase 3: Field Operations (Checklists, Photos, ETA & Google Reviews)

#### 3.1 Room-by-Room Checklists & Photo Verification
- **Prisma Schema:**
  ```prisma
  model AppointmentChecklist {
    id            String      @id @default(uuid())
    appointmentId String
    appointment   Appointment @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
    room          String      // "KITCHEN", "BATHROOMS", "BEDROOMS", "LIVING_ROOM", "GENERAL"
    task          String      // e.g. "Limpar fogão e bancadas"
    completed     Boolean     @default(false)
    completedAt   DateTime?
    completedBy   String?     // Professional name

    @@index([appointmentId])
    @@map("appointment_checklists")
  }

  model AppointmentPhoto {
    id            String      @id @default(uuid())
    appointmentId String
    appointment   Appointment @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
    photoType     String      // "BEFORE" | "AFTER"
    room          String?     // "KITCHEN", "BATHROOMS", etc.
    imageUrl      String      // Cloud storage URL or base64 data uri
    caption       String?
    uploadedAt    DateTime    @default(now())

    @@index([appointmentId])
    @@map("appointment_photos")
  }
  ```
- **Default Task Templates:**
  - Automatically seeds recommended checklists based on cleaning category (`STANDARD`, `DEEP`, `MOVE_IN_OUT`).
  - Mobile UI allows tapping checks and snapping photos with phone camera.

#### 3.2 Automated Client "En Route" (ETA) & Google Review Booster
1. **"A Caminho" (On-My-Way) Button:**
   - Present on Cleaner and Admin cards.
   - Calculates real-time travel time to destination.
   - 1-click triggers SMS/WhatsApp preview or dispatch:
     *"Hi [Client Name]! Your cleaning team from Renata Matos is on the way. Estimated arrival: [ETA, e.g. 8:45 AM]. See you soon!"*
2. **Google Review Booster:**
   - Add `googleReviewUrl` to `CompanyProfile` (e.g. `https://g.page/r/your-google-review-link/review`).
   - When an appointment is marked `COMPLETED`:
     - Creates a `ScheduledPush` or SMS follow-up scheduled for `now + 60 minutes`.
     - Message template:
       *"Hi [Client Name]! Thank you for choosing Renata Matos Cleaning Services today. If you enjoyed our service, could you take 30 seconds to share a 5-star review on Google? It means the world to our team: [googleReviewUrl] ✨"*

---

## 4. Verification & Testing Strategy

1. **Unit Tests:**
   - `src/__tests__/scheduling-conflict-multi.test.ts`: Verify conflict detection with single and multiple assigned professionals, overlapping intervals, and edge-to-edge timings.
   - `src/__tests__/cron-dispatcher.test.ts`: Verify atomic locking, scheduled push dispatching, and abandoned recovery execution.
   - `src/__tests__/cleaner-rbac.test.ts`: Verify that cleaners cannot access financial fields, invoices, or other staff data.
2. **Type Safety & Build:**
   - `pnpm exec tsc --noEmit` -> 0 errors.
   - `pnpm test` -> 100% passing tests.
   - `pnpm build` -> Turbopack production compilation across all routes.
