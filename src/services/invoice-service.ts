import { prisma } from "@/lib/prisma";
import { CreateInvoiceInput } from "@/lib/validations/invoice";
import { CompanyService } from "@/services/company-service";
import { Prisma } from "@prisma/client";
import { ensureExampleInvoicesSeeded } from "@/lib/seed-data";

export class InvoiceService {
  /**
   * Lista faturas da empresa com ordenação e filtros (Padrão: ordenado pelo número da fatura)
   */
  static async listInvoices(
    companyId: string,
    status?: string,
    orderBy: "invoiceNumber" | "issueDate" | "dueDate" | "totalAmount" | "createdAt" = "invoiceNumber",
    orderDir: "asc" | "desc" = "desc"
  ) {
    // Sincroniza faturas de exemplo caso ainda não existam no banco. Não
    // deixa uma falha de seed (ex.: banco momentaneamente indisponível no
    // boot) derrubar a listagem em si — a query abaixo funciona normalmente
    // mesmo se o seed não rodou ainda.
    try {
      await ensureExampleInvoicesSeeded();
    } catch (err) {
      console.error("Erro ao sincronizar dados iniciais antes de listar faturas:", err);
    }

    return prisma.invoice.findMany({
      where: {
        companyId,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { [orderBy]: orderDir },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
          },
        },
        items: true,
        company: {
          include: {
            addresses: true,
          },
        },
      },
    });
  }

  /**
   * Busca fatura detalhada com itens
   */
  static async getInvoiceById(id: string, companyId?: string) {
    return prisma.invoice.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
      },
      include: {
        client: true,
        items: true,
        company: {
          include: {
            addresses: true,
          },
        },
      },
    });
  }

  /**
   * Busca fatura pública com cliente, itens e dados da empresa emissora
   * (segura para acesso externo - só campos que já aparecem em uma fatura
   * impressa, nunca configurações internas como rolePermissions ou metas).
   */
  static async getPublicInvoiceById(id: string) {
    return prisma.invoice.findUnique({
      where: { id },
      // Explicit top-level select — the previous version relied on the
      // frontend simply not rendering `notes` (a free-text field meant for
      // internal remarks) to keep it out of the public response, but
      // anything calling this API directly (curl, devtools) got it anyway.
      // Only fields that already appear on a printed invoice belong here.
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        issueDate: true,
        dueDate: true,
        providerAddress: true,
        subtotal: true,
        discount: true,
        tax: true,
        totalAmount: true,
        paidAmount: true,
        paidAt: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
          },
        },
        items: true,
        company: {
          select: {
            name: true,
            tradeName: true,
            email: true,
            phone: true,
            paymentMethods: true,
            terms: true,
            signatureUrl: true,
            logoUrl: true,
          },
        },
      },
    });
  }

  /**
   * Atualiza status da fatura (ex: PAID, CANCELLED)
   */
  static async updateInvoiceStatus(
    id: string,
    companyId: string,
    status: "DRAFT" | "PENDING" | "PAID" | "OVERDUE" | "CANCELLED"
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId },
    });

    if (!invoice) {
      throw new Error("Fatura não encontrada.");
    }

    // Moving TO PAID stamps the full amount/date (unless already set, e.g.
    // this is a re-save). Moving AWAY from PAID — a correction to CANCELLED
    // or back to OVERDUE, say — used to unconditionally wipe paidAmount and
    // paidAt back to 0/null, silently destroying the record that a payment
    // was ever received. Leave them as-is instead; they're history, not a
    // "current status" mirror. There's also no way to record a PARTIAL
    // payment through this method (paidAmount is only ever 0 or the full
    // total here) — that's a real gap, but a separate feature to build
    // deliberately rather than something to paper over in this fix.
    const isPaid = status === "PAID";
    return prisma.invoice.update({
      where: { id },
      data: {
        status,
        ...(isPaid
          ? {
              paidAt: invoice.paidAt || new Date(),
              paidAmount: invoice.paidAmount.isZero() ? invoice.totalAmount : invoice.paidAmount,
            }
          : {}),
      },
      include: {
        client: true,
        items: true,
      },
    });
  }

  /**
   * Cria fatura com cálculo atômico e snapshot do endereço vigente da empresa.
   * Aceita itens digitados manualmente e/ou agendamentos concluídos ainda não
   * faturados (data.appointmentIds) - cada agendamento vira uma linha da
   * fatura automaticamente e é marcado invoiced=true na mesma transação,
   * para nunca poder ser faturado duas vezes.
   */
  static async createInvoice(companyId: string, data: CreateInvoiceInput) {
    const providerAddress = await CompanyService.getDefaultAddress(companyId);

    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({
        where: { id: data.clientId, companyId },
      });

      if (!client) {
        throw new Error("Cliente não encontrado.");
      }

      let appointments: { id: string; title: string; date: Date; price: Prisma.Decimal }[] = [];
      if (data.appointmentIds.length > 0) {
        appointments = await tx.appointment.findMany({
          where: {
            id: { in: data.appointmentIds },
            companyId,
            clientId: data.clientId,
            status: "COMPLETED",
            invoiced: false,
          },
          select: { id: true, title: true, date: true, price: true },
        });

        if (appointments.length !== data.appointmentIds.length) {
          throw new Error(
            "Um ou mais agendamentos selecionados não foram encontrados, não pertencem a este cliente, não estão concluídos ou já foram faturados."
          );
        }
      }

      const appointmentItems = appointments.map((appt) => ({
        description: appt.title,
        serviceDate: appt.date,
        quantity: 1,
        unitPrice: appt.price,
        total: appt.price,
      }));

      const manualItems = data.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice),
        total: new Prisma.Decimal(item.quantity).mul(new Prisma.Decimal(item.unitPrice)),
      }));

      const allItems = [...appointmentItems, ...manualItems];
      const totalAmount = allItems.reduce(
        (acc, item) => acc.add(item.total),
        new Prisma.Decimal(0)
      );

      const invoice = await tx.invoice.create({
        data: {
          companyId,
          clientId: data.clientId,
          invoiceNumber: data.invoiceNumber,
          status: data.status,
          dueDate: new Date(data.dueDate),
          providerAddress,
          subtotal: totalAmount,
          totalAmount,
          notes: data.notes || null,
          items: {
            create: allItems,
          },
        },
        include: {
          client: true,
          items: true,
        },
      });

      if (appointments.length > 0) {
        await tx.appointment.updateMany({
          where: { id: { in: appointments.map((a) => a.id) } },
          data: { invoiced: true, invoiceId: invoice.id },
        });
      }

      return invoice;
    });
  }

  /**
   * Métricas do Dashboard para a empresa
   */
  static async getDashboardMetrics(companyId: string) {
    const [invoices, clientCount, expenseSum] = await Promise.all([
      prisma.invoice.findMany({
        where: { companyId },
        select: { status: true, totalAmount: true, paidAmount: true },
      }),
      prisma.client.count({ where: { companyId } }),
      prisma.expense.aggregate({
        where: { companyId },
        _sum: { amount: true },
      }),
    ]);

    let totalPaid = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    for (const inv of invoices) {
      const val = Number(inv.totalAmount);
      if (inv.status === "PAID") totalPaid += val;
      else if (inv.status === "PENDING") totalPending += val;
      else if (inv.status === "OVERDUE") totalOverdue += val;
    }

    const totalExpenses = Number(expenseSum._sum.amount || 0);
    const netProfit = totalPaid - totalExpenses;

    return {
      totalPaid,
      totalPending,
      totalOverdue,
      totalInvoices: invoices.length,
      clientCount,
      totalExpenses,
      netProfit,
    };
  }
}
