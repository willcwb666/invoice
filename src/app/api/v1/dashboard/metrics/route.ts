import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { CompanyService } from "@/services/company-service";
import { InvoiceService } from "@/services/invoice-service";
import { ExpenseService } from "@/services/expense-service";
import { prisma } from "@/lib/prisma";

async function getDefaultCompanyId() {
  const company = await prisma.companyProfile.findFirst();
  return company?.id || "";
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`metrics_get_${ip}`, { limit: 120, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json({ error: "Limite atingido." }, { status: 429 });
  }

  try {
    const companyId = await getDefaultCompanyId();

    const [goalProgress, invoiceMetrics, financialSummary] = await Promise.all([
      CompanyService.getMonthlyGoalProgress(companyId),
      InvoiceService.getDashboardMetrics(companyId),
      ExpenseService.getFinancialSummary(companyId),
    ]);

    return NextResponse.json({
      data: {
        goal: goalProgress,
        invoices: invoiceMetrics,
        financial: financialSummary,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Erro ao carregar métricas." }, { status: 500 });
  }
}
