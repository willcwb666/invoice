import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/security/auth";

export async function GET(req: NextRequest) {
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

  const companies = await prisma.companyProfile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      users: {
        where: { role: "ADMIN", status: "ACTIVE" },
        select: { email: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json({
    data: companies.map((c) => ({
      id: c.id,
      name: c.name,
      ownerEmail: c.users[0]?.email || "—",
      userCount: c._count.users,
      createdAt: c.createdAt,
    })),
  });
}
