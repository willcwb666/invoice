import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/security/auth";
import {
  SYSTEM_SCREENS,
  SYSTEM_ACTIONS,
  ROLE_DEFINITIONS,
  DEFAULT_ROLE_PERMISSIONS,
  RolePermissionsMatrix,
} from "@/lib/security/rbac";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const company = await prisma.companyProfile.findFirst({
    select: { rolePermissions: true },
  });
  const matrix =
    (company?.rolePermissions as unknown as RolePermissionsMatrix | null) ||
    DEFAULT_ROLE_PERMISSIONS;

  return NextResponse.json({
    success: true,
    data: {
      screens: SYSTEM_SCREENS,
      actions: SYSTEM_ACTIONS,
      roles: ROLE_DEFINITIONS,
      matrix,
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Apenas administradores podem modificar a matriz de permissões das funções." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const newMatrix = body.matrix as RolePermissionsMatrix;

    if (!newMatrix || typeof newMatrix !== "object") {
      return NextResponse.json(
        { error: "Estrutura de matriz de permissões inválida." },
        { status: 400 }
      );
    }

    // Keep ADMIN fully enabled for security
    newMatrix.ADMIN = DEFAULT_ROLE_PERMISSIONS.ADMIN;

    let company = await prisma.companyProfile.findFirst();
    if (!company) {
      return NextResponse.json(
        { error: "Perfil da empresa não encontrado." },
        { status: 404 }
      );
    }
    company = await prisma.companyProfile.update({
      where: { id: company.id },
      data: { rolePermissions: newMatrix as unknown as Prisma.InputJsonValue },
    });

    // Log audit
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.sub,
          action: "UPDATE",
          entity: "RolePermissionsMatrix",
          details: JSON.stringify({
            updatedBy: session.email,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    } catch (auditErr) {
      console.warn("Falha ao registrar audit log de matriz:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Matriz de permissões atualizada com sucesso.",
      data: {
        screens: SYSTEM_SCREENS,
        actions: SYSTEM_ACTIONS,
        roles: ROLE_DEFINITIONS,
        matrix: company.rolePermissions,
      },
    });
  } catch (error: unknown) {
    console.error("Erro ao atualizar matriz de permissões:", error);
    return NextResponse.json(
      { error: "Erro interno ao salvar permissões." },
      { status: 500 }
    );
  }
}
