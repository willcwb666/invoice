import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { registerUser } from "@/lib/security/auth";
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

    const { user, isFirstUser } = await registerUser({
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
      phone: parsed.data.phone,
    });

    const isActivated = user.status === "ACTIVE";

    return NextResponse.json({
      success: true,
      isFirstUser,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
      message: isActivated
        ? "Conta criada com sucesso! Você já pode efetuar o login."
        : "Cadastro realizado com sucesso! Sua conta está pendente de aprovação pela administradora (Renata). Entre em contato para liberação do acesso.",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao processar o cadastro." },
      { status: 400 }
    );
  }
}
