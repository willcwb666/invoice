import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// The real calendar subscription URL is a bearer secret — anyone holding it
// can read the owner's private iCloud calendar. It must come from the
// environment, never be hardcoded in source (which may end up in a public
// repo or build artifact).
export const DEFAULT_ICLOUD_URL = process.env.ICLOUD_CALENDAR_URL || "";

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

  // YYYYMMDD (All-Day)
  if (/^\d{8}$/.test(clean)) {
    const y = parseInt(clean.slice(0, 4), 10);
    const m = parseInt(clean.slice(4, 6), 10) - 1;
    const d = parseInt(clean.slice(6, 8), 10);
    return { date: new Date(y, m, d, 8, 0, 0), allDay: true };
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

  // YYYYMMDDTHHMMSS (Floating / Local)
  if (/^\d{8}T\d{6}$/i.test(clean)) {
    const y = parseInt(clean.slice(0, 4), 10);
    const m = parseInt(clean.slice(4, 6), 10) - 1;
    const d = parseInt(clean.slice(6, 8), 10);
    const h = parseInt(clean.slice(9, 11), 10);
    const min = parseInt(clean.slice(11, 13), 10);
    const s = parseInt(clean.slice(13, 15), 10);
    return { date: new Date(y, m, d, h, min, s), allDay: false };
  }

  // Fallback
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return { date: parsed, allDay: false };
  }

  return { date: new Date(), allDay: false };
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

/**
 * Faz o parsing de um arquivo de texto iCalendar (.ics) e retorna os eventos estruturados.
 */
export function parseIcsEvents(icsContent: string): ParsedIcsEvent[] {
  // Desdobramento de linhas (RFC 5545 section 3.1)
  const unfolded = icsContent
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .replace(/\r[ \t]/g, "");

  const lines = unfolded.split(/\r\n|\n|\r/);
  const events: ParsedIcsEvent[] = [];

  let inEvent = false;
  let currentEventLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      currentEventLines = [];
    } else if (trimmed === "END:VEVENT") {
      if (inEvent) {
        const parsed = parseSingleVEvent(currentEventLines);
        if (parsed) {
          events.push(parsed);
        }
      }
      inEvent = false;
      currentEventLines = [];
    } else if (inEvent) {
      currentEventLines.push(line);
    }
  }

  return events;
}

function parseSingleVEvent(lines: string[]): ParsedIcsEvent | null {
  let uid = "";
  let summary = "";
  let description = "";
  let location = "";
  let dtStartStr = "";
  let dtEndStr = "";
  let statusRaw = "";

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
    }
  }

  if (!dtStartStr) {
    return null;
  }

  const { date: startDate, allDay } = parseIcsDate(dtStartStr);

  let endDate: Date;
  if (dtEndStr) {
    endDate = parseIcsDate(dtEndStr).date;
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
    uid || `event-${startDate.getTime()}-${encodeURIComponent(summary.slice(0, 20))}`;

  let status: "SCHEDULED" | "CANCELLED" | "COMPLETED" = "SCHEDULED";
  if (statusRaw === "CANCELLED") {
    status = "CANCELLED";
  }

  const extractedPrice =
    extractPriceFromText(description) || extractPriceFromText(summary) || undefined;

  return {
    uid: eventUid,
    summary: summary || "Atendimento Calendário iPhone",
    description: description || undefined,
    location: location || undefined,
    startDate,
    endDate,
    allDay,
    status,
    price: extractedPrice,
  };
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
  await prisma.companyProfile.update({
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

  // 4. Filter to a practical window: last 2 years up to 2 years ahead
  //    This prevents processing 1000+ old historical events on every sync.
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setFullYear(windowStart.getFullYear() - 2);
  const windowEnd = new Date(now);
  windowEnd.setFullYear(windowEnd.getFullYear() + 2);

  const events = allEvents.filter(
    (e) => e.startDate >= windowStart && e.startDate <= windowEnd
  );

  // 5. Load existing clients in ONE query
  const existingClients = await prisma.client.findMany({
    where: { companyId },
  });

  // 6. Load existing ICLOUD_SYNC appointments in ONE query (for deduplication)
  const existingAppts = await prisma.appointment.findMany({
    where: { companyId, origin: "ICLOUD_SYNC" },
    select: {
      id: true,
      externalEventId: true,
      title: true,
      startTime: true,
      status: true,
      price: true,
      clientId: true,
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

    // --- Price ---
    let defaultPrice = 150.0;
    if (/half|meio/i.test(summaryLower)) defaultPrice = 50.0;
    else if (/office/i.test(summaryLower)) defaultPrice = 130.0;
    else if (/house|casa/i.test(summaryLower)) defaultPrice = 180.0;
    else if (/move-out|move out|deep/i.test(summaryLower)) defaultPrice = 400.0;

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
      : new Prisma.Decimal(defaultPrice);

    if (existing) {
      // Only update if status is not manually-overridden COMPLETED
      if (existing.status !== "COMPLETED" || apptStatus !== "SCHEDULED") {
        await prisma.appointment.update({
          where: { id: existing.id },
          data: {
            title: event.summary,
            clientId: clientId || existing.clientId,
            date: event.startDate,
            startTime: event.startDate,
            endTime: event.endDate,
            location: event.location || undefined,
            notes: event.description || undefined,
            price: calculatedPrice,
            status: apptStatus,
            origin: "ICLOUD_SYNC",
            externalEventId: event.uid,
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
        },
      });
      createdCount++;
    }
  }

  const message =
    createdCount > 0 || updatedCount > 0
      ? `${createdCount} novos atendimentos importados e ${updatedCount} atualizados do iPhone da esposa. (${allEvents.length} eventos totais no feed, mostrando últimos 4 anos)`
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

// Auto-executa a sincronização do calendário no startup do servidor Node.js
if (typeof window === "undefined") {
  setTimeout(() => {
    ensureICloudCalendarSynced(true).catch((err) => {
      console.error("[iCloud Auto-Sync] Erro no bootstrap:", err);
    });
  }, 1000);
}
