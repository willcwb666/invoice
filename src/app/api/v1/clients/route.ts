import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createClientSchema } from "@/lib/validations/client";
import { ClientService } from "@/services/client-service";
import { prisma } from "@/lib/prisma";

// Obtem ou cria o usuario padrao para o ambiente pessoal / dev
async function getOrCreateDefaultUser() {
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "admin@invoice.local",
        name: "Administrador",
      },
    });
  }
  return user;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`clients_get_${ip}`, { limit: 100, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(rate.reset) } }
    );
  }

  try {
    const user = await getOrCreateDefaultUser();
    const clients = await ClientService.listClients(user.id);

    return NextResponse.json(
      { data: clients },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro interno ao processar clientes." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`clients_post_${ip}`, { limit: 30, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Limite de criação atingido temporariamente." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createClientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const user = await getOrCreateDefaultUser();
    const client = await ClientService.createClient(user.id, parsed.data);

    return NextResponse.json({ data: client }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao cadastrar cliente." },
      { status: 500 }
    );
  }
}
