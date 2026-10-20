import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { AppointmentService } from "@/services/appointment-service";
import { PaymentService } from "@/services/payment-service";
import { ProfessionalService } from "@/services/professional-service";
import { NotificationService } from "@/services/notification-service";
import { requirePermission } from "@/lib/security/permissions";
import { updateAppointmentSchema } from "@/lib/validations/appointment";
import { AppointmentDeleteScope } from "@/lib/scheduling/recurrence";
import { z } from "zod";
import { getTargetCompanyId } from "@/lib/company-context";

const deleteScopeSchema = z.enum(["THIS_ONLY", "THIS_AND_FOLLOWING", "ALL_SERIES"]);

// `billable` (Não Faturável) is handled separately from the rest of the
// appointment edit fields on purpose: it's a financial flag, not content the
// iPhone calendar owns, so toggling it must never set `manuallyEdited` and
// freeze the appointment out of future iCloud syncs.
const patchSchema = updateAppointmentSchema.extend({
  billable: z.boolean().optional(),
  professionalIds: z.array(z.string()).optional(),
  cleaningCategory: z.enum(["STANDARD", "DEEP", "MOVE_IN_OUT", "CUSTOM"]).optional(),
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

    const { billable, professionalIds, cleaningCategory, ...editFields } = parsed.data;
    const companyId = await getTargetCompanyId(session.companyId);

    let updated;
    if (Object.keys(editFields).length > 0) {
      updated = await AppointmentService.updateAppointment(
        id,
        companyId,
        editFields,
        { professionalIds, cleaningCategory }
      );
    }
    if (billable !== undefined) {
      updated = await PaymentService.setBillable(id, companyId, billable);
    }
    if (professionalIds !== undefined && updated) {
      await ProfessionalService.setAppointmentProfessionals(companyId, id, professionalIds, cleaningCategory);
    }
    if (!updated && professionalIds !== undefined) {
      const list = await AppointmentService.listAppointments(companyId);
      updated = list.find((a: any) => a.id === id);
    }
    if (!updated) {
      return NextResponse.json(
        { error: "Nenhum campo válido para atualizar foi informado." },
        { status: 400 }
      );
    }

    const [enriched] = await ProfessionalService.enrichAppointments([updated], companyId);

    // Dispara notificação in-app sobre a alteração
    NotificationService.notifyAppointmentChange({
      companyId,
      action: "UPDATED",
      appointmentTitle: updated.title,
      appointmentDate: updated.date,
      clientName: (updated as any).client?.name,
      appointmentId: updated.id,
      professionalNames: enriched.professionals.map((p) => p.name),
    }).catch(() => {});

    return NextResponse.json({ data: enriched });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao atualizar agendamento." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`appts_del_${ip}`, { limit: 50, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em breve." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "appointments", "delete");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const { id } = await params;
    const companyId = await getTargetCompanyId(session.companyId);

    // Permite deleteScope via QueryParam (?deleteScope=...) ou via body se enviado
    let deleteScopeInput: string | undefined = req.nextUrl.searchParams.get("deleteScope") || undefined;

    try {
      const body = await req.json();
      if (body?.deleteScope) {
        deleteScopeInput = body.deleteScope;
      }
    } catch {
      // Body vazio é normal em DELETE
    }

    const parsedScope = deleteScopeSchema.safeParse(deleteScopeInput || "THIS_ONLY");
    if (!parsedScope.success) {
      return NextResponse.json(
        { error: "deleteScope inválido. Use THIS_ONLY, THIS_AND_FOLLOWING ou ALL_SERIES." },
        { status: 400 }
      );
    }
    const deleteScope: AppointmentDeleteScope = parsedScope.data;

    const result = await AppointmentService.deleteAppointment(id, companyId, deleteScope);

    return NextResponse.json({
      success: true,
      message: `${result.count} agendamento(s) removido(s) com sucesso.`,
      count: result.count,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao excluir agendamento." },
      { status: 400 }
    );
  }
}
