/**
 * Route-Aware Dynamic Slot Finder Engine
 * Varre os agendamentos da empresa e identifica as janelas livres
 * que acomodam a duração do serviço E o tempo real de deslocamento entre clientes.
 */

import { getTravelTimeMinutes } from "@/lib/routing/travel-time";

export interface ExistingAppointmentSlot {
  id: string;
  title?: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  location?: string | null;
  status: string;
}

export interface DayAvailability {
  date: string; // YYYY-MM-DD
  dayOfWeekLabel: string;
  isAvailable: boolean;
  slots: Array<{
    time: string; // "10:30 AM"
    startMinutes: number;
    endMinutes: number;
    fitNote?: string;
  }>;
  reason?: string;
}

export interface SlotFinderOptions {
  clientAddress: string;
  serviceDurationMinutes: number;
  baseAddress: string;
  workDayStartHour?: string; // "08:00"
  workDayEndHour?: string;   // "18:00"
  workDays?: string;         // "MON,TUE,WED,THU,FRI"
  travelBufferMinutes?: number;
  daysAhead?: number;        // default 14
}

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = (timeStr || "08:00").split(":").map(Number);
  return (h || 8) * 60 + (m || 0);
}

function formatMinutesToTime12h(minutes: number): string {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${mins.toString().padStart(2, "0")} ${period}`;
}

const WEEKDAY_KEYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export async function findAvailableSlots(
  options: SlotFinderOptions,
  appointments: ExistingAppointmentSlot[]
): Promise<DayAvailability[]> {
  const {
    clientAddress,
    serviceDurationMinutes,
    baseAddress,
    workDayStartHour = "08:00",
    workDayEndHour = "18:00",
    workDays = "MON,TUE,WED,THU,FRI",
    travelBufferMinutes = 10,
    daysAhead = 14,
  } = options;

  const allowedDays = workDays.split(",").map((d) => d.trim().toUpperCase());
  const dayStartMinutes = parseTimeToMinutes(workDayStartHour);
  const dayEndMinutes = parseTimeToMinutes(workDayEndHour);

  const results: DayAvailability[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 1; offset <= daysAhead; offset++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + offset);

    const dayOfWeekIndex = targetDate.getDay();
    const dayKey = WEEKDAY_KEYS[dayOfWeekIndex];
    const dayLabel = WEEKDAY_LABELS[dayOfWeekIndex];
    const dateStr = targetDate.toISOString().slice(0, 10);

    // Verifica se a empresa trabalha nesse dia da semana
    if (!allowedDays.includes(dayKey)) {
      results.push({
        date: dateStr,
        dayOfWeekLabel: dayLabel,
        isAvailable: false,
        slots: [],
        reason: "Fechado neste dia da semana",
      });
      continue;
    }

    // Filtra agendamentos deste dia específico
    const dayAppointments = appointments
      .filter((app) => {
        if (app.status === "CANCELLED") return false;
        const d = new Date(app.date || app.startTime);
        return d.toISOString().slice(0, 10) === dateStr;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const availableSlots: DayAvailability["slots"] = [];

    // CENÁRIO A: Dia 100% livre (sem nenhum atendimento prévio)
    if (dayAppointments.length === 0) {
      const driveBaseToClient = await getTravelTimeMinutes(baseAddress, clientAddress, travelBufferMinutes);
      const earliestStart = dayStartMinutes + driveBaseToClient;

      // Sugere horários confortáveis no dia livre
      const candidateHours = [
        Math.max(earliestStart, 8 * 60 + 30), // 8:30 AM
        Math.max(earliestStart, 10 * 60 + 30), // 10:30 AM
        Math.max(earliestStart, 13 * 60 + 0),  // 1:00 PM
      ];

      for (const slotStart of candidateHours) {
        if (slotStart + serviceDurationMinutes <= dayEndMinutes) {
          availableSlots.push({
            time: formatMinutesToTime12h(slotStart),
            startMinutes: slotStart,
            endMinutes: slotStart + serviceDurationMinutes,
            fitNote: "Dia totalmente livre",
          });
        }
      }
    } else {
      // CENÁRIO B: Dia com atendimentos existentes -> Calcular os vãos livres com deslocamento real

      // 1. Vão antes do primeiro atendimento
      const firstAppt = dayAppointments[0];
      const firstApptStart = firstAppt.startTime.getHours() * 60 + firstAppt.startTime.getMinutes();
      const firstApptLocation = firstAppt.location || baseAddress;

      const driveHomeToNew = await getTravelTimeMinutes(baseAddress, clientAddress, travelBufferMinutes);
      const driveNewToFirst = await getTravelTimeMinutes(clientAddress, firstApptLocation, travelBufferMinutes);

      const earliestStart0 = dayStartMinutes + driveHomeToNew;
      const latestEnd0 = firstApptStart - driveNewToFirst;

      if (latestEnd0 - earliestStart0 >= serviceDurationMinutes) {
        availableSlots.push({
          time: formatMinutesToTime12h(earliestStart0),
          startMinutes: earliestStart0,
          endMinutes: earliestStart0 + serviceDurationMinutes,
          fitNote: `Antes de ${firstAppt.title || "atendimento"}`,
        });
      }

      // 2. Vãos intermediários entre atendimentos
      for (let i = 0; i < dayAppointments.length - 1; i++) {
        const prevAppt = dayAppointments[i];
        const nextAppt = dayAppointments[i + 1];

        const prevEnd = prevAppt.endTime.getHours() * 60 + prevAppt.endTime.getMinutes();
        const nextStart = nextAppt.startTime.getHours() * 60 + nextAppt.startTime.getMinutes();

        const prevLocation = prevAppt.location || baseAddress;
        const nextLocation = nextAppt.location || baseAddress;

        // Deslocamento: Atendimento Anterior -> Novo Cliente
        const drivePrevToNew = await getTravelTimeMinutes(prevLocation, clientAddress, travelBufferMinutes);
        // Deslocamento: Novo Cliente -> Próximo Atendimento
        const driveNewToNext = await getTravelTimeMinutes(clientAddress, nextLocation, travelBufferMinutes);

        const possibleStart = prevEnd + drivePrevToNew;
        const requiredDeadline = nextStart - driveNewToNext;

        if (requiredDeadline - possibleStart >= serviceDurationMinutes) {
          availableSlots.push({
            time: formatMinutesToTime12h(possibleStart),
            startMinutes: possibleStart,
            endMinutes: possibleStart + serviceDurationMinutes,
            fitNote: `Janela entre ${prevAppt.title || "atendimento"} e ${nextAppt.title || "atendimento"}`,
          });
        }
      }

      // 3. Vão após o último atendimento
      const lastAppt = dayAppointments[dayAppointments.length - 1];
      const lastApptEnd = lastAppt.endTime.getHours() * 60 + lastAppt.endTime.getMinutes();
      const lastApptLocation = lastAppt.location || baseAddress;

      const driveLastToNew = await getTravelTimeMinutes(lastApptLocation, clientAddress, travelBufferMinutes);
      const possibleStartAfter = lastApptEnd + driveLastToNew;

      if (possibleStartAfter + serviceDurationMinutes <= dayEndMinutes) {
        availableSlots.push({
          time: formatMinutesToTime12h(possibleStartAfter),
          startMinutes: possibleStartAfter,
          endMinutes: possibleStartAfter + serviceDurationMinutes,
          fitNote: `Após ${lastAppt.title || "atendimento"}`,
        });
      }
    }

    const isAvailable = availableSlots.length > 0;
    results.push({
      date: dateStr,
      dayOfWeekLabel: dayLabel,
      isAvailable,
      slots: availableSlots,
      reason: isAvailable
        ? undefined
        : "Sem janelas disponíveis considerando duração e rota de deslocamento",
    });
  }

  return results;
}
