import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/services/notification-service";
import { getSessionUser } from "@/lib/security/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    const company = await prisma.companyProfile.findFirst({ select: { id: true } });
    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = Number(searchParams.get("limit") || 20);

    const result = await NotificationService.list({
      companyId: company.id,
      userId: user?.sub,
      unreadOnly,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Erro na API de notificações:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno ao carregar notificações" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    const company = await prisma.companyProfile.findFirst({ select: { id: true } });
    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { id, markAll } = body;

    if (markAll) {
      await NotificationService.markAllAsRead(company.id, user?.sub);
      return NextResponse.json({ success: true, message: "Todas marcadas como lidas" });
    }

    if (id) {
      await NotificationService.markAsRead(id);
      return NextResponse.json({ success: true, message: "Notificação marcada como lida" });
    }

    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  } catch (error: any) {
    console.error("Erro ao atualizar notificação:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar notificação" },
      { status: 500 }
    );
  }
}
