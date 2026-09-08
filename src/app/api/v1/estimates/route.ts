import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createEstimateSchema } from "@/lib/validations/estimate";
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

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`estimates_get_${ip}`, { limit: 100, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Limite atingido." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "estimates", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const companyId = await getTargetCompanyId(session.companyId);
    const estimates = await EstimateService.listEstimates(companyId);
    return NextResponse.json({ data: estimates });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar orçamentos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`estimates_post_${ip}`, { limit: 30, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Limite de criação de orçamentos atingido." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "estimates", "create");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const body = await req.json();
    const parsed = createEstimateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const companyId = await getTargetCompanyId(session.companyId);
    const estimate = await EstimateService.createEstimate(companyId, parsed.data);
    return NextResponse.json({ data: estimate }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : undefined) || "Erro ao criar orçamento." }, { status: 400 });
  }
}
