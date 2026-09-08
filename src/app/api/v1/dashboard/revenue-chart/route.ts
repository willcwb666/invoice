import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { requirePermission } from "@/lib/security/permissions";
import { prisma } from "@/lib/prisma";
import { RevenueChartService } from "@/services/revenue-chart-service";

async function getTargetCompanyId(preferredCompanyId?: string) {
  if (preferredCompanyId) return preferredCompanyId;
  const company = await prisma.companyProfile.findFirst();
  return company?.id || "";
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`dashboard_revenue_chart_${ip}`, { limit: 60, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json({ error: "Limite atingido." }, { status: 429 });
  }

  const check = await requirePermission(req, "dashboard", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const companyId = await getTargetCompanyId(session.companyId);

    const [weekly, monthly] = await Promise.all([
      RevenueChartService.getWeeklySeries(companyId),
      RevenueChartService.getMonthlySeries(companyId, 6),
    ]);

    return NextResponse.json({ data: { weekly, monthly } });
  } catch (error: unknown) {
    console.error("Erro ao calcular gráfico de faturamento:", error);
    return NextResponse.json(
      { error: "Erro ao calcular gráfico de faturamento." },
      { status: 500 }
    );
  }
}
