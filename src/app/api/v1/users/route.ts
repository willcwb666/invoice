import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, registerUser, ensureAdminUser } from "@/lib/security/auth";
import { requirePermission } from "@/lib/security/permissions";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  name: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres"),
  phone: z.string().trim().optional(),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres").optional(),
  role: z.enum(["ADMIN", "FINANCIAL", "OPERATOR", "VIEWER", "CLEANER"]).optional().default("OPERATOR"),
  status: z.enum(["PENDING_APPROVAL", "ACTIVE", "SUSPENDED"]).optional().default("ACTIVE"),
  professionalId: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const check = await requirePermission(req, "users", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    // Ensure primary admin is seeded if database is fresh
    await ensureAdminUser();

    const users = await prisma.user.findMany({
      where: session.companyId ? { companyId: session.companyId } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        professionalId: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const stats = {
      total: users.length,
      active: users.filter((u) => u.status === "ACTIVE").length,
      pending: users.filter((u) => u.status === "PENDING_APPROVAL").length,
      suspended: users.filter((u) => u.status === "SUSPENDED").length,
      admins: users.filter((u) => u.role === "ADMIN").length,
    };

    return NextResponse.json({
      success: true,
      data: users,
      stats,
    });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar lista de usuários." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Permissão insuficiente. Apenas administradores podem cadastrar usuários diretamente." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados de usuário inválidos.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    if (!session.companyId) {
      return NextResponse.json(
        { error: "Sua própria conta não está vinculada a uma empresa." },
        { status: 400 }
      );
    }

    const { user, isFirstUser } = await registerUser({
      email: parsed.data.email,
      name: parsed.data.name,
      phone: parsed.data.phone,
      password: parsed.data.password,
      role: parsed.data.role,
      status: parsed.data.status,
      companyId: session.companyId,
    });

    let finalUser = user;
    if (parsed.data.professionalId) {
      finalUser = await prisma.user.update({
        where: { id: user.id },
        data: { professionalId: parsed.data.professionalId },
      });
    }

    // Register audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.sub,
          action: "CREATE",
          entity: "User",
          entityId: finalUser.id,
          details: JSON.stringify({
            email: finalUser.email,
            role: finalUser.role,
            status: finalUser.status,
            professionalId: finalUser.professionalId,
            createdByUser: session.email,
          }),
        },
      });
    } catch (auditErr) {
      console.warn("Falha ao registrar audit log:", auditErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Usuário cadastrado com sucesso.",
        data: {
          id: finalUser.id,
          email: finalUser.email,
          name: finalUser.name,
          phone: finalUser.phone,
          role: finalUser.role,
          status: finalUser.status,
          professionalId: finalUser.professionalId,
          createdAt: finalUser.createdAt,
        },
        isFirstUser,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Erro ao criar usuário:", error);
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro interno ao cadastrar usuário." },
      { status: 400 }
    );
  }
}
