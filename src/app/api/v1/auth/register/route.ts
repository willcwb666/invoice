import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import {
  registerUser,
  createSessionToken,
  getSessionCookieOptions,
} from "@/lib/security/auth";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  name: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres"),
  phone: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Rate Limiting: max 10 registration attempts per 15 minutes per IP
  const rate = checkRateLimit(`auth_reg_${ip}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!rate.success) {
    return NextResponse.json(
      {
        error: `Muitas tentativas de cadastro. Aguarde ${Math.ceil(
          rate.reset - Date.now() / 1000
        )} segundos antes de tentar novamente.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados de cadastro inválidos.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // No companyId passed - this is always "someone creating their own
    // company," never "joining whichever one exists" (see registerUser).
    const { user } = await registerUser({
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
      phone: parsed.data.phone,
    });

    // Log the new PENDING_ONBOARDING user straight in, same mechanism
    // /api/v1/auth/login uses, so they land on /onboarding immediately
    // instead of being told to go log in separately.
    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name || "Usuário",
      role: user.role,
      companyId: user.companyId || undefined,
    });
    const cookieOptions = getSessionCookieOptions(false);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
      message: "Cadastro realizado! Vamos configurar sua empresa.",
    });
    response.cookies.set({ ...cookieOptions, value: token });
    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao processar o cadastro." },
      { status: 400 }
    );
  }
}
