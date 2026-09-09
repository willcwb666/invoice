import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { AppointmentService } from "@/services/appointment-service";
import { PaymentService } from "@/services/payment-service";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/security/permissions";
import { updateAppointmentSchema } from "@/lib/validations/appointment";
import { z } from "zod";

async function getTargetCompanyId(preferredCompanyId?: string) {
  if (preferredCompanyId) return preferredCompanyId;
  const company = await prisma.companyProfile.findFirst();
  return company?.id || "";
}

// `billable` (Não Faturável) is handled separately from the rest of the
// appointment edit fields on purpose: it's a financial flag, not content the
// iPhone calendar owns, so toggling it must never set `manuallyEdited` and
// freeze the appointment out of future iCloud syncs.
const patchSchema = updateAppointmentSchema.extend({
  billable: z.boolean().optional(),
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

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados inválidos para atualização do agendamento.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { billable, ...editFields } = parsed.data;
    const companyId = await getTargetCompanyId(session.companyId);

    let updated;
    if (Object.keys(editFields).length > 0) {
      updated = await AppointmentService.updateAppointment(id, companyId, editFields);
    }
    if (billable !== undefined) {
      updated = await PaymentService.setBillable(id, companyId, billable);
    }
    if (!updated) {
      return NextResponse.json(
        { error: "Nenhum campo válido para atualizar foi informado." },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao atualizar agendamento." },
      { status: 400 }
    );
  }
}
