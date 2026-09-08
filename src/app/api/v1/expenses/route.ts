import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createExpenseSchema } from "@/lib/validations/expense";
import { ExpenseService } from "@/services/expense-service";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/security/permissions";

async function getTargetCompanyId(preferredCompanyId?: string) {
  if (preferredCompanyId) return preferredCompanyId;
  const company = await prisma.companyProfile.findFirst();
  return company?.id || "";
}

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
    const expenses = await ExpenseService.listExpenses(companyId, category);
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
