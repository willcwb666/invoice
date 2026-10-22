import { RentCastService } from '@/services/rentcast-service';
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { BUSINESS_TIMEZONE, zonedTimeToUtc, zonedPartsFromUtc } from "@/lib/calendar/timezone";

// The real calendar subscription URL is a bearer secret — anyone holding it
// can read the owner's private iCloud calendar. It must come from the
// environment, never be hardcoded in source (which may end up in a public
// repo or build artifact).
export const DEFAULT_ICLOUD_URL = process.env.ICLOUD_CALENDAR_URL || "";

/** Dia da semana (0=domingo) de uma data de calendário - independe de fuso. */
function calendarWeekday(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Soma dias de calendário a uma data (mês 1-based), sem envolver hora/fuso. */
function addCalendarDays(
  year: number,
  month: number,
  day: number,
  days: number
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Soma meses de calendário a uma data (mês 1-based), sem envolver hora/fuso. */
function addCalendarMonths(
  year: number,
  month: number,
  day: number,
  months: number
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCMonth(d.getUTCMonth() + months);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export interface ParsedIcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  status?: "SCHEDULED" | "CANCELLED" | "COMPLETED";
  price?: number;
}

export interface SyncICloudResult {
  success: boolean;
  message: string;
  totalFound: number;
  created: number;
  updated: number;
  canceled: number;
  normalizedUrl: string;
}

/**
 * Normaliza qualquer URL de calendário do iPhone/iCloud para o formato HTTPS padrão consumível pelo fetch do Node/Next.js.
 * Suporta:
 * - webcal://pXX-caldav.icloud.com/... -> https://pXX-caldav.icloud.com/...
 * - webcals://... -> https://...
 * - http://... -> https://...
 * - share.icloud.com/... -> https://share.icloud.com/...
 * - URLs com espaços ou aspas
 */
export function normalizeICloudCalendarUrl(url: string): string {
  if (!url) return "";

  let cleaned = url.trim().replace(/^["']|["']$/g, "").trim();
  if (!cleaned) return "";

  // Replace webcal:// or webcals:// scheme
  if (/^webcals?:\/\//i.test(cleaned)) {
    cleaned = cleaned.replace(/^webcals?:\/\//i, "https://");
  } else if (/^http:\/\//i.test(cleaned)) {
    cleaned = cleaned.replace(/^http:\/\//i, "https://");
  } else if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = "https://" + cleaned;
  }

  return cleaned;
}

/**
 * Valida se a URL fornecida é compatível com o feed do iCloud ou webcal
 */
export function validateICloudCalendarUrl(url: string): {
  valid: boolean;
  normalizedUrl: string;
  error?: string;
} {
  const normalized = normalizeICloudCalendarUrl(url);

  if (!normalized) {
    return {
      valid: false,
      normalizedUrl: "",
      error: "Por favor, insira o link do calendário do iPhone/iCloud.",
    };
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return {
        valid: false,
        normalizedUrl: normalized,
        error: "O protocolo da URL deve ser webcal:// ou https://.",
      };
    }

    // Hostname check: strictly allow only official Apple iCloud calendar domains to prevent SSRF
    const hostname = parsed.hostname.toLowerCase();
    const isAllowedICloudHost =
      hostname === "icloud.com" ||
      hostname.endsWith(".icloud.com");

    if (!isAllowedICloudHost) {
      return {
        valid: false,
        normalizedUrl: normalized,
        error: "Domínio não autorizado. Utilize apenas links oficiais do Calendário do iCloud (*.icloud.com).",
      };
    }

    return { valid: true, normalizedUrl: normalized };
  } catch {
    return {
      valid: false,
      normalizedUrl: normalized,
      error: "Formato de URL inválido. Verifique o link copiado do iPhone.",
    };
  }
}

/**
 * Faz o download do feed .ics do iCloud lidando com User-Agent exigido pela Apple e redirecionamentos manuais.
 */
export async function fetchICloudCalendarFeed(url: string): Promise<string> {
  const validation = validateICloudCalendarUrl(url);
  if (!validation.valid) {
    throw new Error(validation.error || "URL de calendário inválida.");
  }

  const baseNormalized = validation.normalizedUrl;
  const userAgents = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (Apple-PubSub/65.28)",
    "Mac_OS_X/14.4 (23E214) CalendarAgent/965",
    "iOS/17.4 (21E219) dataaccessd/1.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  ];

  let lastError: unknown = null;

  for (const ua of userAgents) {
    let currentUrl = baseNormalized;
    const maxRedirects = 6;
    let finalResponse: Response | null = null;

    try {
      for (let i = 0; i < maxRedirects; i++) {
        const hopValidation = validateICloudCalendarUrl(currentUrl);
        if (!hopValidation.valid) {
          throw new Error(hopValidation.error || "Redirecionamento para domínio não autorizado bloqueado.");
        }

        const res = await fetch(hopValidation.normalizedUrl, {
          method: "GET",
          headers: {
            "User-Agent": ua,
            Accept: "text/calendar, text/plain, */*",
            "Cache-Control": "no-cache, no-store",
            Pragma: "no-cache",
          },
          redirect: "manual",
        });

        // Handle 301, 302, 307, 308 redirects manually to convert webcal:// to https:// and validate each hop
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get("location");
          if (!location) break;

          let nextUrl = location.trim();
          if (/^webcals?:\/\//i.test(nextUrl)) {
            nextUrl = nextUrl.replace(/^webcals?:\/\//i, "https://");
          } else {
            try {
              nextUrl = new URL(nextUrl, currentUrl).toString();
            } catch {
              throw new Error("URL de redirecionamento inválida.");
            }
          }

          const nextHopValidation = validateICloudCalendarUrl(nextUrl);
          if (!nextHopValidation.valid) {
            throw new Error(nextHopValidation.error || "Redirecionamento para domínio externo bloqueado.");
          }

          currentUrl = nextHopValidation.normalizedUrl;
          continue;
        }

        finalResponse = res;
        break;
      }

      if (finalResponse && finalResponse.ok) {
        const text = await finalResponse.text();
        if (text.includes("BEGIN:VCALENDAR")) {
          return text;
        }
      }
    } catch (fetchErr: unknown) {
      lastError = fetchErr;
    }
  }

  const lastErrorMessage = lastError instanceof Error ? lastError.message : "Erro de conexão";
  throw new Error(
    `Não foi possível baixar o feed do calendário do iCloud (${lastErrorMessage}). Certifique-se de que a opção 'Calendário Público' está ativa no app Calendário do iPhone.`
  );
}

/**
 * Desescapa caracteres especiais de texto segundo RFC 5545
 */
function unescapeIcsText(str: string): string {
  return str
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/**
 * Converte strings de data do formato iCal (ex: 20260910T143000Z, 20260910T083000, 20260910) em Date JS.
 */
function parseIcsDate(dateStr: string): { date: Date; allDay: boolean } {
  const clean = dateStr.trim();

  // YYYYMMDD (All-Day) - hora 8:00 é só um marcador arbitrário pra ordenar;
  // o que importa é o DIA cair corretamente no calendário de Evans/Greeley.
  if (/^\d{8}$/.test(clean)) {
    const y = parseInt(clean.slice(0, 4), 10);
    const m = parseInt(clean.slice(4, 6), 10) - 1;
    const d = parseInt(clean.slice(6, 8), 10);
    return { date: zonedTimeToUtc(y, m, d, 8, 0, 0, BUSINESS_TIMEZONE), allDay: true };
  }

  // YYYYMMDDTHHMMSSZ (UTC)
  if (/^\d{8}T\d{6}Z$/i.test(clean)) {
    const y = parseInt(clean.slice(0, 4), 10);
    const m = parseInt(clean.slice(4, 6), 10) - 1;
    const d = parseInt(clean.slice(6, 8), 10);
    const h = parseInt(clean.slice(9, 11), 10);
    const min = parseInt(clean.slice(11, 13), 10);
    const s = parseInt(clean.slice(13, 15), 10);
    return { date: new Date(Date.UTC(y, m, d, h, min, s)), allDay: false };
  }

  // YYYYMMDDTHHMMSS (Floating - sem timezone declarado no ICS, o formato mais
  // comum vindo do Calendário do iPhone). O relógio de parede é sempre
  // Evans/Greeley (Colorado) - nunca a hora local do processo Node que roda
  // o sync (Vercel = UTC, dev = qualquer coisa). Sem isso, o mesmo evento
  // podia acabar num dia diferente dependendo de onde o sync rodasse.
  if (/^\d{8}T\d{6}$/i.test(clean)) {
    const y = parseInt(clean.slice(0, 4), 10);
    const m = parseInt(clean.slice(4, 6), 10) - 1;
    const d = parseInt(clean.slice(6, 8), 10);
    const h = parseInt(clean.slice(9, 11), 10);
    const min = parseInt(clean.slice(11, 13), 10);
    const s = parseInt(clean.slice(13, 15), 10);
    return { date: zonedTimeToUtc(y, m, d, h, min, s, BUSINESS_TIMEZONE), allDay: false };
  }

  // Fallback
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return { date: parsed, allDay: false };
  }

  return { date: new Date(), allDay: false };
}

// UTC em todo lugar, de propósito: misturar aritmética de data em horário
// local com valores já em UTC é o que causava agendamentos recorrentes
// pulando de dia (e virando duplicata) dependendo do fuso horário de onde
// o sync rodava.
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const WEEKDAY_CODE_TO_INDEX: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

interface RecurrenceRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count?: number;
  until?: Date;
  byDay?: number[]; // weekday indices (0=Sunday), only meaningful for WEEKLY
}

/**
 * Faz o parsing de uma propriedade RRULE (RFC 5545) - ex:
 * "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE" (limpeza a cada duas semanas, seg e qua).
 * Suporta os padrões reais de agenda recorrente do Calendário do iPhone:
 * FREQ diário/semanal/mensal/anual, INTERVAL, COUNT, UNTIL e BYDAY (semanal).
 * Não implementa toda a RFC (ex: BYMONTHDAY, BYSETPOS) - o suficiente para os
 * casos de uma agenda de limpeza recorrente.
 */
function parseRRule(rruleStr: string): RecurrenceRule | null {
  const map: Record<string, string> = {};
  for (const part of rruleStr.split(";")) {
    const [key, value] = part.split("=");
    if (key && value) map[key.trim().toUpperCase()] = value.trim();
  }

  const freq = map.FREQ as RecurrenceRule["freq"] | undefined;
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) {
    return null;
  }

  const interval = map.INTERVAL ? parseInt(map.INTERVAL, 10) : 1;
  const count = map.COUNT ? parseInt(map.COUNT, 10) : undefined;
  const until = map.UNTIL ? parseIcsDate(map.UNTIL).date : undefined;
  const byDay = map.BYDAY
    ? map.BYDAY.split(",")
        .map((code) => WEEKDAY_CODE_TO_INDEX[code.trim().slice(-2).toUpperCase()])
        .filter((idx): idx is number => idx !== undefined)
    : undefined;

  return {
    freq,
    interval: interval > 0 ? interval : 1,
    count,
    until,
    byDay: byDay && byDay.length > 0 ? byDay : undefined,
  };
}

// Segurança contra RRULEs sem fim (ex: sem COUNT nem UNTIL) - nenhum evento
// recorrente de agenda de limpeza precisa de mais que isso à frente.
const RECURRENCE_HORIZON_DAYS = 730;
const RECURRENCE_EXPANSION_CAP = 500;

/**
 * Expande um evento recorrente (RRULE) em todas as suas ocorrências
 * individuais dentro do horizonte de segurança, pulando datas em EXDATE.
 * Cada ocorrência vira, depois, um Appointment próprio - é assim que o
 * restante do sync já deduplica e atualiza atendimentos individualmente.
 */
function expandRecurrence(
  rule: RecurrenceRule,
  originalStart: Date,
  originalEnd: Date,
  exceptionDayStamps: Set<number>
): { start: Date; end: Date }[] {
  const durationMs = originalEnd.getTime() - originalStart.getTime();
  const horizon = addDays(new Date(), RECURRENCE_HORIZON_DAYS);
  const results: { start: Date; end: Date }[] = [];

  const pushIfValid = (occStart: Date, seriesIndex: number) => {
    if (rule.until && occStart.getTime() > rule.until.getTime()) return false;
    if (rule.count !== undefined && seriesIndex >= rule.count) return false;
    if (occStart.getTime() > horizon.getTime()) return false;
    if (!exceptionDayStamps.has(startOfDay(occStart).getTime())) {
      results.push({ start: occStart, end: new Date(occStart.getTime() + durationMs) });
    }
    return true;
  };

  // Cada ocorrência é recalculada a partir do relógio de parede de Denver
  // (data de calendário + zonedTimeToUtc), nunca por aritmética direta sobre
  // o instante UTC de originalStart. A diferença importa porque Denver troca
  // de UTC-6 para UTC-7 (e vice-versa) ao longo do ano: copiar a hora UTC de
  // originalStart para toda ocorrência futura (como este código fazia antes)
  // desalinha 1h assim que a série atravessa a troca de horário de verão. Da
  // mesma forma, o dia da semana usado para BYDAY tem que ser o dia da
  // semana em Denver, não o de UTC - um evento às 18h+ em Denver já é o dia
  // seguinte em UTC, e usar getUTCDay() fazia a série cair um dia inteiro
  // adiantada.
  const originalLocal = zonedPartsFromUtc(originalStart, BUSINESS_TIMEZONE);

  if (rule.freq === "WEEKLY" && rule.byDay) {
    const sortedDays = [...rule.byDay].sort((a, b) => a - b);
    const originalWeekday = calendarWeekday(originalLocal.year, originalLocal.month, originalLocal.day);
    let weekStart = addCalendarDays(
      originalLocal.year,
      originalLocal.month,
      originalLocal.day,
      -originalWeekday
    ); // domingo daquela semana, em Denver
    let seriesIndex = 0;
    let weeksIterated = 0;

    while (weeksIterated < RECURRENCE_EXPANSION_CAP && results.length < RECURRENCE_EXPANSION_CAP) {
      weeksIterated++;
      for (const dayIdx of sortedDays) {
        const occDate = addCalendarDays(weekStart.year, weekStart.month, weekStart.day, dayIdx);
        const occ = zonedTimeToUtc(
          occDate.year,
          occDate.month - 1,
          occDate.day,
          originalLocal.hour,
          originalLocal.minute,
          originalLocal.second,
          BUSINESS_TIMEZONE
        );
        if (occ.getTime() < originalStart.getTime()) continue;
        const keepGoing = pushIfValid(occ, seriesIndex);
        seriesIndex++;
        if (!keepGoing) return results;
      }
      weekStart = addCalendarDays(weekStart.year, weekStart.month, weekStart.day, 7 * rule.interval);
      if (Date.UTC(weekStart.year, weekStart.month - 1, weekStart.day) > horizon.getTime()) break;
    }
    return results;
  }

  let currentLocal = { year: originalLocal.year, month: originalLocal.month, day: originalLocal.day };
  let seriesIndex = 0;
  let iterations = 0;
  while (iterations < RECURRENCE_EXPANSION_CAP) {
    iterations++;
    const occ = zonedTimeToUtc(
      currentLocal.year,
      currentLocal.month - 1,
      currentLocal.day,
      originalLocal.hour,
      originalLocal.minute,
      originalLocal.second,
      BUSINESS_TIMEZONE
    );
    const keepGoing = pushIfValid(occ, seriesIndex);
    seriesIndex++;
    if (!keepGoing) break;

    switch (rule.freq) {
      case "DAILY":
        currentLocal = addCalendarDays(currentLocal.year, currentLocal.month, currentLocal.day, rule.interval);
        break;
      case "WEEKLY":
        currentLocal = addCalendarDays(currentLocal.year, currentLocal.month, currentLocal.day, 7 * rule.interval);
        break;
      case "MONTHLY":
        currentLocal = addCalendarMonths(currentLocal.year, currentLocal.month, currentLocal.day, rule.interval);
        break;
      case "YEARLY":
        currentLocal = addCalendarMonths(currentLocal.year, currentLocal.month, currentLocal.day, 12 * rule.interval);
        break;
    }
  }

  return results;
}

/**
 * Tenta extrair um valor financeiro (preço) do texto de descrição ou resumo.
 * Ex: "$180", "Valor: 180.00", "$ 200", "Price: $150"
 */
function extractPriceFromText(text: string): number | null {
  if (!text) return null;

  // Match patterns like "Valor: $180", "Price: 180", "$180", "$ 180.50"
  const match =
    text.match(/(?:valor|price|preço|\$)\s*:?\s*\$?\s*(\d+(?:[.,]\d{1,2})?)/i) ||
    text.match(/\$\s*(\d+(?:[.,]\d{1,2})?)/);

  if (match && match[1]) {
    const num = parseFloat(match[1].replace(",", "."));
    if (!isNaN(num) && num > 0 && num < 50000) {
      return num;
    }
  }

  return null;
}

interface SyncableService {
  id: string;
  name: string;
  type: string;
  basePrice: Prisma.Decimal;
}

function tokenizeForServiceMatch(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Words that describe WHERE/WHAT-KIND rather than the core job itself.
// A bare mention of "standard cleaning" (no qualifier) should default to the
// House variant rather than tie with Office, per how this business names
// its catalog.
const SERVICE_QUALIFIER_WORDS = ["house", "office", "residential", "commercial"];

/**
 * Detecta qual serviço cadastrado (Standard/Extra) o título/descrição de um
 * evento do iPhone está descrevendo — ex: "Cliente 1 $100 Moving Out" casa
 * com um serviço chamado "Moving Out/In". Cai para um serviço STANDARD
 * genérico (preferindo um que já contenha a palavra "standard") se nada
 * bater, já que praticamente todo atendimento é algum tipo de limpeza.
 *
 * A correspondência é por sobreposição de palavras exatas (sem stemming),
 * então o nome do serviço no catálogo deve usar palavras parecidas com o que
 * é digitado no Calendário do iPhone para o match funcionar bem.
 */
function detectServicesFromText(text: string, services: SyncableService[]): SyncableService[] {
  const textTokens = new Set(tokenizeForServiceMatch(text));
  if (textTokens.size === 0 || services.length === 0) return [];

  const scored = services
    .map((s) => ({ service: s, nameTokens: tokenizeForServiceMatch(s.name) }))
    .map(({ service, nameTokens }) => ({
      service,
      nameTokens,
      score: nameTokens.filter((t) => textTokens.has(t)).length,
    }))
    .filter((s) => s.score > 0);

  if (scored.length > 0) {
    const maxScore = Math.max(...scored.map((s) => s.score));
    let top = scored.filter((s) => s.score === maxScore);

    // Tie-break 1: if the text doesn't call out a qualifier (e.g. "office"),
    // prefer candidates that don't require one either.
    if (top.length > 1 && !SERVICE_QUALIFIER_WORDS.some((q) => textTokens.has(q))) {
      const withoutQualifier = top.filter(
        (s) => !s.nameTokens.some((t) => SERVICE_QUALIFIER_WORDS.includes(t))
      );
      if (withoutQualifier.length > 0) top = withoutQualifier;
    }

    // Tie-break 2: prefer the more concise/generic name (fewest extra words
    // not mentioned in the text).
    top.sort((a, b) => a.nameTokens.length - b.nameTokens.length);

    return [top[0].service];
  }

  // Nothing matched at all — default to a generic Standard service.
  const standardServices = services.filter((s) => s.type === "STANDARD");
  const genericStandard =
    standardServices.find(
      (s) =>
        tokenizeForServiceMatch(s.name).includes("standard") &&
        !s.name.toLowerCase().includes("office") &&
        !s.name.toLowerCase().includes("half")
    ) || standardServices.find((s) => tokenizeForServiceMatch(s.name).includes("standard")) ||
    standardServices[0];

  return genericStandard ? [genericStandard] : [];
}

// Palavras-chave genéricas que indicam que o evento do calendário não é um
// atendimento de cliente de verdade (tarefa interna, dia de folga, etc.) —
// usadas para não criar um "cliente" falso a partir desses títulos. Não
// inclui nada específico de uma empresa/pessoa (eventos pessoais específicos
// não generalizam para outras empresas e são dados sensíveis).
const GENERIC_CALENDAR_TASKS = new Set([
  "banheiro", "banheiros", "cozinha", "geladeira", "forno", "rodapé",
  "move out", "move in", "moving out", "moving in", "deep clean", "deep cleaning",
  "helper", "visita", "novo evento", "day off", "no school", "sem aulas",
]);

export interface CleanClientDetails {
  clientName: string;
  price?: number;
  serviceNotes?: string;
  isGenericTask: boolean;
}

export function extractClientAndDetails(summary: string): CleanClientDetails {
  if (!summary) {
    return { clientName: "Atendimento Avulso", isGenericTask: true };
  }

  let text = summary.trim();

  // 1. Extrair Preço ($130, $ 130.00, $130$, $97,50, 130$)
  let price: number | undefined;
  const priceMatch = text.match(/\$\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*\$/i);
  if (priceMatch) {
    const valStr = (priceMatch[1] || priceMatch[2]).replace(",", ".");
    price = parseFloat(valStr);
  }

  // 2. Remover o preço do texto
  text = text.replace(/\$\s*\d+(?:[.,]\d{1,2})?\s*\+?\s*\d*\$?/gi, " ");
  text = text.replace(/\b\d+(?:[.,]\d{1,2})?\s*\$/gi, " ");
  text = text.replace(/\$\s*\d+(?:[.,]\d{1,2})?/gi, " ");

  // 3. Remover prefixos de pagamento (Pg, Pago, Pagou, Paga, Saldo, Paid, Pd)
  text = text.replace(/^\s*(?:pg|pgo|pago|paga|pagou|pagamento|paid|pd|saldo)\b[\s.:—-]*/i, "");
  text = text.replace(/^\s*pg(?=[A-Z\s])/i, "");

  // 4. Remover prefixos de serviço (Limpeza, Faxina, Cleaning, Atendimento)
  text = text.replace(/^\s*(?:limpeza|faxina|cleaning|clean|atendimento|serviço|servico)\b[\s.:—-]*/i, "");

  // Tratar menções como "Porão Laura Reynalds" -> Cliente "Laura Reynalds", Nota "Porão"
  let extraRoomNote: string | undefined;
  const poraoMatch = text.match(/\b(?:porão|porao)\b/i);
  if (poraoMatch) {
    extraRoomNote = "Porão";
    text = text.replace(/\b(?:porão|porao)\b/gi, " ");
  }

  // 5. Remover pontuações nas bordas
  text = text.replace(/^[\s-:—.,/\\|&$;+]+/, "").replace(/[\s-:—.,/\\|&$;+]+$/, "").trim();

  const lower = text.toLowerCase();
  if (GENERIC_CALENDAR_TASKS.has(lower) || lower === "banheiro" || lower === "banheiros") {
    return {
      clientName: "Atendimento Avulso",
      price,
      serviceNotes: text,
      isGenericTask: true,
    };
  }

  // Separar subtítulo com hífen (ex: Emily - marido Chileno)
  let serviceNotes = extraRoomNote;
  const parts = text.split(/\s+[-—]\s+/);
  if (parts.length === 2) {
    text = parts[0].trim();
    if (!serviceNotes) serviceNotes = parts[1].trim();
  }

  // Capitalização limpa
  text = text
    .split(/\s+/)
    .map((w) => {
      if (w.length <= 2 && /^(de|da|do|dos|das|e)$/i.test(w)) return w.toLowerCase();
      if (w.startsWith("(") && w.length > 2) {
        return "(" + w.charAt(1).toUpperCase() + w.slice(2);
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");

  if (text.length < 2) text = "Cliente Avulso";

  return {
    clientName: text,
    price,
    serviceNotes,
    isGenericTask: false,
  };
}

interface RawVEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  dtStartStr: string;
  dtEndStr: string;
  statusRaw: string;
  rrule?: string;
  exdateStrs: string[];
  recurrenceIdStr?: string;
}

function parseRawVEvent(lines: string[]): RawVEvent | null {
  let uid = "";
  let summary = "";
  let description = "";
  let location = "";
  let dtStartStr = "";
  let dtEndStr = "";
  let statusRaw = "";
  let rrule: string | undefined;
  const exdateStrs: string[] = [];
  let recurrenceIdStr: string | undefined;

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const keyPart = line.slice(0, colonIndex).toUpperCase();
    const valuePart = line.slice(colonIndex + 1);

    const [propName] = keyPart.split(";");

    switch (propName) {
      case "UID":
        uid = valuePart.trim();
        break;
      case "SUMMARY":
        summary = unescapeIcsText(valuePart.trim());
        break;
      case "DESCRIPTION":
        description = unescapeIcsText(valuePart.trim());
        break;
      case "LOCATION":
        location = unescapeIcsText(valuePart.trim());
        break;
      case "DTSTART":
        dtStartStr = valuePart.trim();
        break;
      case "DTEND":
        dtEndStr = valuePart.trim();
        break;
      case "STATUS":
        statusRaw = valuePart.trim().toUpperCase();
        break;
      case "RRULE":
        rrule = valuePart.trim();
        break;
      case "EXDATE":
        exdateStrs.push(
          ...valuePart
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        );
        break;
      case "RECURRENCE-ID":
        recurrenceIdStr = valuePart.trim();
        break;
    }
  }

  if (!dtStartStr) {
    return null;
  }

  return {
    uid,
    summary,
    description,
    location,
    dtStartStr,
    dtEndStr,
    statusRaw,
    rrule,
    exdateStrs,
    recurrenceIdStr,
  };
}

/**
 * Monta o evento final a partir dos campos brutos do VEVENT. `overrideStart`/
 * `overrideEnd`/`uidOverride` são usados ao expandir um evento recorrente:
 * cada ocorrência tem seu próprio horário e um UID estável (`uid::data`) para
 * virar - e continuar sendo reconhecida como - um Appointment próprio.
 */
function buildParsedEvent(
  raw: RawVEvent,
  overrideStart?: Date,
  overrideEnd?: Date,
  uidOverride?: string
): ParsedIcsEvent {
  const { date: parsedStart, allDay } = parseIcsDate(raw.dtStartStr);
  const startDate = overrideStart || parsedStart;

  let endDate: Date;
  if (overrideEnd) {
    endDate = overrideEnd;
  } else if (raw.dtEndStr) {
    endDate = parseIcsDate(raw.dtEndStr).date;
  } else {
    // Se não tiver DTEND, adiciona 2 horas (ou 8 horas se for o dia todo)
    const durationHours = allDay ? 8 : 2;
    endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
  }

  // Se a data de fim for menor ou igual à data de início, ajusta para +2h
  if (endDate.getTime() <= startDate.getTime()) {
    endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  }

  const eventUid =
    uidOverride ||
    raw.uid ||
    `event-${startDate.getTime()}-${encodeURIComponent(raw.summary.slice(0, 20))}`;

  let status: "SCHEDULED" | "CANCELLED" | "COMPLETED" = "SCHEDULED";
  if (raw.statusRaw === "CANCELLED") {
    status = "CANCELLED";
  }

  const summaryPrice =
    extractPriceFromText(raw.summary) ?? extractClientAndDetails(raw.summary).price ?? null;
  const descriptionPrice = extractPriceFromText(raw.description);
  const extractedPrice =
    summaryPrice !== null && summaryPrice !== undefined
      ? summaryPrice
      : (descriptionPrice || undefined);

  return {
    uid: eventUid,
    summary: raw.summary || "Atendimento Calendário iPhone",
    description: raw.description || undefined,
    location: raw.location || undefined,
    startDate,
    endDate,
    allDay,
    status,
    price: extractedPrice,
  };
}

/**
 * Faz o parsing de um arquivo de texto iCalendar (.ics) e retorna os eventos
 * estruturados - já expandindo eventos recorrentes (RRULE) em uma ocorrência
 * por atendimento real, e aplicando EXDATE e substituições (RECURRENCE-ID)
 * de ocorrências individuais editadas na série.
 */
export function parseIcsEvents(icsContent: string): ParsedIcsEvent[] {
  // Desdobramento de linhas (RFC 5545 section 3.1)
  const unfolded = icsContent
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .replace(/\r[ \t]/g, "");

  const lines = unfolded.split(/\r\n|\n|\r/);
  const rawEvents: RawVEvent[] = [];

  let inEvent = false;
  let currentEventLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      currentEventLines = [];
    } else if (trimmed === "END:VEVENT") {
      if (inEvent) {
        const raw = parseRawVEvent(currentEventLines);
        if (raw) {
          rawEvents.push(raw);
        }
      }
      inEvent = false;
      currentEventLines = [];
    } else if (inEvent) {
      currentEventLines.push(line);
    }
  }

  // RECURRENCE-ID marca a substituição de UMA ocorrência específica de uma
  // série (ex: arrastar só uma limpeza pra outro horário no iPhone) -
  // separa essas substituições por UID da série antes de expandir, pra
  // trocar a ocorrência gerada automaticamente em vez de duplicá-la.
  const overridesByUid = new Map<string, RawVEvent[]>();
  const regularEvents: RawVEvent[] = [];

  for (const raw of rawEvents) {
    if (raw.recurrenceIdStr && raw.uid) {
      const list = overridesByUid.get(raw.uid) || [];
      list.push(raw);
      overridesByUid.set(raw.uid, list);
    } else {
      regularEvents.push(raw);
    }
  }

  const events: ParsedIcsEvent[] = [];

  for (const raw of regularEvents) {
    if (!raw.rrule) {
      events.push(buildParsedEvent(raw));
      continue;
    }

    const rule = parseRRule(raw.rrule);
    if (!rule) {
      // RRULE não reconhecida por este parser - trata como evento único, o
      // que é melhor do que o atendimento simplesmente desaparecer do sync.
      events.push(buildParsedEvent(raw));
      continue;
    }

    const { date: originalStart } = parseIcsDate(raw.dtStartStr);
    const originalEnd = raw.dtEndStr
      ? parseIcsDate(raw.dtEndStr).date
      : new Date(originalStart.getTime() + 2 * 60 * 60 * 1000);

    const exceptionDayStamps = new Set(
      raw.exdateStrs.map((s) => startOfDay(parseIcsDate(s).date).getTime())
    );

    const overrides = overridesByUid.get(raw.uid) || [];
    const overrideDayStamps = new Set(
      overrides
        .map((o) =>
          o.recurrenceIdStr ? startOfDay(parseIcsDate(o.recurrenceIdStr).date).getTime() : undefined
        )
        .filter((t): t is number => t !== undefined)
    );

    const occurrences = expandRecurrence(rule, originalStart, originalEnd, exceptionDayStamps);
    for (const occ of occurrences) {
      // Ocorrências com uma versão editada (override) abaixo são puladas
      // aqui - a versão editada entra no lugar da gerada automaticamente.
      if (overrideDayStamps.has(startOfDay(occ.start).getTime())) continue;
      events.push(
        buildParsedEvent(raw, occ.start, occ.end, `${raw.uid}::${occ.start.toISOString()}`)
      );
    }

    for (const override of overrides) {
      const { date: overrideStart, allDay } = parseIcsDate(override.dtStartStr || raw.dtStartStr);
      const overrideEnd = override.dtEndStr
        ? parseIcsDate(override.dtEndStr).date
        : new Date(overrideStart.getTime() + (allDay ? 8 : 2) * 60 * 60 * 1000);
      const recurrenceDate = override.recurrenceIdStr
        ? parseIcsDate(override.recurrenceIdStr).date
        : overrideStart;
      events.push(
        buildParsedEvent(
          override,
          overrideStart,
          overrideEnd,
          `${raw.uid}::${recurrenceDate.toISOString()}`
        )
      );
    }
  }

  return events;
}

// Keyed by companyId so a manual "Sincronizar Agora" click, a second browser
// tab doing the same, and the automatic sync triggered by a page load can
// never run concurrently for the same company. Without this, two syncs
// racing each other both load the same "does this occurrence already
// exist" snapshot before either writes, both see no match, and both create
// it — a permanent duplicate appointment. Every caller must go through the
// exported syncICloudCalendarForCompany below, never the internal
// implementation directly.
//
// This Map only protects against two calls landing in the SAME process -
// it does nothing across Vercel serverless instances, which don't share
// memory. In production this file has two entry points that can legitimately
// fire at the same moment on two different instances: instrumentation.ts's
// cold-start auto-sync, and a user clicking "Sincronizar Agora" (or the
// 5-minute auto-sync in ensureICloudCalendarSynced below, whose own
// in-memory activeSyncPromise/lastSyncTimestamp have the identical gap).
// Confirmed in production runtime logs: two events failed with "Unique
// constraint failed on the constraint: appointments_companyId_externalEventId_key"
// from prisma.appointment.upsert() - exactly the scenario this comment
// already described, just happening across instances instead of within one.
// claimIcloudSyncLock/releaseIcloudSyncLock below add the actual
// cross-instance guarantee via a DB row (CompanyProfile.icloudSyncLockedAt);
// this Map stays as a cheap same-instance fast path on top of it.
const companySyncLocks = new Map<string, Promise<SyncICloudResult>>();

// How long a claimed sync lock is honored before being considered stale
// (e.g. the instance holding it crashed or was recycled mid-sync) and
// reclaimable by the next caller.
const SYNC_LOCK_STALE_MINUTES = 10;

async function claimIcloudSyncLock(companyId: string): Promise<boolean> {
  const staleThreshold = new Date(Date.now() - SYNC_LOCK_STALE_MINUTES * 60 * 1000);
  const result = await prisma.companyProfile.updateMany({
    where: {
      id: companyId,
      OR: [{ icloudSyncLockedAt: null }, { icloudSyncLockedAt: { lt: staleThreshold } }],
    },
    data: { icloudSyncLockedAt: new Date() },
  });
  return result.count === 1;
}

async function releaseIcloudSyncLock(companyId: string): Promise<void> {
  try {
    await prisma.companyProfile.update({
      where: { id: companyId },
      data: { icloudSyncLockedAt: null },
    });
  } catch (err) {
    console.warn("Não foi possível liberar o lock de sincronização do iCloud:", err);
  }
}

/**
 * Executa a sincronização completa do calendário do iCloud para uma empresa:
 * 1. Valida e normaliza o link
 * 2. Atualiza a URL no CompanyProfile (armazenando a URL original webcal://)
 * 3. Faz o download do feed .ics
 * 4. Faz o parse dos eventos
 * 5. Mapeia/cria clientes e atualiza/insere agendamentos (Appointments)
 *
 * Locked per companyId (see companySyncLocks above) — a call that arrives
 * while a sync for the same company is already running simply awaits that
 * same in-flight result instead of starting a second, racing sync.
 */
export function syncICloudCalendarForCompany(
  companyId: string,
  rawUrl: string
): Promise<SyncICloudResult> {
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build" ||
    process.env.NEXT_BUILD === "1"
  ) {
    return Promise.resolve({
      success: true,
      message: "Sync bypassed during build phase.",
      totalFound: 0,
      created: 0,
      updated: 0,
      canceled: 0,
      normalizedUrl: rawUrl,
    });
  }

  const inFlight = companySyncLocks.get(companyId);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<SyncICloudResult> => {
    const acquired = await claimIcloudSyncLock(companyId);
    if (!acquired) {
      // Another instance holds the DB lock right now - rather than fail or
      // block, report a no-op. The caller that IS holding the lock will
      // finish the real sync shortly; this just avoids a second racing run.
      return {
        success: true,
        message: "Sincronização já em andamento (em outra instância) — pulado.",
        totalFound: 0,
        created: 0,
        updated: 0,
        canceled: 0,
        normalizedUrl: validateICloudCalendarUrl(rawUrl).normalizedUrl || rawUrl,
      };
    }
    try {
      return await syncICloudCalendarForCompanyUnlocked(companyId, rawUrl);
    } finally {
      await releaseIcloudSyncLock(companyId);
    }
  })().finally(() => {
    companySyncLocks.delete(companyId);
  });
  companySyncLocks.set(companyId, promise);
  return promise;
}

async function syncICloudCalendarForCompanyUnlocked(
  companyId: string,
  rawUrl: string
): Promise<SyncICloudResult> {
  const validation = validateICloudCalendarUrl(rawUrl);
  if (!validation.valid) {
    throw new Error(validation.error || "URL do calendário inválida.");
  }

  const normalizedUrl = validation.normalizedUrl;
  const urlToSave = rawUrl.trim();

  // 1. Save URL in company profile (preserving webcal:// scheme)
  const company = await prisma.companyProfile.update({
    where: { id: companyId },
    data: { icloudCalendarUrl: urlToSave },
  });

  // 2. Download the .ics feed
  const icsText = await fetchICloudCalendarFeed(normalizedUrl);

  // 3. Parse all events
  const allEvents = parseIcsEvents(icsText);

  if (allEvents.length === 0) {
    return {
      success: true,
      message: "Conexão com o iCloud bem-sucedida! Nenhum evento encontrado no calendário no momento.",
      totalFound: 0,
      created: 0,
      updated: 0,
      canceled: 0,
      normalizedUrl,
    };
  }

  // 4. Filter to a dynamic sync window: includes past 60 days to ensure recent history
  //    (current and previous month) is complete, plus upcoming windowDays (default 90).
  const now = new Date();
  const pastDays = 60;
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - pastDays);
  windowStart.setUTCHours(0, 0, 0, 0);

  const futureDays = Math.max(company.icloudSyncWindowDays || 90, 90);
  const windowEnd = new Date(now);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + futureDays);
  windowEnd.setUTCHours(23, 59, 59, 999);

  const events = allEvents.filter(
    (e) => e.startDate >= windowStart && e.startDate <= windowEnd
  );

  // 5. Load existing clients in ONE query
  const existingClients = await prisma.client.findMany({
    where: { companyId },
  });

  // Catalog of registered services (Standard/Extra), used to detect which
  // service(s) a calendar event's title/description refers to.
  const services: SyncableService[] = await prisma.service.findMany({
    where: { companyId },
    select: { id: true, name: true, type: true, basePrice: true },
  });

  // 6. Load existing ICLOUD_SYNC appointments in ONE query (for deduplication)
  //    Also scoped to the same forward-looking window — past appointments are
  //    frozen and never revisited.
  const existingAppts = await prisma.appointment.findMany({
    where: {
      companyId,
      origin: "ICLOUD_SYNC",
      date: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true,
      externalEventId: true,
      title: true,
      date: true,
      startTime: true,
      endTime: true,
      location: true,
      notes: true,
      status: true,
      price: true,
      clientId: true,
      manuallyEdited: true,
      paid: true,
      invoiced: true,
      invoiceId: true,
      invoice: { select: { id: true, status: true } },
      services: { select: { serviceId: true } },
    },
  });

  // Build lookup maps for O(1) deduplication
  const apptByUid = new Map(
    existingAppts
      .filter((a) => a.externalEventId)
      .map((a) => [a.externalEventId!, a])
  );
  const apptByTitleTime = new Map(
    existingAppts.map((a) => [`${a.title}|${a.startTime.toISOString()}`, a])
  );

  let createdCount = 0;
  let updatedCount = 0;
  // One malformed/unexpected event (a bad Decimal, an unusual character, a
  // constraint violation) used to throw out of this loop entirely, silently
  // dropping every event still to come - feed order isn't chronological, so
  // that could drop events anywhere in the window, not just at the end.
  // Isolated per event instead: one failure is logged and skipped, the rest
  // of the batch still runs.
  const failedEvents: { uid: string; summary: string; error: string }[] = [];
  const normalizeForNameMatch = (name: string): string =>
    name.toLowerCase().replace(/[\s\-_(),.]+/g, " ").trim();

  const normalizeForAddressMatch = (addr: string): string =>
    addr
      .toLowerCase()
      .replace(/[\r\n]+/g, ", ")
      .replace(/\b(united states|usa)\b/gi, "")
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const extractStreetCore = (addr: string): string => {
    if (!addr) return "";
    const firstPart = addr.split(/[\r\n,]/)[0].trim().toLowerCase();
    return firstPart.replace(/[^a-z0-9]/g, "");
  };

  const clientCache = new Map(
    existingClients.map((c) => [normalizeForNameMatch(c.name), c])
  );

  for (const event of events) {
   try {
    const summaryLower = event.summary.toLowerCase().trim();
    const locationTrimmed = (event.location || "").trim();
    const locationNorm = normalizeForAddressMatch(locationTrimmed);
    const locationCore = extractStreetCore(locationTrimmed);
    const extracted = extractClientAndDetails(event.summary);

    // Helper para casar por endereço físico robusto
    const findClientByAddress = () => {
      if (!locationTrimmed || locationTrimmed.length < 5 || locationTrimmed.toLowerCase().includes("endereço via")) {
        return undefined;
      }
      return existingClients.find((c) => {
        if (!c.address || c.name.toLowerCase() === "atendimento avulso") return false;
        const cCore = extractStreetCore(c.address);
        if (locationCore.length >= 6 && cCore.length >= 6 && locationCore === cCore) {
          return true;
        }
        const cNorm = normalizeForAddressMatch(c.address);
        return (
          (locationNorm.length >= 8 && cNorm.includes(locationNorm)) ||
          (cNorm.length >= 8 && locationNorm.includes(cNorm))
        );
      });
    };

    // --- Client matching ---
    let clientId: string | null = null;

    if (extracted.isGenericTask) {
      // Tarefas genéricas ($40 Banheiro, Buscar água, etc.) casam por endereço com cliente real se houver
      const matchedByAddress = findClientByAddress();
      if (matchedByAddress) {
        clientId = matchedByAddress.id;
      }
      // Se não tem endereço ou não casou com cliente real, direciona ao "Atendimento Avulso"
      if (!clientId) {
        const avulso = existingClients.find((c) => c.name.toLowerCase() === "atendimento avulso");
        if (avulso) clientId = avulso.id;
      }
    } else {
      const cleanLower = extracted.clientName.toLowerCase().trim();
      const normClientName = normalizeForNameMatch(extracted.clientName);

      // 1. Casamento exato por nome limpo ou normalizado
      const exactMatch = existingClients.find((c) => {
        const cClean = c.name.toLowerCase().trim();
        return cClean === cleanLower || normalizeForNameMatch(c.name) === normClientName;
      });

      if (exactMatch) {
        clientId = exactMatch.id;
      } else {
        // 2. Casamento por endereço físico (rua e número exatos)
        const matchedByAddress = findClientByAddress();
        if (matchedByAddress) {
          clientId = matchedByAddress.id;
        } else {
          // 3. Casamento por inclusão de nome (apenas palavras com >= 4 letras, nunca por preços ou genéricos)
          const subMatch = existingClients.find((c) => {
            const cNameLower = c.name.toLowerCase().trim();
            if (cNameLower === "atendimento avulso" || cNameLower.length < 4 || cleanLower.length < 4) return false;
            return cNameLower.includes(cleanLower) || cleanLower.includes(cNameLower);
          });
          if (subMatch) {
            clientId = subMatch.id;
          }
        }
      }
    }

    // Auto-create client if none matched
    if (!clientId) {
      const derivedName = (extracted.isGenericTask ? "Atendimento Avulso" : extracted.clientName).trim();
      const cacheKey = normalizeForNameMatch(derivedName);
      let autoClient = clientCache.get(cacheKey);

      // Verificação em banco para evitar race condition entre execuções concorrentes de sync
      if (!autoClient) {
        const existingInDb = await prisma.client.findFirst({
          where: {
            companyId,
            name: { equals: derivedName, mode: "insensitive" },
          },
        });

        if (existingInDb) {
          autoClient = existingInDb;
          existingClients.push(autoClient);
          clientCache.set(cacheKey, autoClient);
        }
      }

      if (!autoClient) {
        let city = "Greeley";
        const state = "CO";
        let zipCode = "80631";

        if (event.location) {
          const locLower = event.location.toLowerCase();
          if (locLower.includes("loveland")) { city = "Loveland"; zipCode = "80538"; }
          else if (locLower.includes("windsor")) { city = "Windsor"; zipCode = "80550"; }
          else if (locLower.includes("evans")) { city = "Evans"; zipCode = "80620"; }
          else if (locLower.includes("fort collins")) { city = "Fort Collins"; zipCode = "80525"; }
          const zipMatch = event.location.match(/\b(80\d{3})\b/);
          if (zipMatch) zipCode = zipMatch[1];
        }

        autoClient = await prisma.client.create({
          data: {
            companyId,
            name: derivedName,
            address: event.location || "Endereço via Calendário iPhone",
            city,
            state,
            zipCode,
            notes: "Importado automaticamente do Calendário iPhone (iCloud)",
          },
        });
        existingClients.push(autoClient);
        clientCache.set(cacheKey, autoClient);

        if (event.location && event.location.trim().length >= 6) {
          const clientIdToEnrich = autoClient.id;
          RentCastService.fetchProperty(event.location)
            .then(async (prop) => {
              if (prop && (prop.bedrooms !== null || prop.bathrooms !== null || prop.squareFeet !== null)) {
                await prisma.client.update({
                  where: { id: clientIdToEnrich },
                  data: {
                    bedrooms: prop.bedrooms ?? undefined,
                    bathrooms: prop.bathrooms ?? undefined,
                    squareFeet: prop.squareFeet ?? undefined,
                    propertyType: prop.propertyType ?? undefined,
                  },
                });
              }
            })
            .catch((err) => console.warn('[iCloudSync] RentCast background enrichment error:', err));
        }
      }

      clientId = autoClient.id;
    }

    // --- Service detection from the event's text (title + description) ---
    // The iPhone Calendar has no price/service fields, so both are written
    // as free text (e.g. "Cliente 1 $100 Moving Out") — detect which
    // registered service(s) apply, falling back to a STANDARD service when
    // nothing specific is mentioned.
    const matchedServices = detectServicesFromText(
      `${event.summary} ${event.description || ""}`,
      services
    );
    const matchedServicesSum = matchedServices.reduce((acc, s) => acc + Number(s.basePrice), 0);

    // --- Status ---
    let apptStatus: "SCHEDULED" | "COMPLETED" | "CANCELLED" = "SCHEDULED";
    if (event.status === "CANCELLED") {
      apptStatus = "CANCELLED";
    } else if (event.endDate < now) {
      apptStatus = "COMPLETED";
    }

    // --- Deduplication via in-memory lookup maps ---
    const existingByUid = event.uid ? apptByUid.get(event.uid) : undefined;
    const existingByTitleTime = apptByTitleTime.get(
      `${event.summary}|${event.startDate.toISOString()}`
    );
    const existing = existingByUid || existingByTitleTime;

    const effectivePrice = event.price !== undefined ? event.price : extracted.price;
    const calculatedPrice = effectivePrice !== undefined
      ? new Prisma.Decimal(effectivePrice)
      : existing
      ? existing.price
      : new Prisma.Decimal(matchedServicesSum > 0 ? matchedServicesSum : 150.0);

    // Snapshot price per matched service: if there's exactly one match and we
    // parsed a real $ amount from the text, that's the negotiated price for
    // that service; otherwise each service keeps its own catalog basePrice.
    const appointmentServicesData = matchedServices.map((s) => ({
      serviceId: s.id,
      price:
        matchedServices.length === 1 && effectivePrice !== undefined
          ? new Prisma.Decimal(effectivePrice)
          : s.basePrice,
    }));
    const matchedServiceIds = matchedServices.map((s) => s.id).sort();

    // O calendário do iPhone escreve preço e cliente juntos no título livre
    // (ex: "$100 Cliente 1") porque não tem campos próprios para isso. Usar
    // esse texto crú como Appointment.title faria "$100 Cliente 1" aparecer
    // em toda a tela/relatório que mostra o título — quando agendamentos
    // criados dentro do app sempre usam o título pra descrever o SERVIÇO
    // (ex: "Standard Cleaning"), nunca o cliente (isso já vem de `client`).
    // Deriva o título do mesmo jeito: nome do(s) serviço(s) detectado(s), ou
    // a nota da tarefa genérica (ex: "Banheiro") quando não é um cliente real.
    const derivedTitle = extracted.isGenericTask
      ? extracted.serviceNotes || "Atendimento Avulso"
      : matchedServices.length > 0
      ? matchedServices.map((s) => s.name).join(" + ")
      : "Atendimento";
    const safeSummary = derivedTitle.slice(0, 255);
    const safeLocation = event.location ? event.location.slice(0, 500) : null;
    const safeNotes = event.description ? event.description.slice(0, 5000) : null;
    const safeUid = event.uid.slice(0, 255);

    if (existing) {
      const dateChanged =
        existing.date.getTime() !== event.startDate.getTime() ||
        existing.startTime.getTime() !== event.startDate.getTime();

      // Manually-completed appointments on the SAME date are never reverted back to SCHEDULED
      // by a stale calendar entry. BUT if the date or time moved on the calendar,
      // it was explicitly rescheduled by the user on the iPhone and MUST be updated!
      const isProtectedCompletion =
        !dateChanged && existing.status === "COMPLETED" && apptStatus === "SCHEDULED";

      // Once a user edits this appointment by hand in the app (services,
      // price, time, etc.), the iPhone calendar is no longer the source of
      // truth for it — never let a later sync silently revert that edit.
      if (existing.manuallyEdited) {
        continue;
      }

      const resolvedClientId = clientId || existing.clientId;
      const resolvedLocation = safeLocation;
      const resolvedNotes = safeNotes;
      const existingServiceIds = existing.services.map((s) => s.serviceId).sort();
      const sameServices =
        existingServiceIds.length === matchedServiceIds.length &&
        existingServiceIds.every((id, i) => id === matchedServiceIds[i]);

      const unchanged =
        existing.title === safeSummary &&
        existing.clientId === resolvedClientId &&
        existing.date.getTime() === event.startDate.getTime() &&
        existing.startTime.getTime() === event.startDate.getTime() &&
        existing.endTime.getTime() === event.endDate.getTime() &&
        (existing.location || null) === resolvedLocation &&
        (existing.notes || null) === resolvedNotes &&
        existing.price.equals(calculatedPrice) &&
        existing.status === apptStatus &&
        sameServices;

      if (!isProtectedCompletion && !unchanged) {
        await prisma.appointment.update({
          where: { id: existing.id },
          data: {
            title: safeSummary,
            clientId: resolvedClientId,
            date: event.startDate,
            startTime: event.startDate,
            endTime: event.endDate,
            location: safeLocation || undefined,
            notes: safeNotes || undefined,
            price: calculatedPrice,
            status: apptStatus,
            origin: "ICLOUD_SYNC",
            externalEventId: safeUid,
            services: {
              deleteMany: {},
              ...(appointmentServicesData.length ? { create: appointmentServicesData } : {}),
            },
          },
        });
        updatedCount++;
      }
    } else {
      // Check if an appointment with this externalEventId already exists anywhere in DB (e.g. created prior to windowStart)
      const existingInDb = safeUid
        ? await prisma.appointment.findUnique({
            where: {
              companyId_externalEventId: {
                companyId,
                externalEventId: safeUid,
              },
            },
            select: { id: true, manuallyEdited: true },
          })
        : null;

      if (existingInDb) {
        if (!existingInDb.manuallyEdited) {
          await prisma.appointment.update({
            where: { id: existingInDb.id },
            data: {
              title: safeSummary,
              clientId: clientId!,
              date: event.startDate,
              startTime: event.startDate,
              endTime: event.endDate,
              location: safeLocation || undefined,
              notes: safeNotes || undefined,
              price: calculatedPrice,
              status: apptStatus,
              origin: "ICLOUD_SYNC",
              services: {
                deleteMany: {},
                ...(appointmentServicesData.length ? { create: appointmentServicesData } : {}),
              },
            },
          });
          updatedCount++;
        }
      } else {
        if (safeUid) {
          const upsertedAppt = await prisma.appointment.upsert({
            where: {
              companyId_externalEventId: {
                companyId,
                externalEventId: safeUid,
              },
            },
            update: {
              title: safeSummary,
              clientId: clientId!,
              date: event.startDate,
              startTime: event.startDate,
              endTime: event.endDate,
              location: safeLocation || undefined,
              notes: safeNotes || undefined,
              price: calculatedPrice,
              status: apptStatus,
              origin: "ICLOUD_SYNC",
              services: {
                deleteMany: {},
                ...(appointmentServicesData.length
                  ? { create: appointmentServicesData }
                  : {}),
              },
            },
            create: {
              companyId,
              clientId: clientId!,
              title: safeSummary,
              date: event.startDate,
              startTime: event.startDate,
              endTime: event.endDate,
              location: safeLocation,
              price: calculatedPrice,
              status: apptStatus,
              origin: "ICLOUD_SYNC",
              externalEventId: safeUid,
              notes: safeNotes,
              ...(appointmentServicesData.length
                ? { services: { create: appointmentServicesData } }
                : {}),
            },
          });
          apptByUid.set(safeUid, upsertedAppt as any);
          createdCount++;
        } else {
          const createdAppt = await prisma.appointment.create({
            data: {
              companyId,
              clientId: clientId!,
              title: safeSummary,
              date: event.startDate,
              startTime: event.startDate,
              endTime: event.endDate,
              location: safeLocation,
              price: calculatedPrice,
              status: apptStatus,
              origin: "ICLOUD_SYNC",
              notes: safeNotes,
              ...(appointmentServicesData.length
                ? { services: { create: appointmentServicesData } }
                : {}),
            },
          });
          createdCount++;
        }
      }
    }
   } catch (eventErr: unknown) {
    const msg = eventErr instanceof Error ? eventErr.message : String(eventErr);
    console.error(`[iCloud Sync] Falha ao processar evento "${event.summary}" (${event.uid}):`, msg);
    failedEvents.push({ uid: event.uid, summary: event.summary, error: msg });
   }
  }

  // 7. Cancel orphaned appointments: anything ICLOUD_SYNC created from a UID
  //    that no longer appears in the current feed window. This happens when an
  //    event is deleted on the iPhone (either single event, exception or series
  //    truncation/cancellation). If the user deleted it from the iPhone calendar,
  //    that service was cancelled or did not take place.
  //    We preserve only appointments that:
  //    - Were manually edited by hand inside the web application (manuallyEdited: true)
  //    - Have already been paid (paid: true or attached to a PAID invoice)
  //    Anything else is marked CANCELLED and unlinked from unpaid invoices.
  const feedUidSet = new Set(events.map((e) => e.uid));
  let canceledCount = 0;
  for (const appt of existingAppts) {
    if (!appt.externalEventId) continue;
    if (appt.date < windowStart || appt.date > windowEnd) continue;
    if (feedUidSet.has(appt.externalEventId)) continue;
    if (appt.manuallyEdited) continue;
    if (appt.paid) continue;
    if (appt.invoice?.status === "PAID") continue;
    if (appt.status === "CANCELLED") continue;

    await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        status: "CANCELLED",
        invoiced: false,
        invoiceId: null,
      },
    });
    canceledCount++;
  }

  const message =
    (createdCount > 0 || updatedCount > 0 || canceledCount > 0
      ? `${createdCount} novos atendimentos importados, ${updatedCount} atualizados e ${canceledCount} cancelados do calendário do iPhone (Trabalhos). (${events.length} atendimentos na janela ativa)`
      : `${events.length} atendimentos sincronizados do calendário do iPhone (já atualizados).`) +
    (failedEvents.length > 0
      ? ` ⚠️ ${failedEvents.length} evento(s) do feed falharam ao processar e foram pulados — veja os logs do servidor.`
      : "");

  try {
    const fs = await import("fs");
    const path = await import("path");
    // Written OUTSIDE public/ — this file contains the calendar secret URL
    // and real client/appointment data, and must never be served statically.
    const statusDir = path.join(process.cwd(), ".data");
    if (!fs.existsSync(statusDir)) {
      fs.mkdirSync(statusDir, { recursive: true });
    }
    const statusFile = path.join(statusDir, "icloud-sync-status.json");
    fs.writeFileSync(
      statusFile,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          status: "SUCCESS",
          url: urlToSave,
          normalizedUrl,
          totalFound: allEvents.length,
          filteredToWindow: events.length,
          created: createdCount,
          updated: updatedCount,
          canceled: canceledCount,
          failed: failedEvents,
          message,
          sampleEvents: events.slice(0, 10).map((e) => ({
            uid: e.uid,
            summary: e.summary,
            startDate: e.startDate.toISOString(),
            endDate: e.endDate.toISOString(),
            location: e.location,
            price: e.price,
            status: e.status,
          })),
        },
        null,
        2
      )
    );
  } catch (saveErr) {
    console.warn("Não foi possível gravar .data/icloud-sync-status.json:", saveErr);
  }

  try {
    await prisma.companyProfile.update({
      where: { id: companyId },
      data: { lastICloudSyncAt: new Date() },
    });
  } catch (syncTimeErr) {
    console.warn("Não foi possível atualizar lastICloudSyncAt no perfil:", syncTimeErr);
  }

  return {
    success: true,
    message,
    totalFound: allEvents.length,
    created: createdCount,
    updated: updatedCount,
    canceled: canceledCount,
    normalizedUrl,
  };
}

let activeSyncPromise: Promise<SyncICloudResult[] | null> | null = null;
let lastSyncTimestamp = 0;

/**
 * Garante que o calendário do iCloud seja sincronizado automaticamente para
 * TODAS as empresas que têm sync configurado, respeitando um intervalo
 * mínimo de 5 minutos entre chamadas (para o lote inteiro, não por empresa)
 * para proteger contra rate limit. Chamado sem sessão/request (boot do
 * servidor via instrumentation.ts), então não há como escopar isso a "a
 * empresa do chamador" — precisa necessariamente iterar por todas.
 *
 * `activeSyncPromise`/`lastSyncTimestamp` continuam globais de propósito:
 * governam este job de boot como um todo (uma rodada por vez, para o lote),
 * não por empresa — o lock por empresa de verdade já existe em
 * claimIcloudSyncLock/releaseIcloudSyncLock e em companySyncLocks dentro de
 * syncICloudCalendarForCompany, chamado aqui uma vez por empresa.
 */
export async function ensureICloudCalendarSynced(
  force = false
): Promise<SyncICloudResult[] | null> {
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build" ||
    process.env.NEXT_BUILD === "1"
  ) {
    return null;
  }

  if (activeSyncPromise) {
    console.log("[iCloud Auto-Sync] Sincronização já em andamento, aguardando término...");
    return activeSyncPromise;
  }

  const now = Date.now();
  if (!force && now - lastSyncTimestamp < 5 * 60 * 1000) {
    return null;
  }

  activeSyncPromise = (async () => {
    try {
      console.log("[iCloud Auto-Sync] Passo 1: Localizando empresas com sync configurado...");

      // ICLOUD_CALENDAR_URL (DEFAULT_ICLOUD_URL) é um único valor global por
      // deploy, sem identidade de empresa nenhuma. Com multi-tenant real em
      // jogo, "a primeira empresa sem icloudCalendarUrl próprio" NÃO é um
      // proxy seguro para "a empresa original" — pelo contrário: a empresa
      // original (Renata) já tem icloudCalendarUrl persistido (a própria UI
      // de Settings/sync grava lá assim que configurado), então esse
      // heurístico só poderia bater, na prática, com uma empresa NOVA e
      // totalmente alheia ainda não configurada - gravando o feed pessoal do
      // iCloud de Renata (e todos os Clients/Appointments que ele importa:
      // nomes, telefones, endereços, notas) nos dados de uma empresa
      // completamente diferente. Pior que o bug original (que só tocava UMA
      // empresa, nunca semeava uma empresa alheia).
      //
      // Por isso, o env var só é usado como seed quando o banco tem
      // EXATAMENTE uma empresa no total - ou seja, só no estado legado de
      // bootstrap single-tenant (antes de existir qualquer segunda empresa).
      // A partir de 2+ empresas, o seeding via env var é pulado por completo
      // para todas elas; cada empresa já pode configurar seu próprio
      // icloudCalendarUrl via Settings, sem precisar de env var nenhuma.
      const totalCompanies = await prisma.companyProfile.count();
      const allowEnvSeed = DEFAULT_ICLOUD_URL && totalCompanies === 1;

      const companies = await prisma.companyProfile.findMany({
        where: {
          OR: [
            { icloudCalendarUrl: { not: null } },
            ...(allowEnvSeed ? [{ icloudCalendarUrl: null }] : []),
          ],
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, icloudCalendarUrl: true },
      });

      if (companies.length === 0) {
        console.log("[iCloud Auto-Sync] Nenhuma empresa com sync configurado ainda.");
        return null;
      }

      let appliedDefaultUrlOnce = false;
      const results: SyncICloudResult[] = [];

      for (const company of companies) {
        let urlToSync = company.icloudCalendarUrl;

        if (!urlToSync) {
          // Só chega aqui se allowEnvSeed é true (ver filtro acima), ou
          // seja, só quando o banco tem exatamente uma empresa - aplica no
          // máximo uma vez, pelas razões explicadas acima.
          if (appliedDefaultUrlOnce) continue;
          appliedDefaultUrlOnce = true;
          console.log(
            `[iCloud Auto-Sync] Atribuindo ICLOUD_CALENDAR_URL (bootstrap legado, única empresa no banco) à empresa ${company.id} (${company.name}).`
          );
          await prisma.companyProfile.update({
            where: { id: company.id },
            data: { icloudCalendarUrl: DEFAULT_ICLOUD_URL },
          });
          urlToSync = DEFAULT_ICLOUD_URL;
        }

        if (!urlToSync) continue;

        console.log(
          `[iCloud Auto-Sync] Sincronizando empresa ${company.id} (${company.name})...`
        );
        try {
          const result = await syncICloudCalendarForCompany(company.id, urlToSync);
          results.push(result);
          console.log(
            `[iCloud Auto-Sync] Empresa ${company.id}: concluído! ${result.totalFound} eventos encontrados, ${result.created} novos, ${result.updated} atualizados.`
          );
        } catch (err: unknown) {
          // Isolado por empresa - uma falha (URL inválida, iCloud fora do
          // ar) não pode impedir a sincronização das demais empresas do lote.
          const errMessage = err instanceof Error ? err.message : String(err);
          console.error(
            `[iCloud Auto-Sync] Erro ao sincronizar empresa ${company.id}:`,
            errMessage
          );
          // Antes isso só era escrito em .data/icloud-sync-status.json — um
          // arquivo que não sobrevive no filesystem read-only da Vercel, deixando
          // a falha completamente invisível em produção. Usa o sistema de
          // notificações (sininho) que já funciona lá, em vez de um arquivo local.
          try {
            const { NotificationService } = await import("@/services/notification-service");
            await NotificationService.create({
              companyId: company.id,
              title: "Falha na sincronização com o iCloud",
              message: `A sincronização automática do calendário falhou: ${errMessage}`,
              type: "URGENT",
            });
          } catch {}
        }
      }

      lastSyncTimestamp = Date.now();
      return results;
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}
