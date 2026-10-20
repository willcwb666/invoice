import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { CompanyService } from "@/services/company-service";
import { InvoiceService } from "@/services/invoice-service";
import { ExpenseService } from "@/services/expense-service";
import { PaymentService } from "@/services/payment-service";
import { requirePermission } from "@/lib/security/permissions";
import { hasPermission, DEFAULT_ROLE_PERMISSIONS, Role, RolePermissionsMatrix } from "@/lib/security/rbac";
import { getTargetCompanyId } from "@/lib/company-context";
import { prisma } from "@/lib/prisma";
import { BUSINESS_TIMEZONE, zonedPartsFromUtc, zonedTimeToUtc } from "@/lib/calendar/timezone";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`metrics_get_${ip}`, { limit: 120, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json({ error: "Limite atingido." }, { status: 429 });
  }

  const check = await requirePermission(req, "dashboard", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const companyId = await getTargetCompanyId(session.companyId);
    let canViewFinancials = session.role === "ADMIN" || session.role === "FINANCIAL";
    if (!canViewFinancials) {
      const company = await prisma.companyProfile.findUnique({
        where: { id: companyId },
        select: { rolePermissions: true },
      });
      const matrix =
        (company?.rolePermissions as unknown as RolePermissionsMatrix | null) ||
        DEFAULT_ROLE_PERMISSIONS;
      canViewFinancials = hasPermission(session.role as Role, "invoices", "read", matrix);
    }

    if (!canViewFinancials) {
      return NextResponse.json({
        data: {
          goal: { monthlyGoal: 0, currentRevenue: 0, percentage: 0, remaining: 0 },
          invoices: { totalBilled: 0, totalPaid: 0, totalPending: 0, overdueCount: 0 },
          financial: { grossRevenue: 0, totalExpenses: 0, netProfit: 0 },
          pendingPayments: { totalAmount: 0, count: 0, appointments: [] },
        },
      });
    }

    const now = new Date();
    const localNow = zonedPartsFromUtc(now, BUSINESS_TIMEZONE);
    // Mês corrente no Mountain Time
    const monthlyStartDate = zonedTimeToUtc(localNow.year, localNow.month - 1, 1, 0, 0, 0, BUSINESS_TIMEZONE);
    const lastDayOfMonth = new Date(Date.UTC(localNow.year, localNow.month, 0)).getUTCDate();
    const monthlyEndDate = zonedTimeToUtc(localNow.year, localNow.month - 1, lastDayOfMonth, 23, 59, 59, BUSINESS_TIMEZONE);

    // Semana corrente de Domingo a Sábado no Mountain Time
    const currentDayDate = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day));
    const dayOfWeek = currentDayDate.getUTCDay();
    const sundayUtc = new Date(currentDayDate);
    sundayUtc.setUTCDate(sundayUtc.getUTCDate() - dayOfWeek);
    const weeklyStartDate = zonedTimeToUtc(
      sundayUtc.getUTCFullYear(),
      sundayUtc.getUTCMonth(),
      sundayUtc.getUTCDate(),
      0, 0, 0,
      BUSINESS_TIMEZONE
    );
    const saturdayUtc = new Date(sundayUtc);
    saturdayUtc.setUTCDate(sundayUtc.getUTCDate() + 6);
    const weeklyEndDate = zonedTimeToUtc(
      saturdayUtc.getUTCFullYear(),
      saturdayUtc.getUTCMonth(),
      saturdayUtc.getUTCDate(),
      23, 59, 59,
      BUSINESS_TIMEZONE
    );

    const [weeklyGoalProgress, monthlyGoalProgress, invoiceMetrics, monthlyFinancial, weeklyFinancial, pendingPayments] = await Promise.all([
      CompanyService.getGoalProgress(companyId, "weekly"),
      CompanyService.getGoalProgress(companyId, "monthly"),
      InvoiceService.getDashboardMetrics(companyId),
      ExpenseService.getFinancialSummary(companyId, monthlyStartDate, monthlyEndDate),
      ExpenseService.getFinancialSummary(companyId, weeklyStartDate, weeklyEndDate),
      PaymentService.getPendingSummary(companyId),
    ]);

    return NextResponse.json({
      data: {
        goal: weeklyGoalProgress,
        weeklyGoal: weeklyGoalProgress,
        monthlyGoal: monthlyGoalProgress,
        invoices: invoiceMetrics,
        financial: monthlyFinancial,
        monthlyFinancial,
        weeklyFinancial,
        pendingPayments,
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao carregar métricas." }, { status: 500 });
  }
}
