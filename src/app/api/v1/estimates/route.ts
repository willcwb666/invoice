import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createEstimateSchema } from "@/lib/validations/estimate";
import { EstimateService } from "@/services/estimate-service";
import { prisma } from "@/lib/prisma";

async function getDefaultCompanyId() {
  const company = await prisma.companyProfile.findFirst();
  return company?.id || "";
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

  try {
    const companyId = await getDefaultCompanyId();
    const estimates = await EstimateService.listEstimates(companyId);
    return NextResponse.json({ data: estimates });
  } catch (error: any) {
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

  try {
    const body = await req.json();
    const parsed = createEstimateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const companyId = await getDefaultCompanyId();
    const estimate = await EstimateService.createEstimate(companyId, parsed.data);
    return NextResponse.json({ data: estimate }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao criar orçamento." }, { status: 400 });
  }
}
