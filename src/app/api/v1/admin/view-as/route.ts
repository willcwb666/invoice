import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "super_admin_viewing_company_id";

export async function DELETE(_req: NextRequest) {
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
