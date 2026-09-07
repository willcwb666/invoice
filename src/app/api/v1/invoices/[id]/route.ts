import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { InvoiceService } from "@/services/invoice-service";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

async function getDefaultCompanyId() {
  const company = await prisma.companyProfile.findFirst();
  if (company) return company.id;
  const created = await prisma.companyProfile.create({
    data: { name: "Renata Matos de Oliveira" },
  });
  return created.id;
}

const updateStatusSchema = z.object({
  status: z.enum(["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"]),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`invoices_detail_get_${ip}`, { limit: 100, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em breve." },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const companyId = await getDefaultCompanyId();
    const invoice = await InvoiceService.getInvoiceById(id, companyId);

    if (!invoice) {
      return NextResponse.json(
        { error: "Fatura não encontrada." },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: invoice });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao buscar detalhes da fatura." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`invoices_patch_${ip}`, { limit: 50, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em breve." },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados inválidos para atualização de status.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const companyId = await getDefaultCompanyId();
    const updated = await InvoiceService.updateInvoiceStatus(
      id,
      companyId,
      parsed.data.status
    );

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao atualizar status da fatura." },
      { status: 400 }
    );
  }
}
