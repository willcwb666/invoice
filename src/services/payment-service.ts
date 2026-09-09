import { prisma } from "@/lib/prisma";

export interface PaymentFilters {
  status?: "paid" | "unpaid" | "all";
  clientId?: string;
  from?: Date;
  to?: Date;
}

/**
 * Fonte única de verdade para "quanto o negócio já recebeu / ainda precisa
 * receber" fora do fluxo formal de Invoice. A maioria dos clientes nunca
 * pede uma fatura - eles simplesmente pagam por limpeza, a cada duas
 * semanas ou no fim do mês. Este serviço trata o Appointment concluído
 * como o registro de cobrança em si.
 *
 * Regra para nunca contar receita duas vezes: um atendimento com
 * invoiced=true tem seu status de pagamento representado pela própria
 * Invoice (ver InvoiceService/CompanyService) - nunca pelos campos
 * paid/paidAt daqui. Por isso toda consulta abaixo filtra invoiced=false.
 */
export class PaymentService {
  static async listPayments(companyId: string, filters: PaymentFilters = {}) {
    const { status = "all", clientId, from, to } = filters;

    return prisma.appointment.findMany({
      where: {
        companyId,
        billable: true,
        status: "COMPLETED",
        invoiced: false,
        ...(clientId ? { clientId } : {}),
        ...(status === "paid" ? { paid: true } : {}),
        ...(status === "unpaid" ? { paid: false } : {}),
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: "desc" },
      include: {
        client: { select: { id: true, name: true, billingType: true } },
      },
    });
  }

  /**
   * Tudo que não está pago e é de ontem para trás - o alerta de "a receber"
   * do dashboard. Hoje mesmo não conta como atrasado: o cliente ainda pode
   * pagar ao final do dia.
   */
  static async getPendingSummary(companyId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const appointments = await prisma.appointment.findMany({
      where: {
        companyId,
        billable: true,
        status: "COMPLETED",
        invoiced: false,
        paid: false,
        date: { lt: startOfToday },
      },
      orderBy: { date: "asc" },
      include: {
        client: { select: { id: true, name: true } },
      },
    });

    const totalPending = appointments.reduce((acc, a) => acc + Number(a.price), 0);

    return {
      count: appointments.length,
      totalPending,
      appointments,
    };
  }

  static async markPaid(
    id: string,
    companyId: string,
    opts: { paidAt?: Date; paymentMethod?: string } = {}
  ) {
    const appt = await prisma.appointment.findFirst({ where: { id, companyId } });
    if (!appt) {
      throw new Error("Atendimento não encontrado.");
    }
    if (!appt.billable) {
      throw new Error("Este atendimento é não faturável - não há pagamento a registrar.");
    }
    if (appt.invoiced) {
      throw new Error(
        "Este atendimento já foi incluído em uma fatura - atualize o pagamento pela tela de Faturas."
      );
    }
    if (appt.status !== "COMPLETED") {
      throw new Error("Só é possível marcar como pago um atendimento concluído.");
    }

    return prisma.appointment.update({
      where: { id },
      data: {
        paid: true,
        paidAt: opts.paidAt || new Date(),
        paymentMethod: opts.paymentMethod || null,
      },
      include: { client: true },
    });
  }

  static async markUnpaid(id: string, companyId: string) {
    const appt = await prisma.appointment.findFirst({ where: { id, companyId } });
    if (!appt) {
      throw new Error("Atendimento não encontrado.");
    }

    return prisma.appointment.update({
      where: { id },
      data: { paid: false, paidAt: null, paymentMethod: null },
      include: { client: true },
    });
  }

  /**
   * Marca vários atendimentos como pagos de uma só vez - o fluxo real de
   * clientes que acertam a conta quinzenal ou mensalmente, cobrindo várias
   * limpezas de uma vez. Tudo ou nada: se algum item da lista não puder ser
   * marcado, nada é alterado.
   */
  static async bulkMarkPaid(
    ids: string[],
    companyId: string,
    opts: { paidAt?: Date; paymentMethod?: string } = {}
  ) {
    const appointments = await prisma.appointment.findMany({
      where: {
        id: { in: ids },
        companyId,
        billable: true,
        status: "COMPLETED",
        invoiced: false,
      },
    });

    if (appointments.length !== ids.length) {
      throw new Error(
        "Um ou mais atendimentos selecionados não foram encontrados, não estão concluídos, são não faturáveis ou já pertencem a uma fatura."
      );
    }

    await prisma.appointment.updateMany({
      where: { id: { in: ids } },
      data: {
        paid: true,
        paidAt: opts.paidAt || new Date(),
        paymentMethod: opts.paymentMethod || null,
      },
    });

    return appointments.length;
  }

  /**
   * Alterna a marcação "Não Faturável" de um atendimento. Não mexe em
   * `manuallyEdited` de propósito: é um controle financeiro independente do
   * conteúdo do agendamento, e não deve travar o sync do iCloud para ele.
   */
  static async setBillable(id: string, companyId: string, billable: boolean) {
    const appt = await prisma.appointment.findFirst({ where: { id, companyId } });
    if (!appt) {
      throw new Error("Atendimento não encontrado.");
    }

    return prisma.appointment.update({
      where: { id },
      data: { billable },
      include: { client: true, services: { include: { service: true } } },
    });
  }
}
