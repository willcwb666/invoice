import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/security/auth";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validations/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);

  if (!session) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        phone: true,
        gender: true,
        role: true,
        status: true,
        companyId: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
            tradeName: true,
          },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Usuário inativo ou não encontrado." },
        { status: 401 }
      );
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("Erro ao buscar dados do usuário autenticado:", error);
    return NextResponse.json(
      { error: "Erro ao verificar sessão do usuário." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser(req);

  if (!session) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { name, phone, gender } = parsed.data;

    const updated = await prisma.user.update({
      where: { id: session.sub },
      data: {
        ...(name ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(gender ? { gender } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        phone: true,
        gender: true,
        role: true,
        status: true,
        companyId: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
            tradeName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Perfil atualizado com sucesso!",
      data: updated,
    });
  } catch (error) {
    console.error("Erro ao atualizar perfil do usuário:", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar o perfil no momento." },
      { status: 500 }
    );
  }
}
