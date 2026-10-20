import { BUSINESS_TIMEZONE, zonedPartsFromUtc, zonedTimeToUtc } from "@/lib/calendar/timezone";

export type RecurrenceFrequency =
  | "NONE"
  | "WEEKLY"
  | "BIWEEKLY"
  | "EVERY_3_WEEKS"
  | "MONTHLY";

export type AppointmentUpdateScope =
  | "THIS_ONLY"
  | "THIS_AND_FOLLOWING"
  | "ALL_SERIES";

export type AppointmentDeleteScope =
  | "THIS_ONLY"
  | "THIS_AND_FOLLOWING"
  | "ALL_SERIES";

export interface RecurrenceOption {
  value: RecurrenceFrequency;
  label: string;
  description: string;
}

export const RECURRENCE_OPTIONS: RecurrenceOption[] = [
  {
    value: "NONE",
    label: "Único (Não repete)",
    description: "Atendimento avulso em data única",
  },
  {
    value: "WEEKLY",
    label: "Semanal (1x por semana)",
    description: "Repete no mesmo dia da semana toda semana",
  },
  {
    value: "BIWEEKLY",
    label: "Bi-semanal (A cada 2 semanas / Quinzenal)",
    description: "Repete a cada duas semanas no mesmo dia da semana",
  },
  {
    value: "EVERY_3_WEEKS",
    label: "A cada 3 semanas",
    description: "Repete a cada três semanas no mesmo dia da semana",
  },
  {
    value: "MONTHLY",
    label: "Mensal (1x por mês)",
    description: "Repete uma vez por mês na mesma data",
  },
];

const WEEKDAY_NAMES_PT = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

/**
 * Soma dias de calendário a uma data (mês 1-based), sem desvios de fuso horário.
 */
export function addCalendarDays(
  year: number,
  month: number,
  day: number,
  days: number
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * Retorna o número de dias em um determinado mês/ano.
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Soma meses de calendário com clamping seguro para dias que não existem no mês de destino (ex: 31 de Jan -> 28 de Fev).
 */
export function addCalendarMonths(
  year: number,
  month: number,
  day: number,
  months: number
): { year: number; month: number; day: number } {
  const totalMonths = (year * 12 + (month - 1)) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const daysInTargetMonth = getDaysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(day, daysInTargetMonth);
  return { year: targetYear, month: targetMonth, day: targetDay };
}

export interface RecurrenceOccurrence {
  date: Date;
  startTime: Date;
  endTime: Date;
  index: number;
}

/**
 * Calcula a data/hora UTC limite (final do último dia do mês horizonte) no fuso de Denver.
 * Exemplo: se hoje é Outubro e horizonMonths = 2, a janela cobre Outubro e Novembro.
 * O limite será 30 de Novembro às 23:59:59 no horário de Denver.
 */
export function getRecurrenceHorizonBoundary(params: {
  referenceDate?: Date;
  horizonMonths: number;
}): { horizonEndUtc: Date; horizonEndLocal: { year: number; month: number; day: number } } {
  const { referenceDate = new Date(), horizonMonths } = params;
  const refParts = zonedPartsFromUtc(referenceDate, BUSINESS_TIMEZONE);

  // O mês atual é o mês 0. O horizonte H cobre (H - 1) meses adicionais.
  // Ex: ref = mês 10 (Outubro), H = 2 -> totalMonths = 10 - 1 + 2 = 11 (Novembro).
  const monthsAhead = Math.max(1, horizonMonths);
  const totalMonths = (refParts.year * 12 + (refParts.month - 1)) + (monthsAhead - 1);
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const lastDay = getDaysInMonth(targetYear, targetMonth);

  const horizonEndUtc = zonedTimeToUtc(
    targetYear,
    targetMonth - 1,
    lastDay,
    23,
    59,
    59,
    BUSINESS_TIMEZONE
  );

  return {
    horizonEndUtc,
    horizonEndLocal: { year: targetYear, month: targetMonth, day: lastDay },
  };
}

/**
 * Gera as ocorrências futuras de um agendamento recorrente com precisão baseada no fuso de Denver (Mountain Time).
 * Não sofre com variações de horário de verão (DST), mantendo o relógio de parede de início e término idênticos.
 */
export function generateRecurrenceOccurrences(params: {
  startDateTime: Date;
  endDateTime: Date;
  frequency: RecurrenceFrequency;
  durationMonths?: number;
  untilUtc?: Date;
  maxOccurrences?: number;
}): RecurrenceOccurrence[] {
  const {
    startDateTime,
    endDateTime,
    frequency,
    durationMonths = 2,
    untilUtc,
    maxOccurrences = 104,
  } = params;

  if (frequency === "NONE") {
    const startParts = zonedPartsFromUtc(startDateTime, BUSINESS_TIMEZONE);
    const dateOnly = zonedTimeToUtc(startParts.year, startParts.month - 1, startParts.day, 0, 0, 0, BUSINESS_TIMEZONE);
    return [
      {
        date: dateOnly,
        startTime: startDateTime,
        endTime: endDateTime,
        index: 0,
      },
    ];
  }

  const durationMs = endDateTime.getTime() - startDateTime.getTime();
  const startParts = zonedPartsFromUtc(startDateTime, BUSINESS_TIMEZONE);
  const endParts = zonedPartsFromUtc(endDateTime, BUSINESS_TIMEZONE);

  // Calcula o limite final de data no calendário de Denver
  let horizonUtc: Date;
  if (untilUtc) {
    horizonUtc = untilUtc;
  } else {
    const horizon = addCalendarMonths(startParts.year, startParts.month, startParts.day, durationMonths);
    horizonUtc = zonedTimeToUtc(horizon.year, horizon.month - 1, horizon.day, 23, 59, 59, BUSINESS_TIMEZONE);
  }

  const occurrences: RecurrenceOccurrence[] = [];
  let currentLocal = { year: startParts.year, month: startParts.month, day: startParts.day };
  let index = 0;

  while (index < maxOccurrences) {
    const occStart = zonedTimeToUtc(
      currentLocal.year,
      currentLocal.month - 1,
      currentLocal.day,
      startParts.hour,
      startParts.minute,
      startParts.second,
      BUSINESS_TIMEZONE
    );

    const occEnd = zonedTimeToUtc(
      currentLocal.year,
      currentLocal.month - 1,
      currentLocal.day,
      endParts.hour,
      endParts.minute,
      endParts.second,
      BUSINESS_TIMEZONE
    );

    const occDateOnly = zonedTimeToUtc(
      currentLocal.year,
      currentLocal.month - 1,
      currentLocal.day,
      0,
      0,
      0,
      BUSINESS_TIMEZONE
    );

    if (occStart.getTime() > horizonUtc.getTime()) {
      break;
    }

    occurrences.push({
      date: occDateOnly,
      startTime: occStart,
      endTime: occEnd.getTime() > occStart.getTime() ? occEnd : new Date(occStart.getTime() + durationMs),
      index,
    });

    index++;

    // Próximo passo baseado na frequência
    switch (frequency) {
      case "WEEKLY":
        currentLocal = addCalendarDays(currentLocal.year, currentLocal.month, currentLocal.day, 7);
        break;
      case "BIWEEKLY":
        currentLocal = addCalendarDays(currentLocal.year, currentLocal.month, currentLocal.day, 14);
        break;
      case "EVERY_3_WEEKS":
        currentLocal = addCalendarDays(currentLocal.year, currentLocal.month, currentLocal.day, 21);
        break;
      case "MONTHLY":
        // Avança mantendo o dia original de startParts, ajustado ao mês
        currentLocal = addCalendarMonths(startParts.year, startParts.month, startParts.day, index);
        break;
      default:
        return occurrences;
    }
  }

  return occurrences;
}

/**
 * Gera as próximas ocorrências de uma série existente a partir da última ocorrência registrada,
 * até atingir a data limite do horizonte rolling window.
 */
export function generateNextOccurrencesUntil(params: {
  lastOccurrenceStartTime: Date;
  lastOccurrenceEndTime: Date;
  frequency: RecurrenceFrequency;
  untilUtc: Date;
  startIndex: number;
  maxOccurrences?: number;
}): RecurrenceOccurrence[] {
  const {
    lastOccurrenceStartTime,
    lastOccurrenceEndTime,
    frequency,
    untilUtc,
    startIndex,
    maxOccurrences = 52,
  } = params;

  if (frequency === "NONE") return [];

  const durationMs = lastOccurrenceEndTime.getTime() - lastOccurrenceStartTime.getTime();
  const startParts = zonedPartsFromUtc(lastOccurrenceStartTime, BUSINESS_TIMEZONE);
  const endParts = zonedPartsFromUtc(lastOccurrenceEndTime, BUSINESS_TIMEZONE);

  // Calcula o primeiro ponto futuro a partir da frequência
  let currentLocal: { year: number; month: number; day: number };
  switch (frequency) {
    case "WEEKLY":
      currentLocal = addCalendarDays(startParts.year, startParts.month, startParts.day, 7);
      break;
    case "BIWEEKLY":
      currentLocal = addCalendarDays(startParts.year, startParts.month, startParts.day, 14);
      break;
    case "EVERY_3_WEEKS":
      currentLocal = addCalendarDays(startParts.year, startParts.month, startParts.day, 21);
      break;
    case "MONTHLY":
      currentLocal = addCalendarMonths(startParts.year, startParts.month, startParts.day, 1);
      break;
    default:
      return [];
  }

  const occurrences: RecurrenceOccurrence[] = [];
  let currentIndex = startIndex;
  let safetyCount = 0;

  while (safetyCount < maxOccurrences) {
    const occStart = zonedTimeToUtc(
      currentLocal.year,
      currentLocal.month - 1,
      currentLocal.day,
      startParts.hour,
      startParts.minute,
      startParts.second,
      BUSINESS_TIMEZONE
    );

    const occEnd = zonedTimeToUtc(
      currentLocal.year,
      currentLocal.month - 1,
      currentLocal.day,
      endParts.hour,
      endParts.minute,
      endParts.second,
      BUSINESS_TIMEZONE
    );

    const occDateOnly = zonedTimeToUtc(
      currentLocal.year,
      currentLocal.month - 1,
      currentLocal.day,
      0,
      0,
      0,
      BUSINESS_TIMEZONE
    );

    // Se já passou do limite do horizonte, encerra
    if (occStart.getTime() > untilUtc.getTime()) {
      break;
    }

    occurrences.push({
      date: occDateOnly,
      startTime: occStart,
      endTime: occEnd.getTime() > occStart.getTime() ? occEnd : new Date(occStart.getTime() + durationMs),
      index: currentIndex,
    });

    currentIndex++;
    safetyCount++;

    switch (frequency) {
      case "WEEKLY":
        currentLocal = addCalendarDays(currentLocal.year, currentLocal.month, currentLocal.day, 7);
        break;
      case "BIWEEKLY":
        currentLocal = addCalendarDays(currentLocal.year, currentLocal.month, currentLocal.day, 14);
        break;
      case "EVERY_3_WEEKS":
        currentLocal = addCalendarDays(currentLocal.year, currentLocal.month, currentLocal.day, 21);
        break;
      case "MONTHLY":
        currentLocal = addCalendarMonths(currentLocal.year, currentLocal.month, startParts.day, 1);
        break;
      default:
        return occurrences;
    }
  }

  return occurrences;
}

/**
 * Retorna um texto amigável resumindo a frequência de recorrência.
 */
export function getRecurrenceLabel(frequency?: string | null): string {
  if (!frequency || frequency === "NONE") return "Atendimento Único";
  const found = RECURRENCE_OPTIONS.find((o) => o.value === frequency);
  return found ? found.label : frequency;
}

/**
 * Retorna um resumo contextual para exibição imediata ao usuário no formulário.
 */
export function getRecurrenceSummary(
  frequency: RecurrenceFrequency,
  dateStr: string,
  startTimeStr: string,
  durationMonths: number = 12
): string {
  if (frequency === "NONE") {
    return "Atendimento único sem repetições automáticas.";
  }

  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const weekday = WEEKDAY_NAMES_PT[dateObj.getUTCDay()] || "Dia agendado";

    switch (frequency) {
      case "WEEKLY":
        return `Toda ${weekday} às ${startTimeStr} durante os próximos ${durationMonths} meses.`;
      case "BIWEEKLY":
        return `A cada 2 semanas na ${weekday} às ${startTimeStr} durante os próximos ${durationMonths} meses.`;
      case "EVERY_3_WEEKS":
        return `A cada 3 semanas na ${weekday} às ${startTimeStr} durante os próximos ${durationMonths} meses.`;
      case "MONTHLY":
        return `Mensalmente todo dia ${d} às ${startTimeStr} durante os próximos ${durationMonths} meses.`;
      default:
        return "";
    }
  } catch {
    return "";
  }
}
