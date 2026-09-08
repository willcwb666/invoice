import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { getSessionUser } from "@/lib/security/auth";
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
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

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
      // Only ever exposed to an authenticated session (see check above) —
      // this is the same secret proxy.ts/feed.ics/route.ts accept as a
      // bypass-auth token for the outbound webcal subscription URL, so it
      // must never be hardcoded in client-side source.
      webcalToken: process.env.WEBCAL_SECRET || null,
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

  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

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
