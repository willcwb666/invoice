import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { requirePermission } from "@/lib/security/permissions";
import { getTargetCompanyId } from "@/lib/company-context";
import { DEFAULT_ADMIN_EMAIL } from "@/lib/security/auth";
import { prisma } from "@/lib/prisma";
import {
  syncICloudCalendarForCompany,
  validateICloudCalendarUrl,
  DEFAULT_ICLOUD_URL,
} from "@/lib/calendar/icloud";
import { ensureExampleInvoicesSeeded } from "@/lib/seed-data";

// Allow up to 60 seconds for the iCloud sync (feed can be large)
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  const check = await requirePermission(req, "agenda", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    await ensureExampleInvoicesSeeded();

    const companyId = await getTargetCompanyId(session.companyId);
    const company = await prisma.companyProfile.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        icloudCalendarUrl: true,
        lastICloudSyncAt: true,
        updatedAt: true,
      },
    });

    const syncedCount = await prisma.appointment.count({
      where: {
        companyId: company?.id,
        origin: "ICLOUD_SYNC",
      },
    });

    const lastSyncAppt = await prisma.appointment.findFirst({
      where: {
        companyId: company?.id,
        origin: "ICLOUD_SYNC",
      },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });

    const configured = Boolean(company?.icloudCalendarUrl);

    // WEBCAL_SECRET is a single global env var (see feed.ics/route.ts and
    // proxy.ts's identical isWebcalFeed check) with no per-company identity
    // at all - it cannot be scoped to "this company's token" because there
    // is no such thing yet. Handing it to ANY company's ADMIN here would let
    // that admin turn around and pull Renata's (the original/primary
    // company's) entire calendar - full client PII - via the public
    // feed.ics?token=... path, completely unrelated to their own company.
    // Stopgap until per-company secrets exist: only the primary company
    // (resolved the same way ensureAdminUser/auth.ts identifies it - by the
    // admin user registered under DEFAULT_ADMIN_EMAIL) ever gets the token
    // back here. Every other company's admin simply doesn't get the
    // calendar-app-subscription feature via this field - the already-fixed,
    // session-authenticated feed.ics branch still works fine for them
    // through a logged-in browser.
    let webcalToken: string | null = null;
    if (session.role === "ADMIN" && process.env.WEBCAL_SECRET) {
      const primaryAdmin = await prisma.user.findUnique({
        where: { email: DEFAULT_ADMIN_EMAIL.toLowerCase() },
        select: { companyId: true },
      });
      if (primaryAdmin?.companyId && primaryAdmin.companyId === companyId) {
        webcalToken = process.env.WEBCAL_SECRET;
      }
    }

    return NextResponse.json(
      {
        configured,
        icloudCalendarUrl: company?.icloudCalendarUrl || DEFAULT_ICLOUD_URL,
        syncedCount,
        lastSyncedAt: company?.lastICloudSyncAt || lastSyncAppt?.updatedAt || company?.updatedAt || null,
        status: configured ? "SYNCHRONIZED" : "NOT_CONFIGURED",
        webcalToken,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: unknown) {
    console.error("Erro na rota GET /api/v1/agenda/sync:", error);
    return NextResponse.json(
      { error: "Erro ao consultar status da sincronização." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`agenda_sync_${ip}`, { limit: 30, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas tentativas de sincronização. Aguarde 1 minuto." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "agenda", "update");
  if (check.response) return check.response;
  const { session } = check;

  try {
    let body: { icloudUrl?: string; calendarUrl?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional if using stored company URL
      body = {};
    }

    const companyId = await getTargetCompanyId(session.companyId);
    const company = await prisma.companyProfile.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Perfil da empresa não encontrado." },
        { status: 404 }
      );
    }

    // Determine the calendar URL to use: from request body or saved in company profile or default
    const rawUrl =
      body.icloudUrl ||
      body.calendarUrl ||
      company.icloudCalendarUrl ||
      DEFAULT_ICLOUD_URL;

    if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
      return NextResponse.json(
        {
          error:
            "Nenhuma URL do calendário do iPhone foi fornecida. Por favor, cole o link público gerado no app Calendário do iPhone.",
        },
        { status: 400 }
      );
    }

    // Validate and normalize
    const validation = validateICloudCalendarUrl(rawUrl);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "URL de calendário inválida." },
        { status: 400 }
      );
    }

    const result = await syncICloudCalendarForCompany(company.id, rawUrl.trim());

    // Agendamentos sincronizados do iPhone sem profissional explícito já
    // recebem os "owners" da empresa automaticamente na leitura (ver
    // ProfessionalService.enrichAppointments) — nada a persistir aqui.
    const { AppointmentService } = await import("@/services/appointment-service");
    await AppointmentService.ensureRecurrenceHorizon(company.id);

    return NextResponse.json({
      success: true,
      message: result.message,
      data: {
        totalFound: result.totalFound,
        created: result.created,
        updated: result.updated,
        canceled: result.canceled,
        normalizedUrl: result.normalizedUrl,
        savedUrl: rawUrl.trim(),
        lastSyncedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error("Erro na rota POST /api/v1/agenda/sync:", error);
    return NextResponse.json(
      {
        error:
          (error instanceof Error ? error.message : undefined) ||
          "Não foi possível sincronizar o calendário do iPhone no momento. Verifique a URL e tente novamente.",
      },
      { status: 400 }
    );
  }
}
