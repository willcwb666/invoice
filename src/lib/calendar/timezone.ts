/**
 * Fuso horário onde a empresa realmente opera (Evans/Greeley, Colorado).
 * Compartilhado entre o parser/expansor de recorrência do iCloud (servidor)
 * e qualquer tela que peça/mostre data e hora de agendamento (cliente) - os
 * dois lados precisam concordar em como "09:00" digitado por alguém vira um
 * instante UTC, e vice-versa. Módulo sem dependências de servidor (só
 * Intl/Date) de propósito, para poder ser importado também por componentes
 * client-side.
 */
export const BUSINESS_TIMEZONE = "America/Denver";

/**
 * Converte um horário de parede (ano/mês 0-based/dia/hora/min/seg)
 * interpretado no fuso `timeZone` para o instante UTC correspondente - já
 * considerando horário de verão. Mesmo truque usado por bibliotecas como
 * date-fns-tz: assume os números como UTC, vê que hora isso aparenta no
 * fuso alvo, e corrige pela diferença (uma passada é suficiente, exceto no
 * exato instante de troca de DST, um caso raro e sem consequência aqui).
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string = BUSINESS_TIMEZONE
): Date {
  const utcGuess = Date.UTC(year, month, day, hour, minute, second);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcGuess));

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  const asIfUtc = Date.UTC(
    parseInt(map.year, 10),
    parseInt(map.month, 10) - 1,
    parseInt(map.day, 10),
    parseInt(map.hour, 10),
    parseInt(map.minute, 10),
    parseInt(map.second, 10)
  );

  return new Date(utcGuess + (utcGuess - asIfUtc));
}

/**
 * O inverso de zonedTimeToUtc: dado um instante UTC, devolve o relógio de
 * parede (ano/mês 1-based/dia/hora/min/seg) que esse instante representa no
 * fuso `timeZone`.
 */
export function zonedPartsFromUtc(
  date: Date,
  timeZone: string = BUSINESS_TIMEZONE
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
  };
}
