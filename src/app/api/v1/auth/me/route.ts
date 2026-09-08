import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/security/auth";
import { prisma } from "@/lib/prisma";

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
        role: true,
        status: true,
        companyId: true,
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
    // Fallback to session payload if DB query experiences transient delay
    return NextResponse.json({
      data: {
        id: session.sub,
        email: session.email,
        name: session.name,
        role: session.role,
        companyId: session.companyId,
      },
    });
  }
}
