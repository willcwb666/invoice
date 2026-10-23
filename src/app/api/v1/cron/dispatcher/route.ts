import { NextRequest, NextResponse } from "next/server";
import { DepartureReminderService } from "@/services/departure-reminder-service";
import { MorningBriefService } from "@/services/morning-brief-service";
import { processAbandonedEstimates } from "@/services/abandoned-recovery-service";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/security/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow sufficient execution window on Vercel

const DEFAULT_CRON_KEY = "rm_cron_secret_e8a209b17c91f0449a5b3";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET || DEFAULT_CRON_KEY;
  const authHeader = req.headers.get("authorization");
  const xSecret = req.headers.get("x-cron-secret");
  const xCronKey = req.headers.get("x-cron-key");
  const isVercelCron = Boolean(req.headers.get("x-vercel-cron"));

  // 1. Vercel cron oficial
  if (isVercelCron) return true;

  // 2. Secret Bearer / Headers
  if (
    authHeader === `Bearer ${cronSecret}` ||
    authHeader === `Bearer ${DEFAULT_CRON_KEY}` ||
    xSecret === cronSecret ||
    xSecret === DEFAULT_CRON_KEY ||
    xCronKey === cronSecret ||
    xCronKey === DEFAULT_CRON_KEY
  ) {
    return true;
  }

  // 3. Usuário autenticado na aplicação (Heartbeat da interface aberta)
  const sessionUser = await getSessionUser(req);
  if (sessionUser) return true;

  // 4. Desenvolvimento local
  if (process.env.NODE_ENV === "development") return true;

  return false;
}

export async function GET(req: NextRequest) {
  return handleDispatch(req);
}

export async function POST(req: NextRequest) {
  return handleDispatch(req);
}

async function handleDispatch(req: NextRequest) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const now = new Date();

    // 1. Despacha todos os ScheduledPushes pendentes que já atingiram horário de envio
    let scheduledDispatched = 0;
    try {
      scheduledDispatched = await DepartureReminderService.dispatchPendingReminders();
    } catch (err) {
      console.error("[Dispatcher] Erro ao despachar lembretes pendentes:", err);
    }

    // 2. Sincroniza e agenda novos lembretes de saída (30 min e 10 min) para os atendimentos de hoje
    let syncResult = null;
    try {
      syncResult = await DepartureReminderService.syncDailyReminders();
    } catch (err) {
      console.error("[Dispatcher] Erro ao sincronizar lembretes diários:", err);
    }

    // 3. Processa recuperação de orçamentos abandonados para cada empresa
    const companies = await prisma.companyProfile.findMany({
      select: { id: true, name: true, abandonedRecoveryEnabled: true },
    });

    const recoveryResults: Record<string, any> = {};
    for (const comp of companies) {
      if (comp.abandonedRecoveryEnabled) {
        try {
          recoveryResults[comp.id] = await processAbandonedEstimates(comp.id);
        } catch (err) {
          console.error(`[Dispatcher] Erro na recuperação da empresa ${comp.id}:`, err);
        }
      }
    }

    // 4. Verificação da janela do briefing matinal (6h no fuso Mountain Time de Denver)
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Denver",
      hour: "numeric",
      hour12: false,
    });
    const mountainHour = parseInt(formatter.format(now), 10);
    const forceMorning = req.nextUrl.searchParams.get("morningBrief") === "true";

    let morningResult = null;
    if (forceMorning || mountainHour === 6) {
      try {
        morningResult = await MorningBriefService.dispatchDailyBriefing();
      } catch (err) {
        console.error("[Dispatcher] Erro no briefing matinal:", err);
      }
    }

    // Atualiza timestamp da última execução para registro de telemetria
    await prisma.companyProfile.updateMany({
      data: { lastCronDispatchAt: now },
    });

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      mountainHour,
      dispatchedScheduledPushes: scheduledDispatched,
      syncResult,
      recoveryResults,
      morningResult,
    });
  } catch (err: any) {
    console.error("[Dispatcher Fatal Error]:", err);
    return NextResponse.json(
      { error: "Erro interno no despachante.", details: err?.message },
      { status: 500 }
    );
  }
}
