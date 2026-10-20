import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createExpenseSchema } from "@/lib/validations/expense";
import { ExpenseService } from "@/services/expense-service";
import { requirePermission } from "@/lib/security/permissions";
import { getTargetCompanyId } from "@/lib/company-context";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`expenses_get_${ip}`, { limit: 100, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Limite atingido." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "expenses", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const companyId = await getTargetCompanyId(session.companyId);
    const category = req.nextUrl.searchParams.get("category") || undefined;
    const period = req.nextUrl.searchParams.get("period");
    const monthParam = req.nextUrl.searchParams.get("month");
    const yearParam = req.nextUrl.searchParams.get("year");
    const startDateParam = req.nextUrl.searchParams.get("startDate");
    const endDateParam = req.nextUrl.searchParams.get("endDate");

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else if (monthParam && yearParam) {
      const year = parseInt(yearParam, 10);
      const month = parseInt(monthParam, 10);
      startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      endDate = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59));
    } else if (period === "last_month") {
      const now = new Date();
      const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      startDate = new Date(Date.UTC(prevYear, prevMonth, 1, 0, 0, 0));
      const lastDay = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
      endDate = new Date(Date.UTC(prevYear, prevMonth, lastDay, 23, 59, 59));
    } else if (period === "month" || period === "current_month") {
      const now = new Date();
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
      const lastDay = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).getUTCDate();
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), lastDay, 23, 59, 59));
    }

    const expenses = await ExpenseService.listExpenses(companyId, {
      category,
      startDate,
      endDate,
    });
    return NextResponse.json({ data: expenses });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar despesas." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`expenses_post_${ip}`, { limit: 50, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Limite atingido." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "expenses", "create");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const body = await req.json();
    const parsed = createExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const companyId = await getTargetCompanyId(session.companyId);
    const expense = await ExpenseService.createExpense(companyId, parsed.data);
    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : undefined) || "Erro ao registrar despesa." }, { status: 400 });
  }
}
