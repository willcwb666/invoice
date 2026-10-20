import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { EstimateService } from "@/services/estimate-service";
import { createEstimateSchema } from "@/lib/validations/estimate";
import { requirePermission } from "@/lib/security/permissions";
import { z } from "zod";
import { getTargetCompanyId } from "@/lib/company-context";

const updateStatusSchema = z.object({
  status: z.enum(["DRAFT", "PENDING", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"]).optional(),
  notes: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`estimates_detail_get_${ip}`, { limit: 100, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em breve." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "estimates", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const { id } = await params;
    const companyId = await getTargetCompanyId(session.companyId);
    const estimate = await EstimateService.getEstimateById(id, companyId);

    if (!estimate) {
      return NextResponse.json(
        { error: "Orçamento não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: estimate });
  } catch {
    return NextResponse.json(
      { error: "Erro ao buscar detalhes do orçamento." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`estimates_patch_${ip}`, { limit: 50, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em breve." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "estimates", "update");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const { id } = await params;
    const body = await req.json();
    const companyId = await getTargetCompanyId(session.companyId);

    // Se o payload contiver items, executa atualização completa do orçamento (ex: rascunho ou finalização)
    if (body && Array.isArray(body.items)) {
      const parsedFull = createEstimateSchema.safeParse(body);
      if (!parsedFull.success) {
        return NextResponse.json(
          {
            error: "Dados inválidos para atualização do orçamento.",
            details: parsedFull.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }
      const updated = await EstimateService.updateEstimate(id, companyId, parsedFull.data);
      return NextResponse.json({ data: updated });
    }

    const parsed = updateStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados inválidos para atualização de orçamento.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    if (parsed.data.status) {
      const updated = await EstimateService.updateEstimateStatus(
        id,
        companyId,
        parsed.data.status
      );
      return NextResponse.json({ data: updated });
    }

    const updated = await EstimateService.getEstimateById(id, companyId);
    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao atualizar orçamento." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requirePermission(req, "estimates", "delete");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const { id } = await params;
    const companyId = await getTargetCompanyId(session.companyId);
    await EstimateService.deleteEstimate(id, companyId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao excluir orçamento." },
      { status: 400 }
    );
  }
}
