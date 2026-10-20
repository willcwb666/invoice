import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/security/auth";
import { requirePermission } from "@/lib/security/permissions";
import {
  SYSTEM_SCREENS,
  SYSTEM_ACTIONS,
  ROLE_DEFINITIONS,
  DEFAULT_ROLE_PERMISSIONS,
  RolePermissionsMatrix,
} from "@/lib/security/rbac";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const actionFlagsSchema = z.object({
  read: z.boolean(),
  create: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
  export: z.boolean(),
});

const screenPermissionsSchema = z.object({
  dashboard: actionFlagsSchema,
  invoices: actionFlagsSchema,
  estimates: actionFlagsSchema,
  clients: actionFlagsSchema,
  appointments: actionFlagsSchema,
  agenda: actionFlagsSchema,
  services: actionFlagsSchema,
  payments: actionFlagsSchema,
  expenses: actionFlagsSchema,
  financeiro: actionFlagsSchema.default({ read: false, create: false, update: false, delete: false, export: false }),
  commissions: actionFlagsSchema.default({ read: false, create: false, update: false, delete: false, export: false }),
  professionals: actionFlagsSchema.default({ read: false, create: false, update: false, delete: false, export: false }),
  settings: actionFlagsSchema,
  users: actionFlagsSchema,
  reports: actionFlagsSchema.default({ read: false, create: false, update: false, delete: false, export: false }),
});

const roleMatrixSchema = z.object({
  ADMIN: screenPermissionsSchema.optional(),
  FINANCIAL: screenPermissionsSchema,
  OPERATOR: screenPermissionsSchema,
  VIEWER: screenPermissionsSchema,
});

export async function GET(req: NextRequest) {
  const check = await requirePermission(req, "users", "read");
  if (check.response) return check.response;
  const { session } = check;

  const company = session.companyId
    ? await prisma.companyProfile.findUnique({
        where: { id: session.companyId },
        select: { rolePermissions: true },
      })
    : await prisma.companyProfile.findFirst({
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
    const parsed = roleMatrixSchema.safeParse(body?.matrix);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Estrutura de matriz de permissões inválida." },
        { status: 400 }
      );
    }

    const newMatrix: RolePermissionsMatrix = {
      ...parsed.data,
      // Keep ADMIN fully enabled for security
      ADMIN: DEFAULT_ROLE_PERMISSIONS.ADMIN,
    };

    let company = session.companyId
      ? await prisma.companyProfile.findUnique({ where: { id: session.companyId } })
      : await prisma.companyProfile.findFirst();
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
