import { prisma } from "@/lib/prisma";

export class CompanyService {
  /**
   * Obtém o perfil da empresa com endereços cadastrados
   */
  static async getProfile() {
    return prisma.companyProfile.findFirst({
      include: {
        addresses: {
          orderBy: { isDefault: "desc" },
        },
      },
    });
  }

  /**
   * Obtém o endereço padrão vigente (Evans) ou histórico (Greeley)
   */
  static async getDefaultAddress(companyId: string): Promise<string> {
    const address = await prisma.companyAddress.findFirst({
      where: { companyId, isDefault: true },
    });

    if (address) {
      return `${address.street} - ${address.city}, ${address.state} - ${address.zipCode}`;
    }

    // Fallback para qualquer endereço da empresa
    const anyAddress = await prisma.companyAddress.findFirst({
      where: { companyId },
    });

    if (anyAddress) {
      return `${anyAddress.street} - ${anyAddress.city}, ${anyAddress.state} - ${anyAddress.zipCode}`;
    }

    return "4172 MeadowView - Evans, CO - 80620";
  }

  /**
   * Progresso da Meta Mensal de Faturamento com Projeção da Agenda
   */
  static async getMonthlyGoalProgress(companyId: string) {
    const company = await prisma.companyProfile.findUnique({
      where: { id: companyId },
      select: { monthlyRevenueGoal: true },
    });

    const goal = company ? Number(company.monthlyRevenueGoal) : 6000;

    // Primeiro dia e último dia do mês atual
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Faturamento do mês (Faturas emitidas no mês atual)
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        issueDate: { gte: firstDay, lte: lastDay },
      },
      select: { status: true, totalAmount: true },
    });

    let currentBilled = 0;
    let paidAmount = 0;

    for (const inv of invoices) {
      const val = Number(inv.totalAmount);
      // DRAFT invoices haven't been issued to the client yet and CANCELLED
      // ones never will be - neither counts toward the billed goal.
      if (inv.status !== "CANCELLED" && inv.status !== "DRAFT") {
        currentBilled += val;
      }
      if (inv.status === "PAID") {
        paidAmount += val;
      }
    }

    // A maioria dos clientes nunca recebe uma Invoice - eles pagam direto
    // pela limpeza (ver PaymentService). invoiced=false evita contar de novo
    // um atendimento que já virou item de uma fatura (já somado acima).
    const directAppointments = await prisma.appointment.findMany({
      where: {
        companyId,
        date: { gte: firstDay, lte: lastDay },
        billable: true,
        status: "COMPLETED",
        invoiced: false,
      },
      select: { price: true, paid: true },
    });

    for (const appt of directAppointments) {
      const val = Number(appt.price);
      currentBilled += val;
      if (appt.paid) {
        paidAmount += val;
      }
    }

    const remaining = Math.max(0, goal - currentBilled);
    const progressPercent = Math.min(100, Math.round((currentBilled / goal) * 100));

    // Projeção futura com base na Agenda (Agendamentos futuros deste mês)
    const futureAppointments = await prisma.appointment.findMany({
      where: {
        companyId,
        date: { gt: now, lte: lastDay },
        status: { not: "CANCELLED" },
        billable: true,
      },
      select: { price: true },
    });

    const projectedFromAgenda = futureAppointments.reduce(
      (acc, app) => acc + Number(app.price),
      0
    );

    const totalProjected = currentBilled + projectedFromAgenda;
    const projectedProgressPercent = Math.min(100, Math.round((totalProjected / goal) * 100));

    return {
      monthlyGoal: goal,
      currentBilled,
      paidAmount,
      remaining,
      progressPercent,
      projectedFromAgenda,
      totalProjected,
      projectedProgressPercent,
      isGoalReached: currentBilled >= goal,
    };
  }
}
