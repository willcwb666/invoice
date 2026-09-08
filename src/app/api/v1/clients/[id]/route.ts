import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { ClientService } from "@/services/client-service";
import { createClientSchema } from "@/lib/validations/client";
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`clients_detail_get_${ip}`, { limit: 100, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "clients", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const { id } = await params;
    const companyId = await getTargetCompanyId(session.companyId);
    const client = await ClientService.getClientById(id, companyId);

    if (!client) {
      return NextResponse.json(
        { error: "Cliente não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: client });
  } catch {
    return NextResponse.json(
      { error: "Erro ao buscar detalhes do cliente." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`clients_patch_${ip}`, { limit: 50, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "clients", "update");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = createClientSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados inválidos para atualização do cliente.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const companyId = await getTargetCompanyId(session.companyId);
    await ClientService.updateClient(id, companyId, parsed.data);
    const updated = await ClientService.getClientById(id, companyId);

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao atualizar cliente." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requirePermission(req, "clients", "delete");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const { id } = await params;
    const companyId = await getTargetCompanyId(session.companyId);
    await ClientService.deleteClient(id, companyId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao excluir cliente." },
      { status: 400 }
    );
  }
}
