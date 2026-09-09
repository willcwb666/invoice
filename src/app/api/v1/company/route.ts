import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureExampleInvoicesSeeded } from "@/lib/seed-data";
import { requirePermission } from "@/lib/security/permissions";
import { updateCompanySchema } from "@/lib/validations/company";

export async function GET(req: NextRequest) {
  const check = await requirePermission(req, "settings", "read");
  if (check.response) return check.response;

  try {
    await ensureExampleInvoicesSeeded();
    const company = await prisma.companyProfile.findFirst({
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

    let company = await prisma.companyProfile.findFirst();

    if (!company) {
      await ensureExampleInvoicesSeeded();
      company = await prisma.companyProfile.findFirst();
    }

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
      },
      include: {
        addresses: {
          orderBy: { isDefault: "desc" },
        },
      },
    });

    return NextResponse.json({ data: updated, message: "Configurações salvas com sucesso!" });
  } catch (error: unknown) {
    console.error("Erro ao atualizar configurações:", error);
    return NextResponse.json(
      { error: "Erro ao salvar alterações da empresa." },
      { status: 500 }
    );
  }
}
