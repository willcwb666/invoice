import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { InvoiceService } from "@/services/invoice-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`public_inv_get_${ip}`, { limit: 60, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em breve." },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "ID da fatura é obrigatório." },
        { status: 400 }
      );
    }

    const invoice = await InvoiceService.getPublicInvoiceById(id);

    if (!invoice) {
      return NextResponse.json(
        { error: "Fatura não encontrada." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { data: invoice },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Erro interno ao buscar fatura pública." },
      { status: 500 }
    );
  }
}
