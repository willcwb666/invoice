# Push Notifications System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a comprehensive Web Push notification system in the PWA that delivers a 6:00 AM daily schedule brief, instant alerts on schedule changes, and an intelligent ~30-minute departure alert based on geolocation and travel time.

**Architecture:** Web Push (VAPID) integrated into the existing PWA Service Worker (`public/sw.js`). Prisma stores device subscriptions (`PushSubscription`) and scheduled dispatches (`ScheduledPush`). A central `PushService` coordinates deliveries and purges expired subscriptions. A location endpoint (`POST /api/v1/push/location`) pairs GPS coordinates with `travel-time.ts` to schedule departure alerts for `(startTime - travelMinutes - 30min)`. A cron dispatcher (`/api/v1/cron/push-dispatcher`) processes pending scheduled pushes and the 6:00 AM briefing.

**Tech Stack:** Next.js 16 (App Router), Prisma 7 + PostgreSQL, `web-push`, Service Worker Push & Notification API, HTML5 Geolocation API, Tailwind CSS.

**Spec:** `C:\Users\Renat\.gemini\antigravity\brain\0b555b13-eca1-4a24-a193-7c352cb1784e\push_architecture_design.md`

## Global Constraints

- Multi-tenant isolation: All push operations and data models must strictly enforce `companyId` scoping.
- Mobile PWA compatibility: Web Push must function seamlessly on iOS (iOS 16.4+ standalone PWA) and Android (Chrome).
- Battery/OS constraints: Do not rely on persistent background GPS polling; capture coordinates on discrete user interactions (e.g. concluding an appointment or opening the agenda).
- Clean up dead subscriptions: Automatic deletion of endpoints returning HTTP 410 (Gone) or 404 (Not Found).
- Verify with `pnpm build` (typecheck + lint) and dedicated verification scripts (`npx tsx scripts/...`), following the repo's established pattern.
- Git commit after each task following `feat(push): ...` or `fix(push): ...`.

## Review Focus

1. **Missing GPS permissions or unavailable location:** Fall back gracefully to the address of the last completed appointment without failing the request.
2. **Short intervals (< 30 min) to the next client:** If current time + travel time is already within the 30-minute window, dispatch the push immediately rather than scheduling it in the past.
3. **Rescheduled appointments with pending departure pushes:** If an appointment is modified or cancelled, cancel or reschedule any pending `ScheduledPush` for that appointment.
4. **Timezone consistency:** 6:00 AM briefing must be calculated in the company's local timezone (`America/Denver` / Mountain Time), not UTC.
5. **Multi-device subscriptions:** A single user/professional may have multiple active devices (phone and tablet); pushes must broadcast to all valid active subscriptions for that user.

---

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | Models `PushSubscription`, `ScheduledPush`, enum `PushNotificationType`, relations. |
| `src/services/push-service.ts` *(new)* | Central Web Push engine (VAPID configuration, dispatch, 410 cleanup, tenant broadcasts). |
| `src/services/departure-reminder-service.ts` *(new)* | Proximity calculation (`travel-time.ts` + appointment time) and departure alert scheduling. |
| `src/services/morning-brief-service.ts` *(new)* | Daily 6:00 AM agenda summary generator. |
| `public/sw.js` | Service Worker listeners for `push` and `notificationclick` events. |
| `src/lib/hooks/use-push-notifications.ts` *(new)* | React hook for subscribing/unsubscribing to push via Service Worker. |
| `src/app/api/v1/push/subscribe/route.ts` *(new)* | API to store and remove device Web Push subscriptions. |
| `src/app/api/v1/push/location/route.ts` *(new)* | API receiving field location updates to schedule departure alerts. |
| `src/app/api/v1/cron/push-dispatcher/route.ts` *(new)* | Cron endpoint to trigger 6:00 AM briefs and dispatch pending scheduled pushes. |
| `src/components/ui/push-permission-card.tsx` *(new)* | UI component to toggle and test push notifications. |
| `src/components/agenda/agenda-view.tsx` | Wire service completion to geolocation and departure reminder dispatch. |

---

### Task 1: Prisma Schema & Database Migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces:
  - `PushNotificationType`: `"MORNING_BRIEF" | "AGENDA_CHANGE" | "DEPARTURE_REMINDER" | "GENERAL"`
  - `PushSubscription` model
  - `ScheduledPush` model
  - Relations on `CompanyProfile`, `User`, `Professional`

- [ ] **Step 1: Edit `prisma/schema.prisma` to add models and relations**
  Add `PushNotificationType` enum, `PushSubscription`, and `ScheduledPush` models with appropriate indexes (`companyId`, `scheduledFor, sent`).

- [ ] **Step 2: Generate Prisma Client & apply schema changes**
  Run: `pnpm prisma db push` and `pnpm prisma generate`
  Expected: Database schema synced, Prisma Client generated with new types.

- [ ] **Step 3: Verification script**
  Create a temporary script `scripts/verify-schema.ts` to verify `prisma.pushSubscription` and `prisma.scheduledPush` can be queried. Run with `npx tsx scripts/verify-schema.ts`. Delete temporary script.

- [ ] **Step 4: Commit**
  ```bash
  git add prisma/schema.prisma
  git commit -m "feat(push): add PushSubscription and ScheduledPush models to prisma schema"
  ```

---

### Task 2: Core Push Notification Engine (`src/services/push-service.ts`)

**Files:**
- Modify: `package.json` (add `web-push` and `@types/web-push`)
- Create: `src/services/push-service.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces:
  - `PushService.saveSubscription(input: SaveSubscriptionInput): Promise<PushSubscription>`
  - `PushService.removeSubscription(endpoint: string, companyId: string): Promise<void>`
  - `PushService.sendPush(subscription: PushSubscription, payload: PushPayload): Promise<boolean>`
  - `PushService.sendToProfessional(companyId: string, professionalId: string, payload: PushPayload): Promise<number>`
  - `PushService.sendToCompany(companyId: string, payload: PushPayload): Promise<number>`

- [ ] **Step 1: Install `web-push`**
  Run: `pnpm add web-push` and `pnpm add -D @types/web-push`
  Expected: Dependencies added to `package.json`.

- [ ] **Step 2: Document VAPID keys in `.env.example`**
  Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` to `.env.example`.

- [ ] **Step 3: Implement `src/services/push-service.ts`**
  Implement `web-push.setVapidDetails()`, subscription upserting, message sending with JSON serialization, and automatic removal of subscriptions on `statusCode === 410 || statusCode === 404`.

- [ ] **Step 4: Verify with `pnpm build` or verification script**
  Verify types and error handling.
  Expected: Build and typecheck pass.

- [ ] **Step 5: Commit**
  ```bash
  git add package.json pnpm-lock.yaml .env.example src/services/push-service.ts
  git commit -m "feat(push): implement PushService core engine with VAPID support"
  ```

---

### Task 3: Service Worker Updates & Client Subscription API

**Files:**
- Modify: `public/sw.js`
- Create: `src/app/api/v1/push/subscribe/route.ts`
- Create: `src/lib/hooks/use-push-notifications.ts`

**Interfaces:**
- Consumes: `PushService.saveSubscription`, `PushService.removeSubscription`
- Produces:
  - `POST /api/v1/push/subscribe`: Subscribes current device
  - `DELETE /api/v1/push/subscribe`: Unsubscribes current device
  - `usePushNotifications()` hook: returns `{ isSupported, isSubscribed, permission, subscribe, unsubscribe, loading }`

- [ ] **Step 1: Update `public/sw.js`**
  Add listeners for:
  - `push`: Parses `event.data.json()`, falls back to text, calls `self.registration.showNotification(title, options)`.
  - `notificationclick`: Closes notification and opens `notification.data.url || '/agenda'`.

- [ ] **Step 2: Create `src/app/api/v1/push/subscribe/route.ts`**
  Implement `POST` (validates session, reads `{ endpoint, keys: { p256dh, auth }, professionalId? }`, calls `PushService.saveSubscription`) and `DELETE` (removes subscription).

- [ ] **Step 3: Create `src/lib/hooks/use-push-notifications.ts`**
  Handles `Notification.requestPermission()`, `registration.pushManager.subscribe()` using `urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)`, and synchronization with backend API.

- [ ] **Step 4: Verify with `pnpm build`**
  Expected: Typecheck and lint pass without warnings.

- [ ] **Step 5: Commit**
  ```bash
  git add public/sw.js src/app/api/v1/push/subscribe/route.ts src/lib/hooks/use-push-notifications.ts
  git commit -m "feat(push): add service worker push handlers, subscribe route, and client hook"
  ```

---

### Task 4: Real-Time Agenda Change Push Notifications

**Files:**
- Modify: `src/services/push-service.ts`
- Modify: `src/services/appointment-service.ts` (or appointment API handlers)

**Interfaces:**
- Consumes: `PushService.sendToProfessional`, `PushService.sendToCompany`
- Produces:
  - `PushService.notifyAgendaChange(companyId: string, appointmentId: string, action: 'CREATED' | 'UPDATED' | 'CANCELLED'): Promise<void>`

- [ ] **Step 1: Implement `notifyAgendaChange` in `src/services/push-service.ts`**
  Loads appointment details (client name, date, time, location, assigned professionals).
  Formats notification title:
  - `CREATED`: "Novo agendamento na agenda"
  - `UPDATED`: "Horário alterado: [Cliente]"
  - `CANCELLED`: "Agendamento cancelado: [Cliente]"
  Dispatches to assigned professionals and company admins.

- [ ] **Step 2: Wire `notifyAgendaChange` in `appointment-service.ts` / appointment API routes**
  Add calls after appointment creation, modification, or cancellation. Ensure calls run with `.catch()` so push failures never abort database transactions.

- [ ] **Step 3: Cancel pending `ScheduledPush` when appointment changes**
  When an appointment is updated or cancelled, delete any pending `ScheduledPush` for that `appointmentId`.

- [ ] **Step 4: Verify with `pnpm build`**
  Expected: Typecheck passes.

- [ ] **Step 5: Commit**
  ```bash
  git add src/services/push-service.ts src/services/appointment-service.ts
  git commit -m "feat(push): trigger instant push notifications on appointment changes"
  ```

---

### Task 5: Smart Departure Reminder Service (~30 min before next client)

**Files:**
- Create: `src/services/departure-reminder-service.ts`
- Create: `src/app/api/v1/push/location/route.ts`

**Interfaces:**
- Consumes: `src/lib/routing/travel-time.ts`, `PushService`
- Produces:
  - `DepartureReminderService.processLocationUpdate(params: LocationUpdateInput): Promise<DepartureResult>`
  - `POST /api/v1/push/location`

- [ ] **Step 1: Implement `src/services/departure-reminder-service.ts`**
  - Given `companyId`, `professionalId`, `latitude`, `longitude`, `lastAppointmentId`:
  - Find the next upcoming appointment for today for that professional.
  - Determine origin city (reverse geocode or estimate from coordinates/last location) and destination city from appointment location.
  - Call `getTravelTimeMinutes(origin, destination)`.
  - Calculate `departureTarget = appointment.startTime - (driveMinutes + 30 minutes)`.
  - If `departureTarget <= now()`, dispatch push immediately: "Hora de se preparar! Faltam X min de trajeto até [Cliente] em [Cidade]".
  - Else, upsert into `ScheduledPush` with `type: "DEPARTURE_REMINDER"`, `scheduledFor: departureTarget`.

- [ ] **Step 2: Create `src/app/api/v1/push/location/route.ts`**
  Validate session, accept `{ latitude, longitude, lastAppointmentId? }`, execute `DepartureReminderService.processLocationUpdate()`, return JSON status.

- [ ] **Step 3: Verification script**
  Test departure window calculations across various appointment scenarios:
  1. Appointment in 20 min -> Immediate push.
  2. Appointment in 90 min with 20 min travel time -> Scheduled push for 40 min from now.
  3. No subsequent appointment today -> Graceful response without error.

- [ ] **Step 4: Commit**
  ```bash
  git add src/services/departure-reminder-service.ts src/app/api/v1/push/location/route.ts
  git commit -m "feat(push): implement departure reminder service based on location and travel time"
  ```

---

### Task 6: Morning 6:00 AM Briefing & Cron Dispatcher

**Files:**
- Create: `src/services/morning-brief-service.ts`
- Create: `src/app/api/v1/cron/push-dispatcher/route.ts`

**Interfaces:**
- Consumes: `PushService`
- Produces:
  - `MorningBriefService.dispatchDailyBriefing(date?: Date): Promise<{ sentCount: number }>`
  - `GET|POST /api/v1/cron/push-dispatcher`

- [ ] **Step 1: Implement `src/services/morning-brief-service.ts`**
  - Queries all companies and professionals with appointments today.
  - Groups appointments by professional/company.
  - Builds morning summary:
    - If 0 appointments: (Skip or concise "Nenhum atendimento agendado para hoje").
    - If >= 1 appointment: "Bom dia! Você tem N atendimentos hoje. O primeiro é às HH:MM com [Cliente] em [Cidade]."
  - Dispatches via `PushService.sendToProfessional`.

- [ ] **Step 2: Implement `src/app/api/v1/cron/push-dispatcher/route.ts`**
  - Authenticates via `CRON_SECRET` header or admin session.
  - Action 1: Dispatches all pending `ScheduledPush` where `scheduledFor <= now() && !sent`. Marks them `sent: true`.
  - Action 2: If current time in `America/Denver` is between 06:00 and 06:15 and morning brief hasn't been sent today, triggers `MorningBriefService.dispatchDailyBriefing()`.

- [ ] **Step 3: Verify with `pnpm build`**
  Expected: Typecheck and lint pass.

- [ ] **Step 4: Commit**
  ```bash
  git add src/services/morning-brief-service.ts src/app/api/v1/cron/push-dispatcher/route.ts
  git commit -m "feat(push): add 6am morning brief service and cron push dispatcher"
  ```

---

### Task 7: UI Integration in PWA & Final Verification

**Files:**
- Create: `src/components/ui/push-permission-card.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx` or `src/components/agenda/agenda-view.tsx`
- Modify: Appointment completion flow to send GPS coordinates

- [ ] **Step 1: Create `src/components/ui/push-permission-card.tsx`**
  Displays current push status (Ativo / Inativo / Bloqueado), button to ativar notificações, and button "Enviar teste".

- [ ] **Step 2: Hook geolocation into service completion in Agenda**
  When professional marks appointment status as `COMPLETED`:
  Call `navigator.geolocation.getCurrentPosition()`, send `POST /api/v1/push/location` with `{ latitude, longitude, lastAppointmentId }`, showing a non-blocking toast.

- [ ] **Step 3: Run full verification build**
  Run: `pnpm build`
  Expected: Clean compilation, all routes built, no type or lint errors.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/ui/push-permission-card.tsx src/app/(dashboard)/settings/page.tsx src/components/agenda/agenda-view.tsx
  git commit -m "feat(push): integrate push settings card and geolocation check-out trigger in PWA"
  ```
