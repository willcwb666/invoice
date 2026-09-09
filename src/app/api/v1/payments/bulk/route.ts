import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { PaymentService } from "@/services/payment-service";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/security/permissions";
import { z } from "zod";

async function getTargetCompanyId(preferredCompanyId?: string) {
  if (preferredCompanyId) return preferredCompanyId;
  const company = await prisma.companyProfile.findFirst();
  return company?.id || "";
}

const bulkPaySchema = z.object({
  appointmentIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um atendimento."),
  paidAt: z.string().datetime().optional(),
  paymentMethod: z.string().trim().max(50).optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`payments_bulk_${ip}`, { limit: 30, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em breve." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "payments", "update");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const body = await req.json();
    const parsed = bulkPaySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados inválidos.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const companyId = await getTargetCompanyId(session.companyId);
    const count = await PaymentService.bulkMarkPaid(
      parsed.data.appointmentIds,
      companyId,
      {
        paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : undefined,
        paymentMethod: parsed.data.paymentMethod,
      }
    );

    return NextResponse.json({ success: true, count });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao registrar pagamentos." },
      { status: 400 }
    );
  }
}
