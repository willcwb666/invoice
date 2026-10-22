import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/security/auth";

const COOKIE_NAME = "super_admin_viewing_company_id";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const caller = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { isSuperAdmin: true },
  });
  if (!caller?.isSuperAdmin) {
    return NextResponse.json({ error: "Acesso restrito ao super-admin." }, { status: 403 });
  }

  const { id } = await params;
  const company = await prisma.companyProfile.findUnique({ where: { id }, select: { id: true } });
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: id,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h - a support session, not a persistent login
  });
  return response;
}
