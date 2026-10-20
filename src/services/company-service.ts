import { prisma } from "@/lib/prisma";
import { BUSINESS_TIMEZONE, zonedPartsFromUtc, zonedTimeToUtc } from "@/lib/calendar/timezone";

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
   * Progresso da Meta de Faturamento (Semanal ou Mensal) com Projeção da Agenda
   * 
   * Semanal: estritamente de Domingo a Sábado da semana corrente (Mountain Time).
   * Mensal: estritamente do primeiro ao último dia do mês corrente (Mountain Time).
   * 
   * A meta e o restante são calculados pelo total agendado (faturado + agenda futura),
   * pois na operação de limpeza todo agendamento executado é pago imediatamente.
   */
  static async getGoalProgress(companyId: string, period: "weekly" | "monthly" = "monthly") {
    const company = await prisma.companyProfile.findUnique({
      where: { id: companyId },
      select: { monthlyRevenueGoal: true },
    });

    const monthlyGoal = company ? Number(company.monthlyRevenueGoal) : 6000;
    const goal = period === "weekly" ? Math.round((monthlyGoal / 4) * 100) / 100 : monthlyGoal;

    const now = new Date();
    const localNow = zonedPartsFromUtc(now, BUSINESS_TIMEZONE);
    let startDate: Date;
    let endDate: Date;

    if (period === "weekly") {
      // Semana de Domingo a Sábado no fuso do Colorado
      const currentDayDate = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day));
      const dayOfWeek = currentDayDate.getUTCDay(); // 0 = Domingo, ..., 6 = Sábado

      const sundayUtc = new Date(currentDayDate);
      sundayUtc.setUTCDate(sundayUtc.getUTCDate() - dayOfWeek);
      startDate = zonedTimeToUtc(
        sundayUtc.getUTCFullYear(),
        sundayUtc.getUTCMonth(),
        sundayUtc.getUTCDate(),
        0, 0, 0,
        BUSINESS_TIMEZONE
      );

      const saturdayUtc = new Date(sundayUtc);
      saturdayUtc.setUTCDate(sundayUtc.getUTCDate() + 6);
      endDate = zonedTimeToUtc(
        saturdayUtc.getUTCFullYear(),
        saturdayUtc.getUTCMonth(),
        saturdayUtc.getUTCDate(),
        23, 59, 59,
        BUSINESS_TIMEZONE
      );
    } else {
      // Mês corrente do 1º ao último dia no fuso do Colorado
      startDate = zonedTimeToUtc(localNow.year, localNow.month - 1, 1, 0, 0, 0, BUSINESS_TIMEZONE);
      // Dia 0 do próximo mês devolve o último dia do mês corrente
      const lastDayOfMonth = new Date(Date.UTC(localNow.year, localNow.month, 0)).getUTCDate();
      endDate = zonedTimeToUtc(localNow.year, localNow.month - 1, lastDayOfMonth, 23, 59, 59, BUSINESS_TIMEZONE);
    }

    // Faturamento e Agenda do período
    // A Agenda é a fonte da verdade da operação (todos os atendimentos agendados para o período)
    const [allAppointmentsAgg, completedAppointmentsAgg, paidAppointmentsAgg] = await Promise.all([
      // Todos os agendamentos da agenda no período (sem cancelados)
      prisma.appointment.aggregate({
        where: {
          companyId,
          date: { gte: startDate, lte: endDate },
          status: { not: "CANCELLED" },
          billable: true,
        },
        _sum: { price: true },
        _count: { id: true },
      }),
      // Atendimentos já concluídos na agenda neste período
      prisma.appointment.aggregate({
        where: {
          companyId,
          date: { gte: startDate, lte: endDate },
          status: "COMPLETED",
          billable: true,
        },
        _sum: { price: true },
        _count: { id: true },
      }),
      // Atendimentos já pagos (direto ou faturados pagos)
      prisma.appointment.aggregate({
        where: {
          companyId,
          date: { gte: startDate, lte: endDate },
          status: { not: "CANCELLED" },
          billable: true,
          OR: [{ paid: true }, { invoice: { status: "PAID" } }],
        },
        _sum: { price: true },
        _count: { id: true },
      }),
    ]);

    // Atendimentos agendados na agenda para este período (soma total de todos os agendamentos do mês/semana)
    const totalAgenda = Number(allAppointmentsAgg._sum.price || 0);
    const completedAmount = Number(completedAppointmentsAgg._sum.price || 0);
    const paidAmount = Number(paidAppointmentsAgg._sum.price || 0);

    // O total previsto e acompanhado é o valor real da Agenda no período (sem duplicar faturas)
    const totalProjected = totalAgenda;
    const projectedFromAgenda = totalAgenda;
    const currentBilled = completedAmount;

    // O restante é calculado pelo que está agendado e não apenas pelo faturado
    const remaining = Math.max(0, goal - totalProjected);
    const progressPercent = goal > 0 ? Math.min(100, Math.round((totalProjected / goal) * 100)) : 0;
    const billedPercent = totalProjected > 0 ? Math.min(100, Math.round((currentBilled / totalProjected) * 100)) : 0;

    return {
      period,
      targetGoal: goal,
      monthlyGoal,
      currentBilled,
      paidAmount,
      remaining,
      progressPercent,
      billedPercent,
      projectedFromAgenda,
      totalProjected,
      projectedProgressPercent: progressPercent,
      isGoalReached: totalProjected >= goal,
    };
  }

  static async getMonthlyGoalProgress(companyId: string) {
    return this.getGoalProgress(companyId, "monthly");
  }
}
