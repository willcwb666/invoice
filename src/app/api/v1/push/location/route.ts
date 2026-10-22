import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/security/auth";
import { getTargetCompanyId } from "@/lib/company-context";
import { DepartureReminderService } from "@/services/departure-reminder-service";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const companyId = await getTargetCompanyId(user.companyId);
    const body = await req.json().catch(() => ({}));

    const result = await DepartureReminderService.processLocationUpdate({
      companyId,
      userId: user.sub,
      professionalId: body.professionalId,
      latitude: typeof body.latitude === "number" ? body.latitude : undefined,
      longitude: typeof body.longitude === "number" ? body.longitude : undefined,
      lastAppointmentId: body.lastAppointmentId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[API push/location] Erro ao processar localização:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno ao processar localização." },
      { status: 500 }
    );
  }
}
