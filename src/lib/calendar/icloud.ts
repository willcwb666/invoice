import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// The real calendar subscription URL is a bearer secret — anyone holding it
// can read the owner's private iCloud calendar. It must come from the
// environment, never be hardcoded in source (which may end up in a public
// repo or build artifact).
export const DEFAULT_ICLOUD_URL = process.env.ICLOUD_CALENDAR_URL || "";

// O negócio opera só em Evans/Greeley, Colorado - eventos "floating" do ICS
// (sem Z e sem TZID, o formato mais comum vindo do Calendário do iPhone) são
// sempre a hora de parede desse fuso, nunca a hora local do processo Node
// que roda o sync (que na Vercel é UTC, e pode ser qualquer coisa em dev).
const BUSINESS_TIMEZONE = "America/Denver";

/**
 * Converte um horário de parede (ano/mês/dia/hora/min/seg) interpretado no
 * fuso `timeZone` para o instante UTC correspondente - já considerando
 * horário de verão. Mesmo truque usado por bibliotecas como date-fns-tz:
 * assume os números como UTC, vê que hora isso aparenta no fuso alvo, e
 * corrige pela diferença (uma passada é suficiente, exceto no exato instante
 * de troca de DST, um caso raro e sem consequência aqui).
 */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
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

    // Hostname check: ensure it's an iCloud domain or valid calendar host
    const hostname = parsed.hostname.toLowerCase();
    const isICloud = hostname.endsWith("icloud.com") || hostname.includes("caldav");

    if (!isICloud && !parsed.pathname.includes(".ics")) {
      // Still allow if it contains valid calendar path or params, but guide user if completely off
      // We accept general valid calendar urls too
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
        const res = await fetch(currentUrl, {
          method: "GET",
          headers: {
            "User-Agent": ua,
            Accept: "text/calendar, text/plain, */*",
            "Cache-Control": "no-cache, no-store",
            Pragma: "no-cache",
          },
          redirect: "manual",
        });

        // Handle 301, 302, 307, 308 redirects manually to convert webcal:// to https://
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
              // keep as is
            }
          }

          currentUrl = nextUrl;
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

  // Fallback: standard fetch with redirect: follow
  try {
    const followRes = await fetch(baseNormalized, {
      method: "GET",
      headers: {
        "User-Agent": userAgents[0],
        Accept: "text/calendar, text/plain, */*",
      },
      redirect: "follow",
    });

    if (followRes.ok) {
      const text = await followRes.text();
      if (text.includes("BEGIN:VCALENDAR")) {
        return text;
      }
    }
  } catch (followErr: unknown) {
    lastError = followErr;
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

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
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

  if (rule.freq === "WEEKLY" && rule.byDay) {
    const sortedDays = [...rule.byDay].sort((a, b) => a - b);
    let weekStart = addDays(originalStart, -originalStart.getUTCDay()); // domingo daquela semana
    let seriesIndex = 0;
    let weeksIterated = 0;

    while (weeksIterated < RECURRENCE_EXPANSION_CAP && results.length < RECURRENCE_EXPANSION_CAP) {
      weeksIterated++;
      for (const dayIdx of sortedDays) {
        const occ = new Date(weekStart);
        occ.setUTCDate(occ.getUTCDate() + dayIdx);
        occ.setUTCHours(
          originalStart.getUTCHours(),
          originalStart.getUTCMinutes(),
          originalStart.getUTCSeconds(),
          0
        );
        if (occ.getTime() < originalStart.getTime()) continue;
        const keepGoing = pushIfValid(occ, seriesIndex);
        seriesIndex++;
        if (!keepGoing) return results;
      }
      weekStart = addDays(weekStart, 7 * rule.interval);
      if (weekStart.getTime() > horizon.getTime()) break;
    }
    return results;
  }

  let occ = new Date(originalStart);
  let seriesIndex = 0;
  let iterations = 0;
  while (iterations < RECURRENCE_EXPANSION_CAP) {
    iterations++;
    const keepGoing = pushIfValid(occ, seriesIndex);
    seriesIndex++;
    if (!keepGoing) break;

    switch (rule.freq) {
      case "DAILY":
        occ = addDays(occ, rule.interval);
        break;
      case "WEEKLY":
        occ = addDays(occ, 7 * rule.interval);
        break;
      case "MONTHLY":
        occ = addMonths(occ, rule.interval);
        break;
      case "YEARLY":
        occ = addMonths(occ, 12 * rule.interval);
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

  const extractedPrice =
    extractPriceFromText(raw.description) || extractPriceFromText(raw.summary) || undefined;

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

/**
 * Executa a sincronização completa do calendário do iCloud para uma empresa:
 * 1. Valida e normaliza o link
 * 2. Atualiza a URL no CompanyProfile (armazenando a URL original webcal://)
 * 3. Faz o download do feed .ics
 * 4. Faz o parse dos eventos
 * 5. Mapeia/cria clientes e atualiza/insere agendamentos (Appointments)
 */
export async function syncICloudCalendarForCompany(
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
      normalizedUrl,
    };
  }

  // 4. Filter to a forward-looking window only: the agenda is never edited
  //    for days already past, so there is no need to re-process history —
  //    only from today through `icloudSyncWindowDays` days ahead (configurable
  //    in Settings, default 60 / ~2 months). This keeps every sync fast
  //    regardless of how many past events pile up in the feed over time.
  const now = new Date();
  const windowStart = new Date(now);
  // UTC, não hora local do processo - ver parseIcsDate/addDays acima.
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + (company.icloudSyncWindowDays || 60));

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
    where: { companyId, origin: "ICLOUD_SYNC", date: { gte: windowStart } },
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
  const clientCache = new Map(existingClients.map((c) => [c.name.toLowerCase(), c]));

  for (const event of events) {
    const summaryLower = event.summary.toLowerCase().trim();
    const locationLower = (event.location || "").toLowerCase().trim();

    // --- Client matching ---
    let clientId: string | null = null;

    // Match by full name
    const matchedByName = existingClients.find((c) => {
      const cName = c.name.toLowerCase().trim();
      return summaryLower.includes(cName) || (cName.length > 3 && cName.includes(summaryLower));
    });
    if (matchedByName) {
      clientId = matchedByName.id;
    } else {
      // Match by first name
      const matchedByFirstName = existingClients.find((c) => {
        const firstName = c.name.split(/\s+/)[0].toLowerCase().trim();
        return firstName.length >= 3 && summaryLower.includes(firstName);
      });
      if (matchedByFirstName) {
        clientId = matchedByFirstName.id;
      } else if (locationLower) {
        const matchedByAddress = existingClients.find((c) => {
          if (!c.address) return false;
          const cAddr = c.address.toLowerCase().trim();
          return locationLower.includes(cAddr) || (cAddr.length > 5 && cAddr.includes(locationLower));
        });
        if (matchedByAddress) {
          clientId = matchedByAddress.id;
        }
      }
    }

    // Auto-create client if none matched
    if (!clientId) {
      let derivedName = event.summary
        .replace(/^(limpeza|cleaning|atendimento|serviço|faxina)\s*[-:]?\s*/i, "")
        .replace(/\s*[-:]?\s*\$?\d+(?:[.,]\d{2})?.*$/, "")
        .trim();

      if (!derivedName || derivedName.length < 2) {
        derivedName = event.summary.trim() || "Cliente iPhone iCloud";
      }
      if (derivedName.length > 100) derivedName = derivedName.substring(0, 100);

      const cacheKey = derivedName.toLowerCase();
      let autoClient = clientCache.get(cacheKey);

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

    const calculatedPrice = event.price !== undefined
      ? new Prisma.Decimal(event.price)
      : existing
      ? existing.price
      : new Prisma.Decimal(matchedServicesSum > 0 ? matchedServicesSum : 150.0);

    // Snapshot price per matched service: if there's exactly one match and we
    // parsed a real $ amount from the text, that's the negotiated price for
    // that service; otherwise each service keeps its own catalog basePrice.
    const appointmentServicesData = matchedServices.map((s) => ({
      serviceId: s.id,
      price:
        matchedServices.length === 1 && event.price !== undefined
          ? new Prisma.Decimal(event.price)
          : s.basePrice,
    }));
    const matchedServiceIds = matchedServices.map((s) => s.id).sort();

    if (existing) {
      // Manually-completed appointments are never reverted back to SCHEDULED
      // by a stale calendar entry.
      const isProtectedCompletion =
        existing.status === "COMPLETED" && apptStatus === "SCHEDULED";

      // Once a user edits this appointment by hand in the app (services,
      // price, time, etc.), the iPhone calendar is no longer the source of
      // truth for it — never let a later sync silently revert that edit.
      if (existing.manuallyEdited) {
        continue;
      }

      const resolvedClientId = clientId || existing.clientId;
      const resolvedLocation = event.location || null;
      const resolvedNotes = event.description || null;
      const existingServiceIds = existing.services.map((s) => s.serviceId).sort();
      const sameServices =
        existingServiceIds.length === matchedServiceIds.length &&
        existingServiceIds.every((id, i) => id === matchedServiceIds[i]);

      const unchanged =
        existing.title === event.summary &&
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
            title: event.summary,
            clientId: resolvedClientId,
            date: event.startDate,
            startTime: event.startDate,
            endTime: event.endDate,
            location: event.location || undefined,
            notes: event.description || undefined,
            price: calculatedPrice,
            status: apptStatus,
            origin: "ICLOUD_SYNC",
            externalEventId: event.uid,
            services: {
              deleteMany: {},
              ...(appointmentServicesData.length ? { create: appointmentServicesData } : {}),
            },
          },
        });
        updatedCount++;
      }
    } else {
      await prisma.appointment.create({
        data: {
          companyId,
          clientId: clientId!,
          title: event.summary,
          date: event.startDate,
          startTime: event.startDate,
          endTime: event.endDate,
          location: event.location || null,
          price: calculatedPrice,
          status: apptStatus,
          origin: "ICLOUD_SYNC",
          externalEventId: event.uid,
          notes: event.description || null,
          ...(appointmentServicesData.length
            ? { services: { create: appointmentServicesData } }
            : {}),
        },
      });
      createdCount++;
    }
  }

  const message =
    createdCount > 0 || updatedCount > 0
      ? `${createdCount} novos atendimentos importados e ${updatedCount} atualizados do iPhone da esposa. (${events.length} de ${allEvents.length} eventos no feed, janela de ${company.icloudSyncWindowDays || 60} dias a partir de hoje)`
      : `${events.length} atendimentos sincronizados do iPhone (já atualizados).`;

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

  return {
    success: true,
    message,
    totalFound: allEvents.length,
    created: createdCount,
    updated: updatedCount,
    normalizedUrl,
  };
}

let activeSyncPromise: Promise<SyncICloudResult | null> | null = null;
let lastSyncTimestamp = 0;

/**
 * Garante que o calendário do iCloud seja sincronizado automaticamente para a empresa
 * respeitando um intervalo mínimo de 5 minutos entre chamadas para proteger contra rate limit.
 */
export async function ensureICloudCalendarSynced(
  force = false
): Promise<SyncICloudResult | null> {
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
      console.log("[iCloud Auto-Sync] Passo 1: Localizando perfil da empresa...");
      let company = await prisma.companyProfile.findFirst();
      if (!company) {
        console.log("[iCloud Auto-Sync] Nenhum perfil encontrado ainda.");
        return null;
      }

      console.log("[iCloud Auto-Sync] Passo 2: Empresa localizada:", company.id, company.name);

      // Only seed/overwrite from ICLOUD_CALENDAR_URL when it's actually
      // configured — an unset env var must never blank out a URL the user
      // already saved via the sync UI.
      if (DEFAULT_ICLOUD_URL && company.icloudCalendarUrl !== DEFAULT_ICLOUD_URL) {
        console.log("[iCloud Auto-Sync] Atualizando URL a partir de ICLOUD_CALENDAR_URL.");
        company = await prisma.companyProfile.update({
          where: { id: company.id },
          data: { icloudCalendarUrl: DEFAULT_ICLOUD_URL },
        });
      }

      const urlToSync = company.icloudCalendarUrl || DEFAULT_ICLOUD_URL;
      if (!urlToSync) {
        console.log("[iCloud Auto-Sync] Nenhuma URL de calendário configurada. Pulando sincronização.");
        return null;
      }

      console.log("[iCloud Auto-Sync] Passo 3: Executando sincronização do feed iCloud...");
      const result = await syncICloudCalendarForCompany(company.id, urlToSync);
      lastSyncTimestamp = Date.now();
      console.log(
        `[iCloud Auto-Sync] Passo 4: Concluído com sucesso! ${result.totalFound} eventos encontrados, ${result.created} novos, ${result.updated} atualizados.`
      );
      return result;
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? err.stack : undefined;
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
              status: "ERROR",
              error: errMessage,
              stack: errStack,
            },
            null,
            2
          )
        );
      } catch {}
      console.error("[iCloud Auto-Sync] Erro durante a sincronização:", errMessage);
      return null;
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}
