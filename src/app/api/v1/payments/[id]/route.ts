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

const patchPaymentSchema = z.object({
  action: z.enum(["mark_paid", "mark_unpaid"]),
  paidAt: z.string().datetime().optional(),
  paymentMethod: z.string().trim().max(50).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`payments_patch_${ip}`, { limit: 60, windowMs: 60000 });

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
    const { id } = await params;
    const body = await req.json();
    const parsed = patchPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados inválidos para atualização de pagamento.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const companyId = await getTargetCompanyId(session.companyId);

    const updated =
      parsed.data.action === "mark_paid"
        ? await PaymentService.markPaid(id, companyId, {
            paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : undefined,
            paymentMethod: parsed.data.paymentMethod,
          })
        : await PaymentService.markUnpaid(id, companyId);

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao atualizar pagamento." },
      { status: 400 }
    );
  }
}
