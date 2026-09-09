import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { PaymentService } from "@/services/payment-service";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/security/permissions";

async function getTargetCompanyId(preferredCompanyId?: string) {
  if (preferredCompanyId) return preferredCompanyId;
  const company = await prisma.companyProfile.findFirst();
  return company?.id || "";
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`payments_get_${ip}`, { limit: 100, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em breve." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "payments", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const companyId = await getTargetCompanyId(session.companyId);
    const statusParam = req.nextUrl.searchParams.get("status");
    const clientId = req.nextUrl.searchParams.get("clientId") || undefined;
    const fromParam = req.nextUrl.searchParams.get("from");
    const toParam = req.nextUrl.searchParams.get("to");

    const status =
      statusParam === "paid" || statusParam === "unpaid" ? statusParam : "all";

    const payments = await PaymentService.listPayments(companyId, {
      status,
      clientId,
      from: fromParam ? new Date(fromParam) : undefined,
      to: toParam ? new Date(toParam) : undefined,
    });

    const totalPaid = payments
      .filter((p) => p.paid)
      .reduce((acc, p) => acc + Number(p.price), 0);
    const totalUnpaid = payments
      .filter((p) => !p.paid)
      .reduce((acc, p) => acc + Number(p.price), 0);

    return NextResponse.json({
      data: payments,
      summary: { totalPaid, totalUnpaid, count: payments.length },
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao buscar pagamentos." },
      { status: 500 }
    );
  }
}
