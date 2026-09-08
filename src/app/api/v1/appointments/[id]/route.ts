import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { AppointmentService } from "@/services/appointment-service";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/security/permissions";
import { z } from "zod";

async function getTargetCompanyId(preferredCompanyId?: string) {
  if (preferredCompanyId) return preferredCompanyId;
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

  const check = await requirePermission(req, "appointments", "update");
  if (check.response) return check.response;
  const { session } = check;

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

    const companyId = await getTargetCompanyId(session.companyId);
    const updated = await AppointmentService.completeAppointment(
      id,
      companyId,
      parsed.data.status
    );

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao atualizar agendamento." },
      { status: 400 }
    );
  }
}
