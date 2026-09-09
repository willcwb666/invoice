import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { requirePermission } from "@/lib/security/permissions";
import { prisma } from "@/lib/prisma";
import {
  syncICloudCalendarForCompany,
  validateICloudCalendarUrl,
  DEFAULT_ICLOUD_URL,
} from "@/lib/calendar/icloud";
import { ensureExampleInvoicesSeeded } from "@/lib/seed-data";

// Allow up to 60 seconds for the iCloud sync (feed can be large)
export const maxDuration = 60;


export async function GET(req: NextRequest) {
  const check = await requirePermission(req, "agenda", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    await ensureExampleInvoicesSeeded();

    const company = await prisma.companyProfile.findFirst({
      select: {
        id: true,
        icloudCalendarUrl: true,
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

    return NextResponse.json({
      configured,
      icloudCalendarUrl: company?.icloudCalendarUrl || DEFAULT_ICLOUD_URL,
      syncedCount,
      lastSyncedAt: lastSyncAppt?.updatedAt || company?.updatedAt || null,
      status: configured ? "SYNCHRONIZED" : "NOT_CONFIGURED",
      // This is the same secret proxy.ts/feed.ics/route.ts accept as a
      // bypass-auth token for the outbound webcal subscription URL — holding
      // it grants permanent, unauthenticated access to every client's name,
      // phone, address and notes via the .ics feed, with no way to revoke it
      // short of rotating WEBCAL_SECRET itself. Only ADMIN gets to see it;
      // "agenda:read" alone (FINANCIAL/OPERATOR/VIEWER) is not enough.
      webcalToken: session.role === "ADMIN" ? process.env.WEBCAL_SECRET || null : null,
    });
  } catch (error: unknown) {
    console.error("Erro na rota GET /api/v1/agenda/sync:", error);
    return NextResponse.json(
      { error: "Erro ao consultar status da sincronização." },
      { status: 500 }
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

  try {
    let body: { icloudUrl?: string; calendarUrl?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional if using stored company URL
      body = {};
    }

    let company = await prisma.companyProfile.findFirst();
    if (!company) {
      await ensureExampleInvoicesSeeded();
      company = await prisma.companyProfile.findFirst();
    }

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
