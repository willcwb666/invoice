import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createInvoiceSchema } from "@/lib/validations/invoice";
import { InvoiceService } from "@/services/invoice-service";
import { prisma } from "@/lib/prisma";

async function getOrCreateDefaultUser() {
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "admin@invoice.local",
        name: "Administrador",
      },
    });
  }
  return user;
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

  try {
    const user = await getOrCreateDefaultUser();
    const statusParam = req.nextUrl.searchParams.get("status") || undefined;
    const invoices = await InvoiceService.listInvoices(user.id, statusParam);

    return NextResponse.json(
      { data: invoices },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
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

    const user = await getOrCreateDefaultUser();
    const invoice = await InvoiceService.createInvoice(user.id, parsed.data);

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao criar fatura." },
      { status: 400 }
    );
  }
}
