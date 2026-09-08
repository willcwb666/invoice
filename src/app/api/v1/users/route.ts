import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, registerUser, ensureAdminUser } from "@/lib/security/auth";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  name: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres"),
  phone: z.string().trim().optional(),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres").optional(),
  role: z.enum(["ADMIN", "FINANCIAL", "OPERATOR", "VIEWER"]).optional().default("OPERATOR"),
  status: z.enum(["PENDING_APPROVAL", "ACTIVE", "SUSPENDED"]).optional().default("ACTIVE"),
});

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    // Ensure primary admin is seeded if database is fresh
    await ensureAdminUser();

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
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

    const { user, isFirstUser } = await registerUser({
      email: parsed.data.email,
      name: parsed.data.name,
      phone: parsed.data.phone,
      password: parsed.data.password,
      role: parsed.data.role,
      status: parsed.data.status,
    });

    // Register audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.sub,
          action: "CREATE",
          entity: "User",
          entityId: user.id,
          details: JSON.stringify({
            email: user.email,
            role: user.role,
            status: user.status,
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
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
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
