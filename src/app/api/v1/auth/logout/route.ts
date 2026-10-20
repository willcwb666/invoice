import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/security/auth";

export async function POST(req: NextRequest) {
  // Revoga a sessão do Better Auth no banco e devolve o Set-Cookie correto
  // (inclusive com o prefixo __Secure- que o Better Auth usa em produção
  // via HTTPS — limpar manualmente o nome sem esse prefixo não afeta o
  // cookie real do navegador e deixava a sessão do Google OAuth viva).
  let betterAuthResponse: Response | null = null;
  try {
    betterAuthResponse = await auth.api.signOut({
      headers: req.headers,
      asResponse: true,
    });
  } catch {
    // Sem sessão Better Auth ativa (ex: usuário logado só via /api/v1/auth/login) — segue normalmente.
  }

  const response = NextResponse.json({
    success: true,
    message: "Logout realizado com sucesso.",
  });

  betterAuthResponse?.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      response.headers.append("set-cookie", value);
    }
  });

  // Clear legacy session cookie (login por e-mail/senha, não gerenciado pelo Better Auth)
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
