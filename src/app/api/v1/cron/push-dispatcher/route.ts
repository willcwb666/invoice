import { NextRequest, NextResponse } from "next/server";
import { DepartureReminderService } from "@/services/departure-reminder-service";
import { MorningBriefService } from "@/services/morning-brief-service";
import { getSessionUser } from "@/lib/security/auth";

const DEFAULT_CRON_KEY = "rm_cron_secret_e8a209b17c91f0449a5b3";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET || DEFAULT_CRON_KEY;
  const authHeader = req.headers.get("authorization");
  const xSecret = req.headers.get("x-cron-secret");
  const xCronKey = req.headers.get("x-cron-key");
  const isVercelCron = Boolean(req.headers.get("x-vercel-cron"));

  // Vercel cron oficial
  if (isVercelCron) {
    return true;
  }

  // Token de autorização ou chave cron
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

  // Permite acesso se for um usuário autenticado no app (ex: heartbeat do navegador ou teste)
  const sessionUser = await getSessionUser(req);
  if (sessionUser) {
    return true;
  }

  // Em ambiente local
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const forceMorning = searchParams.get("morningBrief") === "true";
    const now = new Date();

    // 1. Sincroniza e pré-agenda alertas de saída (30 min e 10 min) para TODOS os atendimentos de hoje
    const syncResult = await DepartureReminderService.syncDailyReminders();

    // 2. Despacha todos os ScheduledPushes pendentes que já chegaram no horário de envio
    const scheduledDispatched = await DepartureReminderService.dispatchPendingReminders();

    // 3. Checa janela matinal das 6:00 da manhã no fuso Mountain Time (America/Denver)
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Denver",
      hour: "numeric",
      hour12: false,
    });
    const mountainHour = parseInt(formatter.format(now), 10);

    let morningResult = null;
    if (forceMorning || mountainHour === 6) {
      morningResult = await MorningBriefService.dispatchDailyBriefing();
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      mountainHour,
      syncResult,
      dispatchedScheduledPushes: scheduledDispatched,
      morningBriefing: morningResult,
    });
  } catch (error: any) {
    console.error("[PushDispatcher] Erro de execução:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno no despachante de push." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
