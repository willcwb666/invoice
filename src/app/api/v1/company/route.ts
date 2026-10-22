import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTargetCompanyId } from "@/lib/company-context";
import { ensureExampleInvoicesSeeded } from "@/lib/seed-data";
import { requirePermission } from "@/lib/security/permissions";
import { updateCompanySchema } from "@/lib/validations/company";

export async function GET(req: NextRequest) {
  const check = await requirePermission(req, "settings", "read");
  if (check.response) return check.response;

  try {
    await ensureExampleInvoicesSeeded();
    const companyId = await getTargetCompanyId(check.session.companyId);
    const company = await prisma.companyProfile.findUnique({
      where: { id: companyId },
      include: {
        addresses: {
          orderBy: { isDefault: "desc" },
        },
      },
    });

    return NextResponse.json({ data: company });
  } catch (error: unknown) {
    console.error("Erro ao buscar perfil da empresa:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar configurações." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const check = await requirePermission(req, "settings", "update");
  if (check.response) return check.response;

  try {
    const body = await req.json();
    const parsed = updateCompanySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const companyId = await getTargetCompanyId(check.session.companyId);
    const company = await prisma.companyProfile.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Empresa não encontrada." },
        { status: 404 }
      );
    }

    const updated = await prisma.companyProfile.update({
      where: { id: company.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.monthlyRevenueGoal !== undefined && {
          monthlyRevenueGoal: data.monthlyRevenueGoal,
        }),
        ...(data.paymentMethods !== undefined && {
          paymentMethods: data.paymentMethods,
        }),
        ...(data.terms !== undefined && { terms: data.terms }),
        ...(data.signatureUrl !== undefined && { signatureUrl: data.signatureUrl }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
        ...(data.icloudCalendarUrl !== undefined && {
          icloudCalendarUrl: data.icloudCalendarUrl,
        }),
        ...(data.icloudSyncWindowDays !== undefined && {
          icloudSyncWindowDays: data.icloudSyncWindowDays,
        }),
        ...(data.abandonedRecoveryEnabled !== undefined && {
          abandonedRecoveryEnabled: data.abandonedRecoveryEnabled,
        }),
        ...(data.abandonedRecoveryMinutes !== undefined && {
          abandonedRecoveryMinutes: data.abandonedRecoveryMinutes,
        }),
        ...(data.abandonedRecoveryDiscount !== undefined && {
          abandonedRecoveryDiscount: data.abandonedRecoveryDiscount,
        }),
        ...(data.abandonedRecoveryDiscountType !== undefined && {
          abandonedRecoveryDiscountType: data.abandonedRecoveryDiscountType,
        }),
        ...(data.abandonedRecoverySubject !== undefined && {
          abandonedRecoverySubject: data.abandonedRecoverySubject,
        }),
        ...(data.abandonedRecoveryBody !== undefined && {
          abandonedRecoveryBody: data.abandonedRecoveryBody,
        }),
        ...(data.workDayStartHour !== undefined && {
          workDayStartHour: data.workDayStartHour,
        }),
        ...(data.workDayEndHour !== undefined && {
          workDayEndHour: data.workDayEndHour,
        }),
        ...(data.workDays !== undefined && {
          workDays: data.workDays,
        }),
        ...(data.travelBufferMinutes !== undefined && {
          travelBufferMinutes: data.travelBufferMinutes,
        }),
        ...(data.defaultStandardDurationMinutes !== undefined && {
          defaultStandardDurationMinutes: data.defaultStandardDurationMinutes,
        }),
        ...(data.defaultDeepDurationMinutes !== undefined && {
          defaultDeepDurationMinutes: data.defaultDeepDurationMinutes,
        }),
        ...(data.recurrenceHorizonMonths !== undefined && {
          recurrenceHorizonMonths: data.recurrenceHorizonMonths,
        }),
      },
      include: {
        addresses: {
          orderBy: { isDefault: "desc" },
        },
      },
    });

    if (data.recurrenceHorizonMonths !== undefined) {
      const { AppointmentService } = await import("@/services/appointment-service");
      await AppointmentService.ensureRecurrenceHorizon(company.id, true);
    }

    return NextResponse.json({ data: updated, message: "Configurações salvas com sucesso!" });
  } catch (error: unknown) {
    console.error("Erro ao atualizar configurações:", error);
    return NextResponse.json(
      { error: "Erro ao salvar alterações da empresa." },
      { status: 500 }
    );
  }
}
