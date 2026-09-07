import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { AppointmentService } from "@/services/appointment-service";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

async function getDefaultCompanyId() {
  const company = await prisma.companyProfile.findFirst();
  return company?.id || "";
}

const patchAppointmentSchema = z.object({
  status: z
    .enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .default("COMPLETED"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`appts_patch_${ip}`, { limit: 50, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em breve." },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = patchAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Status do agendamento inválido.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const companyId = await getDefaultCompanyId();
    const updated = await AppointmentService.completeAppointment(
      id,
      companyId,
      parsed.data.status
    );

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao atualizar agendamento." },
      { status: 400 }
    );
  }
}
