import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureExampleInvoicesSeeded } from "@/lib/seed-data";
import { requirePermission } from "@/lib/security/permissions";

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
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.monthlyRevenueGoal !== undefined && {
          monthlyRevenueGoal: Number(body.monthlyRevenueGoal),
        }),
        ...(body.paymentMethods !== undefined && {
          paymentMethods: body.paymentMethods,
        }),
        ...(body.terms !== undefined && { terms: body.terms }),
        ...(body.signatureUrl !== undefined && { signatureUrl: body.signatureUrl }),
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
        ...(body.icloudCalendarUrl !== undefined && {
          icloudCalendarUrl: body.icloudCalendarUrl,
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
