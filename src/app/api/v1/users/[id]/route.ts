import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/security/auth";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().optional(),
  role: z.enum(["ADMIN", "FINANCIAL", "OPERATOR", "VIEWER"]).optional(),
  status: z.enum(["PENDING_APPROVAL", "ACTIVE", "SUSPENDED"]).optional(),
});

const ADMIN_WHITELIST = ["renatamatoz@gmail.com", "willcwb666@gmail.com"];

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Apenas administradores podem alterar perfis e status de usuários." },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updates: Record<string, string | Date> = {};

    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;

    // Safeguards for administrator accounts
    const isPrimaryAdmin = ADMIN_WHITELIST.includes(targetUser.email.toLowerCase());

    if (parsed.data.role !== undefined) {
      if (isPrimaryAdmin && parsed.data.role !== "ADMIN") {
        return NextResponse.json(
          { error: "O perfil da administradora principal não pode ser alterado para outra função." },
          { status: 400 }
        );
      }
      updates.role = parsed.data.role;
    }

    if (parsed.data.status !== undefined) {
      if (isPrimaryAdmin && parsed.data.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "A administradora principal não pode ser suspensa ou desativada." },
          { status: 400 }
        );
      }
      updates.status = parsed.data.status;
      if (parsed.data.status === "ACTIVE" && !targetUser.emailVerified) {
        updates.emailVerified = new Date();
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updates,
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

    // Audit log
    try {
      const isApproval = targetUser.status === "PENDING_APPROVAL" && updates.status === "ACTIVE";
      await prisma.auditLog.create({
        data: {
          userId: session.sub,
          action: isApproval ? "APPROVE" : "UPDATE",
          entity: "User",
          entityId: targetUser.id,
          details: JSON.stringify({
            previous: { role: targetUser.role, status: targetUser.status },
            current: { role: updatedUser.role, status: updatedUser.status },
            updatedBy: session.email,
          }),
        },
      });
    } catch (auditErr) {
      console.warn("Falha ao registrar audit log:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Usuário atualizado com sucesso.",
      data: updatedUser,
    });
  } catch (error: unknown) {
    console.error("Erro ao atualizar usuário:", error);
    return NextResponse.json(
      { error: "Erro interno ao atualizar usuário." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Apenas administradores podem excluir usuários." },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    // Safeguards
    if (ADMIN_WHITELIST.includes(targetUser.email.toLowerCase())) {
      return NextResponse.json(
        { error: "Contas administradoras protegidas não podem ser excluídas do sistema." },
        { status: 400 }
      );
    }

    if (session.sub === targetUser.id) {
      return NextResponse.json(
        { error: "Você não pode excluir sua própria conta enquanto estiver logado." },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.sub,
          action: "DELETE",
          entity: "User",
          entityId: targetUser.id,
          details: JSON.stringify({
            deletedUserEmail: targetUser.email,
            deletedBy: session.email,
          }),
        },
      });
    } catch (auditErr) {
      console.warn("Falha ao registrar audit log de exclusão:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Usuário excluído com sucesso.",
    });
  } catch (error: unknown) {
    console.error("Erro ao excluir usuário:", error);
    return NextResponse.json(
      { error: "Erro interno ao excluir usuário." },
      { status: 500 }
    );
  }
}
