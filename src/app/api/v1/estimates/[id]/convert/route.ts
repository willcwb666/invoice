import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { EstimateService } from "@/services/estimate-service";
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`estimates_convert_${ip}`, { limit: 30, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "estimates", "update");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const { id } = await params;
    const companyId = await getTargetCompanyId(session.companyId);

    if (!companyId) {
      return NextResponse.json(
        { error: "Empresa padrão não encontrada." },
        { status: 404 }
      );
    }

    const invoice = await EstimateService.convertToInvoice(id, companyId);
    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao converter orçamento em fatura." },
      { status: 400 }
    );
  }
}
