import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/security/auth";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Logout realizado com sucesso.",
  });

  // Clear session cookie completely
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
