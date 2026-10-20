import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { EstimateService } from "@/services/estimate-service";
import { requirePermission } from "@/lib/security/permissions";
import { getTargetCompanyId } from "@/lib/company-context";
import { sendEstimateEmail } from "@/lib/email";
import { z } from "zod";

const sendSchema = z.object({
  email: z.string().trim().email("E-mail inválido").optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`estimates_send_${ip}`, { limit: 20, windowMs: 60000 });
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
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "E-mail inválido.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const companyId = await getTargetCompanyId(session.companyId);
    const estimate = await EstimateService.getEstimateById(id, companyId);
    if (!estimate) {
      return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
    }

    const to = parsed.data.email || estimate.client?.email;
    if (!to) {
      return NextResponse.json(
        { error: "Este cliente não possui e-mail cadastrado. Informe um e-mail para envio." },
        { status: 400 }
      );
    }

    const origin = req.nextUrl.origin;
    const publicUrl = `${origin}/p/estimate/${estimate.publicToken}`;

    const formattedValidDate = new Date(estimate.validUntil).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const result = await sendEstimateEmail({
      to,
      clientName: estimate.client?.name || "Customer",
      estimateNumber: estimate.estimateNumber,
      totalAmount: Number(estimate.totalAmount),
      validUntil: formattedValidDate,
      publicUrl,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Falha ao enviar e-mail pelo Resend." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { sentTo: to, resendId: result.id },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno ao enviar orçamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
