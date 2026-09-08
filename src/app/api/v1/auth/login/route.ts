import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { loginSchema } from "@/lib/validations/auth";
import {
  authenticateCredentials,
  createSessionToken,
  getSessionCookieOptions,
} from "@/lib/security/auth";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Rate Limiting strictly against Brute-Force: max 5 login attempts per 15 minutes
  const rate = checkRateLimit(`auth_login_${ip}`, {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!rate.success) {
    return NextResponse.json(
      {
        error: `Muitas tentativas incorretas de login. Por favor, aguarde ${Math.ceil(
          rate.reset - Date.now() / 1000
        )} segundos antes de tentar novamente.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rate.reset - Date.now() / 1000))),
        },
      }
    );
  }

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados de login inválidos.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const userAgent = req.headers.get("user-agent") || undefined;
    const authResult = await authenticateCredentials(
      parsed.data.email,
      parsed.data.password,
      ip,
      userAgent
    );

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || "Credenciais inválidas." },
        { status: 401 }
      );
    }

    const user = authResult.user;
    const expiresIn = parsed.data.rememberMe
      ? 30 * 24 * 3600 // 30 days
      : 7 * 24 * 3600; // 7 days

    const token = await createSessionToken(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId || undefined,
      },
      expiresIn
    );

    const cookieOptions = getSessionCookieOptions(parsed.data.rememberMe);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set({
      ...cookieOptions,
      value: token,
    });

    return response;
  } catch (error) {
    console.error("Erro no endpoint de login:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao processar autenticação." },
      { status: 500 }
    );
  }
}
