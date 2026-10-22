import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PushService } from "@/services/push-service";
import { MorningBriefService } from "@/services/morning-brief-service";
import { getSessionUser } from "@/lib/security/auth";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const xSecret = req.headers.get("x-cron-secret");

  if (cronSecret) {
    if (authHeader === `Bearer ${cronSecret}` || xSecret === cronSecret) {
      return true;
    }
  }

  // Permite acesso se for um usuário autenticado da aplicação (ex: teste manual no dashboard)
  const sessionUser = await getSessionUser(req);
  if (sessionUser && sessionUser.role === "ADMIN") {
    return true;
  }

  // Em ambiente de desenvolvimento local, permite sem autenticação rígida
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

    // 1. Processa ScheduledPushes pendentes (ex: alertas de saída dos 30 minutos)
    const pendingPushes = await prisma.scheduledPush.findMany({
      where: {
        scheduledFor: { lte: now },
        sent: false,
      },
      take: 50,
      orderBy: { scheduledFor: "asc" },
    });

    let scheduledDispatched = 0;

    for (const item of pendingPushes) {
      try {
        if (item.professionalId) {
          await PushService.sendToProfessional(item.companyId, item.professionalId, {
            title: item.title,
            body: item.body,
            tag: `scheduled-${item.id}`,
            data: {
              url: item.url || "/agenda",
              type: item.type,
              appointmentId: item.appointmentId || undefined,
            },
          });
        } else {
          await PushService.sendToCompany(item.companyId, {
            title: item.title,
            body: item.body,
            tag: `scheduled-${item.id}`,
            data: {
              url: item.url || "/agenda",
              type: item.type,
              appointmentId: item.appointmentId || undefined,
            },
          });
        }

        await prisma.scheduledPush.update({
          where: { id: item.id },
          data: { sent: true, sentAt: new Date() },
        });

        scheduledDispatched++;
      } catch (err) {
        console.error(`[PushDispatcher] Erro ao despachar push ${item.id}:`, err);
      }
    }

    // 2. Checa se é a janela das 6:00 da manhã no fuso Mountain Time (America/Denver)
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
