import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { requirePermission } from "@/lib/security/permissions";
import { getTargetCompanyId } from "@/lib/company-context";
import { FinancialService, FinancialPeriod } from "@/services/financial-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`financial_api_${ip}`, { limit: 120, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json({ error: "Limite atingido." }, { status: 429 });
  }

  const check = await requirePermission(req, "dashboard", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const companyId = await getTargetCompanyId(session.companyId);
    const canViewFinancials =
      session.role === "ADMIN" ||
      session.role === "FINANCIAL" ||
      !(await requirePermission(req, "invoices", "read")).response;

    if (!canViewFinancials) {
      return NextResponse.json(
        { error: "Acesso não autorizado para relatórios financeiros." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get("period") as FinancialPeriod) || "month";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const data = await FinancialService.getFinancialDashboard(companyId, {
      period,
      startDate,
      endDate,
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Erro na API Financeiro:", error);
    return NextResponse.json(
      { error: "Erro ao gerar dados financeiros." },
      { status: 500 }
    );
  }
}
