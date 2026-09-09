import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { InvoiceService } from "@/services/invoice-service";
import { requirePermission } from "@/lib/security/permissions";
import { getTargetCompanyId } from "@/lib/company-context";
import { sendInvoiceEmail } from "@/lib/email";
import { z } from "zod";

const sendSchema = z.object({
  email: z.string().trim().email("E-mail inválido").optional(),
});

// This route didn't exist before — send-modal.tsx was calling it and
// silently treating the resulting 404 as success (see the fix there), even
// though the actual sendInvoiceEmail()/Resend integration in lib/email.ts
// was already fully built and just never wired up to anything.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`invoices_send_${ip}`, { limit: 20, windowMs: 60000 });
  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em breve." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "invoices", "update");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const { id } = await params;
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "E-mail inválido.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const companyId = await getTargetCompanyId(session.companyId);
    const invoice = await InvoiceService.getInvoiceById(id, companyId);
    if (!invoice) {
      return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
    }

    const to = parsed.data.email || invoice.client?.email;
    if (!to) {
      return NextResponse.json(
        { error: "Este cliente não tem e-mail cadastrado." },
        { status: 400 }
      );
    }

    const publicUrl = `${req.nextUrl.origin}/pay/${invoice.id}`;
    const result = await sendInvoiceEmail({
      to,
      clientName: invoice.client?.name || "Cliente",
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: Number(invoice.totalAmount),
      dueDate: invoice.dueDate.toLocaleDateString("en-US"),
      publicUrl,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Falha ao enviar o e-mail." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Erro ao enviar fatura por e-mail:", error);
    return NextResponse.json(
      { error: "Erro interno ao enviar e-mail." },
      { status: 500 }
    );
  }
}
