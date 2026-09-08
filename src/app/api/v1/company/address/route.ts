import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/security/permissions";

export async function POST(req: NextRequest) {
  const check = await requirePermission(req, "settings", "create");
  if (check.response) return check.response;

  try {
    const body = await req.json();
    const company = await prisma.companyProfile.findFirst();

    if (!company) {
      return NextResponse.json(
        { error: "Perfil da empresa não encontrado." },
        { status: 404 }
      );
    }

    const { label, street, city, state = "CO", zipCode, isDefault = false } = body;

    if (!street || !city || !zipCode) {
      return NextResponse.json(
        { error: "Rua, cidade e CEP são obrigatórios." },
        { status: 400 }
      );
    }

    // If marked as default, unset other defaults
    if (isDefault) {
      await prisma.companyAddress.updateMany({
        where: { companyId: company.id },
        data: { isDefault: false },
      });
    }

    const newAddress = await prisma.companyAddress.create({
      data: {
        companyId: company.id,
        label: label || `${city} (Novo)`,
        street,
        city,
        state,
        zipCode,
        isDefault,
      },
    });

    return NextResponse.json({
      data: newAddress,
      message: "Novo endereço cadastrado com sucesso!",
    });
  } catch (error: unknown) {
    console.error("Erro ao cadastrar novo endereço:", error);
    return NextResponse.json(
      { error: "Erro ao salvar novo endereço." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const check = await requirePermission(req, "settings", "update");
  if (check.response) return check.response;

  try {
    const body = await req.json();
    const { addressId, isDefault } = body;

    if (!addressId) {
      return NextResponse.json(
        { error: "ID do endereço é obrigatório." },
        { status: 400 }
      );
    }

    const target = await prisma.companyAddress.findUnique({
      where: { id: addressId },
    });

    if (!target) {
      return NextResponse.json(
        { error: "Endereço não encontrado." },
        { status: 404 }
      );
    }

    if (isDefault) {
      // Unset others
      await prisma.companyAddress.updateMany({
        where: { companyId: target.companyId },
        data: { isDefault: false },
      });

      const updated = await prisma.companyAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      });

      return NextResponse.json({
        data: updated,
        message: "Endereço definido como padrão vigente!",
      });
    }

    return NextResponse.json({ message: "Nenhuma alteração realizada." });
  } catch (error: unknown) {
    console.error("Erro ao atualizar endereço padrão:", error);
    return NextResponse.json(
      { error: "Erro ao alterar endereço padrão." },
      { status: 500 }
    );
  }
}
