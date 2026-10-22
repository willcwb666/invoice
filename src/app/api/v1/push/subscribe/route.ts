import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/security/auth";
import { getTargetCompanyId } from "@/lib/company-context";
import { prisma } from "@/lib/prisma";
import { PushService } from "@/services/push-service";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const companyId = await getTargetCompanyId(user.companyId);
    const body = await req.json();

    const { endpoint, keys } = body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "Dados de subscrição inválidos (endpoint, p256dh e auth são obrigatórios)." },
        { status: 400 }
      );
    }

    let professionalId = body.professionalId;
    if (!professionalId && user.email) {
      const prof = await prisma.professional.findFirst({
        where: { companyId, email: user.email },
        select: { id: true },
      });
      if (prof) {
        professionalId = prof.id;
      }
    }

    const subscription = await PushService.saveSubscription({
      companyId,
      userId: user.sub,
      professionalId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: subscription.id,
        endpoint: subscription.endpoint,
      },
    });
  } catch (error: any) {
    console.error("[API push/subscribe] Erro ao salvar inscrição:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno ao salvar inscrição de push." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const companyId = await getTargetCompanyId(user.companyId);
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint obrigatório." }, { status: 400 });
    }

    await PushService.removeSubscription(endpoint, companyId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API push/subscribe] Erro ao remover inscrição:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno ao remover inscrição." },
      { status: 500 }
    );
  }
}
