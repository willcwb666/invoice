# Design Spec: Client Editing, Agenda Tooltips, Smart GPS Navigation & Appointment Modal Redesign

**Date:** 2026-10-22  
**Status:** In Review  
**Authors:** Antigravity & User  

---

## 1. Problem Statement & User Requirements

1. **RentCast API Status Inactive:**
   - User noted API key displays as "Inactive" on RentCast dashboard. Need clear instructions on activating the $0/mo free plan with card verification.
2. **Client Editing Limitation:**
   - In `/clients` table, the action button "Ver ficha completa do cliente" should be changed to a Pencil icon with tooltip "Editar cadastro", opening the client page.
   - In `/clients/[id]`, client data is read-only. User must be able to edit all client fields (name, phone, email, address, city, state, zipCode, billingType, notes, and property dimensions) with clear "Salvar" and "Cancelar" buttons calling `PATCH /api/v1/clients/[id]`.
3. **Smart GPS Navigation:**
   - Currently, dual buttons exist for Apple Maps and Google Maps.
   - Replace with a single "Navegar até endereço" action button:
     - On iPhone/iOS: display a prompt or action dialog asking: "Navegar com Apple Maps ou Google Maps?".
     - On Android & Desktop/Web browsers: open Google Maps directly.
4. **Agenda Hover Tooltips:**
   - When hovering over an appointment in `/agenda` (Month, Week, Day/Today views), show a tooltip containing the address and start/end time.
   - When hovering over an empty slot/cell, preserve the current tooltip ("Clique em uma área em branco para criar um novo agendamento neste dia").
5. **Public Scheduling & Double-Booking Infrastructure:**
   - Assess whether public self-scheduling links allow conflicts/overlapping bookings.
   - Design overlap check preventing double-booking if an appointment already exists at the requested time slot.
6. **Appointment Modal (`AppointmentModal`) Layout Overhaul:**
   - Increase web modal width by ~20-30% (`max-w-3xl` / `max-w-4xl`) for a spacious, harmonious layout.
   - Remove redundant `+ Cadastrar Novo Cliente` button at the top right of the client section (since typing in the search box already offers adding a new client).
   - Reorder fields into the exact requested sequence:
     1. Cliente atendido (search box with dropdown)
     2. Endereço do Atendimento (GPS)
     3. Título do Atendimento na Agenda
     4. Serviços / itens contratados: 3-column grid, tooltip on service name, checkbox toggle "Serviços extras" (showing extra services only when checked)
     5. Observações Internas (Portão, Pet, etc.)
     6. Horizontal 4-column row: Data do Atendimento | Horário de Início | Horário de Término | Valor Cobrado ($ USD) *
     7. Profissionais Escalados | Categoria de Comissão
     8. Não faturável | Serviço concluído

---

## 2. Technical Architecture & Solutions

### A. RentCast Inactive Key Activation
- RentCast requires an active subscription tier even for the $0 Free Plan (50 calls/mo).
- Flow: Log in to `https://app.rentcast.io/app/api` -> Click "Change Plan" or "Subscribe" -> Choose "Free Plan ($0/month)" -> Enter payment method for verification -> Confirm. The status badge will change from "Inactive" to "Active".

### B. Smart GPS Navigation Utility (`src/lib/navigation-launcher.ts` & Component)
- Device detection:
  - iOS detection regex: `/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)`
  - Android detection: `/Android/i.test(navigator.userAgent)`
- Unified component / hook:
  - When triggered:
    - If iOS: opens a lightweight choice modal / bottom sheet: "Abrir no Apple Maps" or "Abrir no Google Maps".
    - If Android or Web Browser: immediately opens `window.open("https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(fullAddress), "_blank")`.

### C. Client Table & Detail Inline Editing (`/clients` and `/clients/[id]`)
- `/clients` table:
  - Replace `ArrowUpRight` "Ver Ficha Completa" with `Pencil` icon + tooltip `Editar cadastro`.
  - Replace dual Apple/Google Maps buttons with unified `NavigateButton`.
- `/clients/[id]`:
  - Provide an inline editing toggle or directly editable form fields.
  - "Salvar" button executes `PATCH /api/v1/clients/[id]` with validated payload.
  - "Cancelar" button reverts form state to original values.
  - Toast feedback for success/error.

### D. Agenda Appointment Tooltips (`src/app/(dashboard)/agenda/page.tsx`)
- In Month View, Week View, and Today/List View:
  - Every appointment item/card receives:
    `title={`Horário: ${formatTime(appt.startTime)} - ${formatTime(appt.endTime)}\nEndereço: ${appt.location || "Sem endereço cadastrado"}`}`
  - Empty day cells maintain:
    `title="Clique em uma área em branco para criar um novo agendamento neste dia"`

### E. Appointment Modal Layout Redesign (`src/components/ui/appointment-modal.tsx`)
- `panelClassName` upgraded to `w-full max-w-3xl sm:max-w-4xl`.
- Redundant `+ Cadastrar Novo Cliente` button removed from header of client input.
- Fields restructured strictly in 8 steps:
  1. Cliente atendido (with autocomplete dropdown that includes "+ Cadastrar [query]")
  2. Endereço do Atendimento (GPS)
  3. Título do Atendimento na Agenda
  4. Serviços / itens contratados:
     - Checkbox toggle: `[ ] Exibir serviços extras`
     - 3-column grid: `grid grid-cols-1 sm:grid-cols-3 gap-2`
     - Card tooltip: `title={s.name}`
  5. Observações Internas (Portão, Pet, etc.)
  6. Horizontal row: `grid grid-cols-1 sm:grid-cols-4 gap-3` (Data, Início, Término, Valor USD)
  7. Profissionais Escalados | Categoria de Comissão
  8. Não faturável | Serviço concluído
  - Plus recurrence section and save/cancel actions.

### F. Double-Booking Prevention Infrastructure
- In `src/app/api/v1/public/estimates/[token]/book/route.ts`:
  - Query existing active appointments for the company overlapping `[startDateTime, endDateTime]`.
  - If conflict exists, respond with status 409 and descriptive error message.
  - In `AppointmentService.createAppointment`, provide conflict validation option.
