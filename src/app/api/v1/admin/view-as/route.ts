import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/security/auth";

const COOKIE_NAME = "super_admin_viewing_company_id";

export async function DELETE(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
