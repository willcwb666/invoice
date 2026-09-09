import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/security/permissions";
import { getTargetCompanyId } from "@/lib/company-context";
import { createCompanyAddressSchema, updateCompanyAddressSchema } from "@/lib/validations/company";

export async function POST(req: NextRequest) {
  const check = await requirePermission(req, "settings", "create");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const body = await req.json();
    const parsed = createCompanyAddressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { label, street, city, state, zipCode, isDefault } = parsed.data;

    const companyId = await getTargetCompanyId(session.companyId);

    // If marked as default, unset other defaults
    if (isDefault) {
      await prisma.companyAddress.updateMany({
        where: { companyId },
        data: { isDefault: false },
      });
    }

    const newAddress = await prisma.companyAddress.create({
      data: {
        companyId,
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
  const { session } = check;

  try {
    const body = await req.json();
    const parsed = updateCompanyAddressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { addressId, isDefault } = parsed.data;

    const companyId = await getTargetCompanyId(session.companyId);
    const target = await prisma.companyAddress.findUnique({
      where: { id: addressId },
    });

    // Checking companyId here (not just that the row exists) is what keeps
    // this IDOR-safe: without it, any authenticated caller could pass any
    // address id and have it resolved against whatever company that row
    // actually belongs to, sidestepping the caller's own company scope.
    if (!target || target.companyId !== companyId) {
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
