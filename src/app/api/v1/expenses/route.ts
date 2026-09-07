import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createExpenseSchema } from "@/lib/validations/expense";
import { ExpenseService } from "@/services/expense-service";
import { prisma } from "@/lib/prisma";

async function getDefaultCompanyId() {
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

  try {
    const companyId = await getDefaultCompanyId();
    const category = req.nextUrl.searchParams.get("category") || undefined;
    const expenses = await ExpenseService.listExpenses(companyId, category);
    return NextResponse.json({ data: expenses });
  } catch (error: any) {
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

  try {
    const body = await req.json();
    const parsed = createExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const companyId = await getDefaultCompanyId();
    const expense = await ExpenseService.createExpense(companyId, parsed.data);
    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao registrar despesa." }, { status: 400 });
  }
}
