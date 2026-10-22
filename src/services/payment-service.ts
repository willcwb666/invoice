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
 * semanas ou no fim do mês. Este serviço trata o Appointment faturável
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

    // Restringe os pagamentos estritamente a atendimentos de hoje para trás (fuso de Denver)
    const now = new Date();
    const denverFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Denver",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const parts = denverFormatter.formatToParts(now);
    const getVal = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const year = getVal("year");
    const month = getVal("month");
    const day = getVal("day");

    // Fim do dia no fuso de Denver em UTC (+7h cobre MDT UTC-6 e MST UTC-7)
    const endOfToday = new Date(Date.UTC(year, month - 1, day, 23 + 7, 59, 59, 999));
    const effectiveTo = to && to < endOfToday ? to : endOfToday;

    return prisma.appointment.findMany({
      where: {
        companyId,
        billable: true,
        status: { in: ["SCHEDULED", "COMPLETED", "IN_PROGRESS"] },
        invoiced: false,
        ...(clientId ? { clientId } : {}),
        ...(status === "paid" ? { paid: true } : {}),
        ...(status === "unpaid" ? { paid: false } : {}),
        date: {
          ...(from ? { gte: from } : {}),
          lte: effectiveTo,
        },
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      include: {
        client: { select: { id: true, name: true, billingType: true } },
        services: { include: { service: true } },
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
        status: { in: ["SCHEDULED", "COMPLETED", "IN_PROGRESS"] },
        invoiced: false,
        paid: false,
        date: { lt: startOfToday },
      },
      orderBy: { date: "asc" },
      include: {
        client: { select: { id: true, name: true } },
        services: { include: { service: true } },
      },
    });

    const totalPending = appointments.reduce((acc, a) => acc + Number(a.price), 0);

    return {
      count: appointments.length,
      totalPending,
      appointments,
    };
  }

  /**
   * Alterna a conclusão de um atendimento (COMPLETED <-> SCHEDULED).
   */
  static async toggleCompleted(id: string, companyId: string) {
    const appt = await prisma.appointment.findFirst({ where: { id, companyId } });
    if (!appt) {
      throw new Error("Atendimento não encontrado.");
    }

    const newStatus = appt.status === "COMPLETED" ? "SCHEDULED" : "COMPLETED";

    return prisma.appointment.update({
      where: { id },
      data: { status: newStatus },
      include: {
        client: { select: { id: true, name: true, billingType: true } },
        services: { include: { service: true } },
      },
    });
  }

  /**
   * Define explicitamente a conclusão de um atendimento.
   */
  static async setCompleted(id: string, companyId: string, completed: boolean) {
    const appt = await prisma.appointment.findFirst({ where: { id, companyId } });
    if (!appt) {
      throw new Error("Atendimento não encontrado.");
    }

    return prisma.appointment.update({
      where: { id },
      data: { status: completed ? "COMPLETED" : "SCHEDULED" },
      include: {
        client: { select: { id: true, name: true, billingType: true } },
        services: { include: { service: true } },
      },
    });
  }

  /**
   * Marca vários atendimentos como concluídos ou agendados em lote.
   */
  static async bulkSetCompleted(ids: string[], companyId: string, completed: boolean) {
    const result = await prisma.appointment.updateMany({
      where: { id: { in: ids }, companyId, invoiced: false },
      data: { status: completed ? "COMPLETED" : "SCHEDULED" },
    });
    return result.count;
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

    return prisma.appointment.update({
      where: { id },
      data: {
        paid: true,
        paidAt: opts.paidAt || new Date(),
        paymentMethod: opts.paymentMethod || null,
      },
      include: {
        client: true,
        services: { include: { service: true } },
      },
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
      include: {
        client: true,
        services: { include: { service: true } },
      },
    });
  }

  /**
   * Marca vários atendimentos como pagos de uma só vez.
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
        invoiced: false,
      },
    });

    if (appointments.length !== ids.length) {
      throw new Error(
        "Um ou mais atendimentos selecionados não foram encontrados, são não faturáveis ou já pertencem a uma fatura."
      );
    }

    await prisma.appointment.updateMany({
      where: { id: { in: ids }, companyId },
      data: {
        paid: true,
        paidAt: opts.paidAt || new Date(),
        paymentMethod: opts.paymentMethod || null,
      },
    });

    return appointments.length;
  }

  /**
   * Marca vários atendimentos como não pagos (pendentes) de uma só vez.
   */
  static async bulkMarkUnpaid(ids: string[], companyId: string) {
    const appointments = await prisma.appointment.findMany({
      where: {
        id: { in: ids },
        companyId,
        billable: true,
        invoiced: false,
      },
    });

    if (appointments.length !== ids.length) {
      throw new Error(
        "Um ou mais atendimentos selecionados não foram encontrados, são não faturáveis ou já pertencem a uma fatura."
      );
    }

    await prisma.appointment.updateMany({
      where: { id: { in: ids }, companyId },
      data: {
        paid: false,
        paidAt: null,
        paymentMethod: null,
      },
    });

    return appointments.length;
  }

  /**
   * Alterna a marcação "Não Faturável" de um atendimento.
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
