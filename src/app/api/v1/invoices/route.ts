import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createInvoiceSchema } from "@/lib/validations/invoice";
import { InvoiceService } from "@/services/invoice-service";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/security/permissions";

async function getTargetCompanyId(preferredCompanyId?: string) {
  if (preferredCompanyId) return preferredCompanyId;
  const company = await prisma.companyProfile.findFirst();
  if (company) return company.id;
  const created = await prisma.companyProfile.create({
    data: { name: "Renata Matos de Oliveira" },
  });
  return created.id;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`invoices_get_${ip}`, { limit: 100, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em breve." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "invoices", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const companyId = await getTargetCompanyId(session.companyId);
    const statusParam = req.nextUrl.searchParams.get("status") || undefined;
    const allowedOrderBy = ["invoiceNumber", "issueDate", "dueDate", "totalAmount", "createdAt"] as const;
    const orderByParam = req.nextUrl.searchParams.get("orderBy");
    const orderBy = (allowedOrderBy as readonly string[]).includes(orderByParam || "")
      ? (orderByParam as (typeof allowedOrderBy)[number])
      : "invoiceNumber";
    const orderDir = req.nextUrl.searchParams.get("orderDir") === "asc" ? "asc" : "desc";
    const invoices = await InvoiceService.listInvoices(companyId, statusParam, orderBy, orderDir);

    return NextResponse.json(
      { data: invoices },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Erro interno ao buscar faturas." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`invoices_post_${ip}`, { limit: 30, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Limite de criação de faturas atingido." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "invoices", "create");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const body = await req.json();
    const parsed = createInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados da fatura inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const companyId = await getTargetCompanyId(session.companyId);
    const invoice = await InvoiceService.createInvoice(companyId, parsed.data);

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao criar fatura." },
      { status: 400 }
    );
  }
}
