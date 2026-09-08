import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createClientSchema } from "@/lib/validations/client";
import { ClientService } from "@/services/client-service";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/security/permissions";

async function getTargetCompanyId(preferredCompanyId?: string) {
  if (preferredCompanyId) return preferredCompanyId;
  const company = await prisma.companyProfile.findFirst();
  if (company) return company.id;
  const created = await prisma.companyProfile.create({
    data: { name: "Renata Matos de Oliveira" },
  });
  return created.id;
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

  const check = await requirePermission(req, "clients", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const companyId = await getTargetCompanyId(session.companyId);
    const clients = await ClientService.listClients(companyId);

    return NextResponse.json(
      { data: clients },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch {
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

  const check = await requirePermission(req, "clients", "create");
  if (check.response) return check.response;
  const { session } = check;

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

    const companyId = await getTargetCompanyId(session.companyId);
    const client = await ClientService.createClient(companyId, parsed.data);

    return NextResponse.json({ data: client }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao cadastrar cliente." },
      { status: 500 }
    );
  }
}
