import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/security/permissions";
import { getTargetCompanyId } from "@/lib/company-context";
import { AppointmentService } from "@/services/appointment-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const check = await requirePermission(req, "appointments", "read");
    if (check.response) return check.response;

    const companyId = await getTargetCompanyId(check.session.companyId);
    const body = await req.json();

    const { startTime, endTime, professionalIds, excludeAppointmentId } = body;

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: "Informe startTime e endTime para checar conflitos." },
        { status: 400 }
      );
    }

    const result = await AppointmentService.checkSchedulingConflict({
      companyId,
      startTime,
      endTime,
      professionalIds,
      excludeAppointmentId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao verificar conflito de agendamentos." },
      { status: 500 }
    );
  }
}
