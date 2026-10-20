import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/security/permissions";
import { ProfessionalService, inferCleaningCategory } from "@/services/professional-service";
import { getTargetCompanyId } from "@/lib/company-context";

const BUSINESS_TIMEZONE = "America/Denver";

function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const findVal = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: findVal("year"),
    month: findVal("month"),
    day: findVal("day"),
  };
}

function zonedTimeToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, monthIndex, day, hour, minute, second));
  const invDate = new Date(utcGuess.toLocaleString("en-US", { timeZone: "UTC" }));
  const targetDate = new Date(utcGuess.toLocaleString("en-US", { timeZone }));
  const diff = targetDate.getTime() - invDate.getTime();
  return new Date(utcGuess.getTime() - diff);
}

const CATEGORY_NAMES: Record<string, string> = {
  FUEL: "Combustível / Gasolina",
  CLEANING_SUPPLIES: "Produtos de Limpeza",
  VEHICLE_MAINTENANCE: "Manutenção Veicular",
  EQUIPMENT: "Equipamentos / Máquinas",
  MEALS: "Alimentação em Campo",
  OTHER: "Outras Despesas",
};

export async function GET(req: NextRequest) {
  try {
    const check = await requirePermission(req, "reports", "read");
    if (check.response) return check.response;

    const companyId = await getTargetCompanyId(check.session.companyId);
    const company = { id: companyId };

    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get("type") || "financial"; // "financial" | "appointments"
    const rawStartDate = searchParams.get("startDate");
    const rawEndDate = searchParams.get("endDate");
    const professionalId = searchParams.get("professionalId") || "ALL";
    const clientId = searchParams.get("clientId") || "ALL";
    const status = searchParams.get("status") || "ALL";

    // 1. Resolve Range de Datas no Fuso de Evans/Greeley (Mountain Time)
    const now = new Date();
    const localNow = getZonedDateParts(now, BUSINESS_TIMEZONE);

    let startDate: Date;
    let endDate: Date;

    if (rawStartDate && rawEndDate) {
      const [sY, sM, sD] = rawStartDate.split("-").map(Number);
      const [eY, eM, eD] = rawEndDate.split("-").map(Number);
      startDate = zonedTimeToUtc(sY, sM - 1, sD, 0, 0, 0, BUSINESS_TIMEZONE);
      endDate = zonedTimeToUtc(eY, eM - 1, eD, 23, 59, 59, BUSINESS_TIMEZONE);
    } else {
      // Padrão: Mês Corrente
      startDate = zonedTimeToUtc(localNow.year, localNow.month - 1, 1, 0, 0, 0, BUSINESS_TIMEZONE);
      const lastDayOfMonth = new Date(Date.UTC(localNow.year, localNow.month, 0)).getUTCDate();
      endDate = zonedTimeToUtc(localNow.year, localNow.month - 1, lastDayOfMonth, 23, 59, 59, BUSINESS_TIMEZONE);
    }

    // Carrega profissionais cadastrados para resolução de comissões e nomes
    const allProfessionals = await ProfessionalService.listProfessionals(companyId);

    // =========================================================================
    // RELATÓRIO FINANCEIRO CONSOLIDADO (Ganhos x Gastos x Lucro Real)
    // =========================================================================
    if (reportType === "financial") {
      const [invoices, appointments, expenses] = await Promise.all([
        // Faturas no período
        prisma.invoice.findMany({
          where: {
            companyId: company.id,
            issueDate: { gte: startDate, lte: endDate },
            status: { notIn: ["DRAFT", "CANCELLED"] },
            ...(clientId !== "ALL" ? { clientId } : {}),
            ...(status !== "ALL" ? { status: status as any } : {}),
          },
          include: { client: { select: { id: true, name: true, billingType: true } } },
          orderBy: { issueDate: "desc" },
        }),
        // Atendimentos da agenda no período
        prisma.appointment.findMany({
          where: {
            companyId: company.id,
            date: { gte: startDate, lte: endDate },
            billable: true,
            status: { not: "CANCELLED" },
            ...(clientId !== "ALL" ? { clientId } : {}),
            ...(status === "PAID"
              ? { paid: true }
              : status === "PENDING"
              ? { paid: false }
              : {}),
          },
          include: {
            client: { select: { id: true, name: true, billingType: true } },
            invoice: { select: { id: true, invoiceNumber: true, status: true } },
          },
          orderBy: { date: "desc" },
        }),
        // Despesas operacionais no período
        prisma.expense.findMany({
          where: {
            companyId: company.id,
            date: { gte: startDate, lte: endDate },
          },
          orderBy: { date: "desc" },
        }),
      ]);

      // Enriquece atendimentos com profissionais
      const enrichedAppointments = await ProfessionalService.enrichAppointments(appointments, companyId);

      // Filtra por profissional se selecionado
      const filteredAppointments =
        professionalId !== "ALL"
          ? enrichedAppointments.filter((a) =>
              a.professionalIds.includes(professionalId)
            )
          : enrichedAppointments;

      // 1. Receita Operacional da Agenda (Fonte da Verdade dos Serviços Prestados)
      // Em empresas de limpeza, todo faturamento tem origem nos atendimentos da agenda.
      // As faturas (invoices) são documentos de cobrança desses atendimentos.
      // Para evitar qualquer duplicidade contábil, a Receita Bruta da Operação é a soma dos atendimentos,
      // discriminando o que foi formalizado via Invoice e o que é Cobrança Direta / À Vista.
      let totalGrossRevenue = 0;
      let totalReceived = 0;
      let totalPending = 0;
      let revenueFromInvoices = 0;
      let revenueDirect = 0;
      let totalStaffCommissions = 0;

      const appointmentTransactions: any[] = [];
      const commissionsByProfessional: Record<
        string,
        { id: string; name: string; totalCommission: number; jobCount: number }
      > = {};

      for (const appt of filteredAppointments) {
        const price = Number(appt.price || 0);
        const hasInvoice = Boolean(appt.invoiced || appt.invoiceId || appt.invoice);
        const isPaid = Boolean(appt.paid || appt.invoice?.status === "PAID");

        totalGrossRevenue += price;
        if (hasInvoice) {
          revenueFromInvoices += price;
        } else {
          revenueDirect += price;
        }

        if (isPaid) {
          totalReceived += price;
        } else {
          totalPending += price;
        }

        // Calcula comissões de cada profissional deste atendimento
        const apptCommissions: Array<{
          professionalId: string;
          name: string;
          amount: number;
          ruleLabel: string;
        }> = [];

        for (const p of appt.professionals) {
          const fullProf = allProfessionals.find((pr) => pr.id === p.id);
          if (!fullProf) continue;
          if (professionalId !== "ALL" && fullProf.id !== professionalId) continue;

          const commResult = ProfessionalService.calculateCommissionForJob(
            fullProf,
            price,
            appt.cleaningCategory,
            appt.date
          );

          totalStaffCommissions += commResult.commissionAmount;
          apptCommissions.push({
            professionalId: fullProf.id,
            name: fullProf.name,
            amount: commResult.commissionAmount,
            ruleLabel: `${commResult.ruleValue}${commResult.mode === "PERCENTAGE" ? "%" : "$"} (${commResult.categoryLabel})`,
          });

          if (!commissionsByProfessional[fullProf.id]) {
            commissionsByProfessional[fullProf.id] = {
              id: fullProf.id,
              name: fullProf.name,
              totalCommission: 0,
              jobCount: 0,
            };
          }
          commissionsByProfessional[fullProf.id].totalCommission += commResult.commissionAmount;
          commissionsByProfessional[fullProf.id].jobCount += 1;
        }

        appointmentTransactions.push({
          id: `appt-${appt.id}`,
          date: appt.date.toISOString(),
          type: "INCOME_APPOINTMENT",
          description: appt.title || `Limpeza: ${appt.client?.name || "Cliente"}`,
          clientName: appt.client?.name,
          category: `Atendimento (${appt.cleaningCategory})`,
          grossAmount: price,
          paidAmount: isPaid ? price : 0,
          status: isPaid ? "PAID" : "PENDING",
          invoiced: hasInvoice,
          invoiceNumber: appt.invoice?.invoiceNumber,
          professionals: appt.professionals.map((p) => p.name),
          commissions: apptCommissions,
        });
      }

      // 2. Faturas Emitidas no Período (Instrumentos Formais de Cobrança / Contas a Receber)
      let invoiceGross = 0;
      let invoiceReceived = 0;
      let invoicePending = 0;

      const invoiceTransactions: any[] = [];
      for (const inv of invoices) {
        const total = Number(inv.totalAmount || 0);
        const paid = Number(inv.paidAmount || 0);
        invoiceGross += total;
        if (inv.status === "PAID") invoiceReceived += total;
        else invoicePending += total - paid;

        invoiceTransactions.push({
          id: `inv-${inv.id}`,
          date: inv.issueDate.toISOString(),
          type: "INCOME_INVOICE",
          description: `Fatura #${inv.invoiceNumber || inv.id.slice(0, 6)} - ${inv.client?.name || "Cliente"}`,
          clientName: inv.client?.name,
          category: "Fatura Comercial Emitida",
          grossAmount: total,
          paidAmount: paid,
          status: inv.status,
          paymentMethod: "Zelle / Venmo / Check",
        });
      }

      // 3. Gastos: Despesas Operacionais em Campo + Comissões da Equipe
      let totalOperationalExpenses = 0;
      const expenseByCategoryMap: Record<string, { label: string; amount: number; count: number }> = {};

      const expenseTransactions: any[] = [];
      for (const exp of expenses) {
        const amt = Number(exp.amount || 0);
        totalOperationalExpenses += amt;

        if (!expenseByCategoryMap[exp.category]) {
          expenseByCategoryMap[exp.category] = {
            label: CATEGORY_NAMES[exp.category] || exp.category,
            amount: 0,
            count: 0,
          };
        }
        expenseByCategoryMap[exp.category].amount += amt;
        expenseByCategoryMap[exp.category].count += 1;

        expenseTransactions.push({
          id: `exp-${exp.id}`,
          date: exp.date.toISOString(),
          type: "EXPENSE_OPERATIONAL",
          description: exp.description,
          category: CATEGORY_NAMES[exp.category] || exp.category,
          grossAmount: amt,
          paidAmount: amt,
          status: "PAID",
          paymentMethod: exp.recurrence === "ONE_TIME" ? "Avulso" : `Recorrente (${exp.recurrence})`,
        });
      }

      const totalGastos = totalOperationalExpenses + totalStaffCommissions;
      const netProfit = totalGrossRevenue - totalGastos;
      const netProfitRealized = totalReceived - totalGastos;
      const marginPercent = totalGrossRevenue > 0 ? (netProfit / totalGrossRevenue) * 100 : 0;

      return NextResponse.json({
        success: true,
        type: "financial",
        filters: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          professionalId,
          clientId,
          status,
        },
        kpis: {
          totalGrossRevenue,
          totalReceived,
          totalPending,
          totalOperationalExpenses,
          totalStaffCommissions,
          totalGastos,
          netProfit,
          netProfitRealized,
          marginPercent: Number(marginPercent.toFixed(1)),
          invoiceCount: invoices.length,
          appointmentCount: filteredAppointments.length,
          expenseCount: expenses.length,
        },
        dre: {
          grossRevenueInvoices: revenueFromInvoices,
          grossRevenueAppointments: revenueDirect,
          grossRevenueTotal: totalGrossRevenue,
          invoicesEmittedTotal: invoiceGross,
          invoicesEmittedCount: invoices.length,
          operationalExpenses: totalOperationalExpenses,
          staffCommissions: totalStaffCommissions,
          totalExpenses: totalGastos,
          netProfit,
          marginPercent: Number(marginPercent.toFixed(1)),
          expensesByCategory: Object.values(expenseByCategoryMap).sort((a, b) => b.amount - a.amount),
          commissionsByProfessional: Object.values(commissionsByProfessional).sort((a, b) => b.totalCommission - a.totalCommission),
        },
        transactions: {
          invoices: invoiceTransactions,
          appointments: appointmentTransactions,
          expenses: expenseTransactions,
        },
      });
    }

    // =========================================================================
    // RELATÓRIO OPERACIONAL DE AGENDAMENTOS
    // =========================================================================
    if (reportType === "appointments") {
      const appointments = await prisma.appointment.findMany({
        where: {
          companyId: company.id,
          date: { gte: startDate, lte: endDate },
          ...(clientId !== "ALL" ? { clientId } : {}),
          ...(status !== "ALL" ? { status: status as any } : {}),
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              city: true,
              billingType: true,
            },
          },
          services: {
            include: { service: { select: { name: true, type: true, basePrice: true } } },
          },
        },
        orderBy: { date: "asc" },
      });

      const enriched = await ProfessionalService.enrichAppointments(appointments, companyId);

      const filtered =
        professionalId !== "ALL"
          ? enriched.filter((a) => a.professionalIds.includes(professionalId))
          : enriched;

      let totalProjected = 0;
      let totalRealized = 0;
      let totalCommissions = 0;
      let completedCount = 0;
      let scheduledCount = 0;
      let cancelledCount = 0;

      const items = filtered.map((appt: any) => {
        const price = Number(appt.price || 0);
        totalProjected += price;

        if (appt.status === "COMPLETED") {
          completedCount += 1;
          if (appt.paid) totalRealized += price;
        } else if (appt.status === "SCHEDULED" || appt.status === "IN_PROGRESS") {
          scheduledCount += 1;
        } else if (appt.status === "CANCELLED") {
          cancelledCount += 1;
        }

        // Calcula comissão de cada profissional escalado
        const profCommissions = (appt.professionals || []).map((p: any) => {
          const fullProf = allProfessionals.find((pr) => pr.id === p.id);
          if (!fullProf) return { id: p.id, name: p.name, amount: 0, rule: "" };
          const calc = ProfessionalService.calculateCommissionForJob(
            fullProf,
            price,
            appt.cleaningCategory,
            appt.date
          );
          totalCommissions += calc.commissionAmount;
          return {
            id: fullProf.id,
            name: fullProf.name,
            amount: calc.commissionAmount,
            rule: `${calc.ruleValue}${calc.mode === "PERCENTAGE" ? "%" : "$"}`,
          };
        });

        return {
          id: appt.id,
          title: appt.title,
          date: appt.date.toISOString(),
          endDate: appt.endTime ? appt.endTime.toISOString() : null,
          status: appt.status,
          billable: appt.billable,
          paid: appt.paid,
          invoiced: appt.invoiced,
          origin: appt.origin,
          price,
          address: appt.location || appt.client?.address || "Endereço não informado",
          city: appt.client?.city || "Evans / Greeley",
          client: appt.client ? { id: appt.client.id, name: appt.client.name, phone: appt.client.phone } : null,
          professionals: appt.professionals,
          cleaningCategory: appt.cleaningCategory,
          commissions: profCommissions,
        };
      });

      const averageTicket = items.length > 0 ? totalProjected / items.length : 0;

      return NextResponse.json({
        success: true,
        type: "appointments",
        filters: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          professionalId,
          clientId,
          status,
        },
        kpis: {
          totalCount: items.length,
          completedCount,
          scheduledCount,
          cancelledCount,
          totalProjected,
          totalRealized,
          totalCommissions,
          averageTicket: Number(averageTicket.toFixed(2)),
        },
        items,
      });
    }

    return NextResponse.json({ error: "Tipo de relatório inválido" }, { status: 400 });
  } catch (error: any) {
    console.error("Erro na API de relatórios:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno ao gerar relatório" },
      { status: 500 }
    );
  }
}
