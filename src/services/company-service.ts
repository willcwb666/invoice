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

    // Faturamento do mês, agregado no banco (uma linha por status/por
    // paid, não uma linha por fatura/agendamento) em vez de trazer cada
    // registro pra somar em JS.
    const [invoiceStatusTotals, apptPaidTotals, futureAgg] = await Promise.all([
      prisma.invoice.groupBy({
        by: ["status"],
        where: { companyId, issueDate: { gte: firstDay, lte: lastDay } },
        _sum: { totalAmount: true },
      }),
      // A maioria dos clientes nunca recebe uma Invoice - eles pagam direto
      // pela limpeza (ver PaymentService). invoiced=false evita contar de
      // novo um atendimento que já virou item de uma fatura (já somado
      // acima).
      prisma.appointment.groupBy({
        by: ["paid"],
        where: {
          companyId,
          date: { gte: firstDay, lte: lastDay },
          billable: true,
          status: "COMPLETED",
          invoiced: false,
        },
        _sum: { price: true },
      }),
      // Projeção futura com base na Agenda (Agendamentos futuros deste mês)
      prisma.appointment.aggregate({
        where: {
          companyId,
          date: { gt: now, lte: lastDay },
          status: { not: "CANCELLED" },
          billable: true,
        },
        _sum: { price: true },
      }),
    ]);

    let currentBilled = 0;
    let paidAmount = 0;

    for (const row of invoiceStatusTotals) {
      const val = Number(row._sum.totalAmount || 0);
      // DRAFT invoices haven't been issued to the client yet and CANCELLED
      // ones never will be - neither counts toward the billed goal.
      if (row.status !== "CANCELLED" && row.status !== "DRAFT") {
        currentBilled += val;
      }
      if (row.status === "PAID") {
        paidAmount += val;
      }
    }

    for (const row of apptPaidTotals) {
      const val = Number(row._sum.price || 0);
      currentBilled += val;
      if (row.paid) {
        paidAmount += val;
      }
    }

    const remaining = Math.max(0, goal - currentBilled);
    const progressPercent = Math.min(100, Math.round((currentBilled / goal) * 100));

    const projectedFromAgenda = Number(futureAgg._sum.price || 0);

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
