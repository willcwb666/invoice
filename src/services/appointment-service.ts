import { prisma } from "@/lib/prisma";
import { CreateAppointmentInput, UpdateAppointmentInput } from "@/lib/validations/appointment";
import { Prisma } from "@prisma/client";
import { PushService } from "./push-service";
import {
  generateRecurrenceOccurrences,
  generateNextOccurrencesUntil,
  getRecurrenceHorizonBoundary,
  RecurrenceFrequency,
  AppointmentUpdateScope,
  AppointmentDeleteScope,
} from "@/lib/scheduling/recurrence";
import {
  findMultiCleanerConflict,
  ExistingAppointmentWithProfessionals,
} from "@/lib/scheduling/conflict";
import crypto from "crypto";

export class AppointmentService {
  /**
   * Lista compromissos da agenda com paginação e filtro por período
   */
  static async listAppointments(companyId: string, startDate?: Date, endDate?: Date) {
    return prisma.appointment.findMany({
      where: {
        companyId,
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { startTime: "asc" },
      include: {
        client: {
          select: { id: true, name: true, phone: true, address: true, city: true, state: true, zipCode: true },
        },
        services: {
          include: { service: { select: { id: true, name: true, type: true } } },
        },
      },
    });
  }

  /**
   * Obtém os próximos compromissos da agenda a partir da data/hora atual (em ordem cronológica)
   */
  static async getUpcomingAppointments(companyId: string, limit = 5, from?: Date) {
    const threshold = from || new Date(Date.now() - 30 * 60 * 1000);
    return prisma.appointment.findMany({
      where: {
        companyId,
        status: { not: "CANCELLED" },
        endTime: { gte: threshold },
      },
      orderBy: { startTime: "asc" },
      take: limit,
      include: {
        client: {
          select: { id: true, name: true, phone: true, address: true, city: true, state: true, zipCode: true },
        },
        services: {
          include: { service: { select: { id: true, name: true, type: true } } },
        },
      },
    });
  }

  /**
   * Cria um novo agendamento ou uma série recorrente (semanal, bi-semanal, a cada 3 semanas, mensal).
   * Suporta atribuição atômica de múltiplos profissionais e serviços para cada ocorrência da série.
   */
  static async createAppointment(
    companyId: string,
    data: CreateAppointmentInput,
    extra?: { professionalIds?: string[]; cleaningCategory?: string }
  ) {
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, companyId },
    });

    if (!client) {
      throw new Error("Cliente não encontrado.");
    }

    const location = data.location || client.address;
    const entryCode = data.entryCode !== undefined ? data.entryCode : client.entryCode;
    const alarmCode = data.alarmCode !== undefined ? data.alarmCode : client.alarmCode;
    const pets = data.pets !== undefined ? data.pets : client.pets;
    const parkingInstructions = data.parkingInstructions !== undefined ? data.parkingInstructions : client.parkingInstructions;

    const services = data.serviceIds.length
      ? await prisma.service.findMany({
          where: { id: { in: data.serviceIds }, companyId },
        })
      : [];

    const recurrenceRule = (data.recurrenceRule || "NONE") as RecurrenceFrequency;

    // 1. Caso NÃO seja recorrente (atendimento avulso em data única)
    if (recurrenceRule === "NONE") {
      const appt = await prisma.appointment.create({
        data: {
          companyId,
          clientId: data.clientId,
          title: data.title,
          date: new Date(data.date),
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime),
          location,
          price: new Prisma.Decimal(data.price),
          origin: data.origin,
          billable: data.billable,
          status: data.status || "SCHEDULED",
          notes: data.notes || null,
          entryCode: entryCode || null,
          alarmCode: alarmCode || null,
          pets: pets || null,
          parkingInstructions: parkingInstructions || null,
          recurrenceRule: "NONE",
          seriesId: null,
          recurrenceIndex: 0,
          ...(services.length
            ? { services: { create: services.map((s) => ({ serviceId: s.id, price: s.basePrice })) } }
            : {}),
        },
        include: {
          client: true,
          services: { include: { service: true } },
        },
      });

      if (extra?.professionalIds && extra.professionalIds.length > 0) {
        const validProfIds = (
          await prisma.professional.findMany({
            where: { id: { in: extra.professionalIds }, companyId },
            select: { id: true },
          })
        ).map((p) => p.id);

        if (validProfIds.length > 0) {
          await prisma.appointmentProfessional.createMany({
            data: validProfIds.map((pId) => ({
              appointmentId: appt.id,
              professionalId: pId,
              cleaningCategory: extra.cleaningCategory || null,
            })),
          });
        }
      }

      return appt;
    }

    // 2. Caso SEJA recorrente (WEEKLY, BIWEEKLY, EVERY_3_WEEKS, MONTHLY)
    const company = await prisma.companyProfile.findUnique({
      where: { id: companyId },
      select: { recurrenceHorizonMonths: true },
    });
    const horizonMonths = data.recurrenceDurationMonths || company?.recurrenceHorizonMonths || 2;
    const { horizonEndUtc } = getRecurrenceHorizonBoundary({
      referenceDate: new Date(data.startTime),
      horizonMonths,
    });

    const seriesId = crypto.randomUUID();
    const occurrences = generateRecurrenceOccurrences({
      startDateTime: new Date(data.startTime),
      endDateTime: new Date(data.endTime),
      frequency: recurrenceRule,
      untilUtc: horizonEndUtc,
    });

    const validProfIds = extra?.professionalIds?.length
      ? (
          await prisma.professional.findMany({
            where: { id: { in: extra.professionalIds }, companyId },
            select: { id: true },
          })
        ).map((p) => p.id)
      : [];

    const createdAppointments = [];

    for (const occ of occurrences) {
      const appt = await prisma.appointment.create({
        data: {
          companyId,
          clientId: data.clientId,
          title: data.title,
          date: occ.date,
          startTime: occ.startTime,
          endTime: occ.endTime,
          location,
          price: new Prisma.Decimal(data.price),
          origin: data.origin,
          billable: data.billable,
          notes: data.notes || null,
          entryCode: entryCode || null,
          alarmCode: alarmCode || null,
          pets: pets || null,
          parkingInstructions: parkingInstructions || null,
          recurrenceRule,
          seriesId,
          recurrenceIndex: occ.index,
          ...(services.length
            ? { services: { create: services.map((s) => ({ serviceId: s.id, price: s.basePrice })) } }
            : {}),
        },
        include: {
          client: true,
          services: { include: { service: true } },
        },
      });

      if (validProfIds.length > 0) {
        await prisma.appointmentProfessional.createMany({
          data: validProfIds.map((pId) => ({
            appointmentId: appt.id,
            professionalId: pId,
            cleaningCategory: extra?.cleaningCategory || null,
          })),
        });
      }

      createdAppointments.push(appt);
    }

    if (createdAppointments.length > 0) {
      PushService.notifyAgendaChange({
        companyId,
        appointmentId: createdAppointments[0].id,
        action: "CREATED",
      }).catch((err) => console.error("[AppointmentService] Erro ao disparar push de criação:", err));
    }

    return createdAppointments[0];
  }

  /**
   * Edita um agendamento existente com suporte completo a escopos de série recorrente:
   * - "THIS_ONLY": Atualiza apenas a ocorrência pontual.
   * - "THIS_AND_FOLLOWING": Mantém intactos os registros históricos anteriores e reprograma
   *   a rotina daqui para frente (nova data, horário ou frequência bi-semanal/semanal).
   * - "ALL_SERIES": Atualiza campos cadastrais de toda a série não faturada.
   */
  static async updateAppointment(
    id: string,
    companyId: string,
    data: UpdateAppointmentInput,
    extra?: { professionalIds?: string[]; cleaningCategory?: string }
  ) {
    const existing = await prisma.appointment.findFirst({
      where: { id, companyId },
      include: {
        services: { select: { serviceId: true } },
        professionals: { select: { professionalId: true } },
        invoice: { select: { id: true, status: true } },
      },
    });
    if (!existing) {
      throw new Error("Agendamento não encontrado.");
    }

    if (existing.invoiced) {
      if (data.clientId !== undefined && data.clientId !== existing.clientId) {
        throw new Error(
          "Este agendamento já está vinculado a uma fatura - o cliente não pode ser alterado. Cancele/edite a fatura primeiro."
        );
      }
      if (data.price !== undefined && !new Prisma.Decimal(data.price).equals(existing.price)) {
        throw new Error(
          "Este agendamento já está vinculado a uma fatura - o valor não pode ser alterado. Cancele/edite a fatura primeiro."
        );
      }
    }

    const scope: AppointmentUpdateScope = data.updateScope || "THIS_ONLY";

    // =========================================================================
    // CENÁRIO 1: "THIS_AND_FOLLOWING" (Este e todos os futuros da série)
    // =========================================================================
    if (scope === "THIS_AND_FOLLOWING" && existing.seriesId) {
      // 1. Identifica agendamentos futuros da série antiga a partir do horário original deste evento
      const futureAppts = await prisma.appointment.findMany({
        where: {
          companyId,
          seriesId: existing.seriesId,
          startTime: { gte: existing.startTime },
        },
        include: {
          invoice: { select: { status: true } },
        },
      });

      // 2. Remove apenas os que NÃO foram pagos e NÃO estão em fatura PAGA
      const removableIds = futureAppts
        .filter((a) => !a.paid && a.invoice?.status !== "PAID")
        .map((a) => a.id);

      if (removableIds.length > 0) {
        await prisma.appointment.deleteMany({
          where: { id: { in: removableIds } },
        });
      }

      // 3. Determina parâmetros para a nova série
      const targetFrequency = (data.recurrenceRule !== undefined
        ? data.recurrenceRule
        : existing.recurrenceRule || "WEEKLY") as RecurrenceFrequency;

      const baseStart = data.startTime ? new Date(data.startTime) : existing.startTime;
      const baseEnd = data.endTime ? new Date(data.endTime) : existing.endTime;
      const baseDate = data.date ? new Date(data.date) : existing.date;
      const targetTitle = data.title !== undefined ? data.title : existing.title;
      const targetLocation = data.location !== undefined ? data.location : existing.location;
      const targetPrice = data.price !== undefined ? data.price : Number(existing.price);
      const targetNotes = data.notes !== undefined ? data.notes : existing.notes;
      const targetClientId = data.clientId !== undefined ? data.clientId : existing.clientId;
      const targetServiceIds =
        data.serviceIds !== undefined
          ? data.serviceIds
          : existing.services.map((s) => s.serviceId);
      const targetProfIds =
        extra?.professionalIds || existing.professionals.map((p) => p.professionalId);
      const targetCategory = extra?.cleaningCategory;

      // 4. Se a nova frequência for NONE, cria apenas um atendimento avulso no novo dia/horário
      if (targetFrequency === "NONE") {
        return this.createAppointment(
          companyId,
          {
            clientId: targetClientId,
            serviceIds: targetServiceIds,
            title: targetTitle,
            date: baseDate.toISOString(),
            startTime: baseStart.toISOString(),
            endTime: baseEnd.toISOString(),
            location: targetLocation,
            price: targetPrice,
            notes: targetNotes,
            origin: existing.origin,
            billable: existing.billable,
            recurrenceRule: "NONE",
          },
          { professionalIds: targetProfIds, cleaningCategory: targetCategory }
        );
      }

      // 5. Se for recorrente, gera a nova série com novo seriesId a partir da nova data e horário
      return this.createAppointment(
        companyId,
        {
          clientId: targetClientId,
          serviceIds: targetServiceIds,
          title: targetTitle,
          date: baseDate.toISOString(),
          startTime: baseStart.toISOString(),
          endTime: baseEnd.toISOString(),
          location: targetLocation,
          price: targetPrice,
          notes: targetNotes,
          origin: existing.origin,
          billable: existing.billable,
          recurrenceRule: targetFrequency,
          recurrenceDurationMonths: data.recurrenceDurationMonths || 12,
        },
        { professionalIds: targetProfIds, cleaningCategory: targetCategory }
      );
    }

    // Campos "cadastrais" compartilhados pelos cenários 2 (ALL_SERIES) e 3
    // (THIS_ONLY) — calculados uma vez e reaproveitados nos dois.
    let servicesUpdate: Prisma.AppointmentUpdateInput["services"] = undefined;
    if (data.serviceIds) {
      const services = await prisma.service.findMany({
        where: { id: { in: data.serviceIds }, companyId },
      });
      servicesUpdate = {
        deleteMany: {},
        ...(services.length
          ? { create: services.map((s) => ({ serviceId: s.id, price: s.basePrice })) }
          : {}),
      };
    }

    // =========================================================================
    // CENÁRIO 2: "ALL_SERIES" (Todos os agendamentos da série)
    // Aplica os mesmos campos cadastrais do CENÁRIO 3 a toda a série não
    // faturada — não só title/location/price/notes (bug anterior: clientId/
    // serviceIds/status/recurrenceRule só eram aplicados ao agendamento
    // único, contradizendo o docstring "Atualiza campos cadastrais de toda
    // a série"). date/startTime/endTime continuam de responsabilidade só do
    // CENÁRIO 3 — cada ocorrência tem seu próprio horário por definição.
    // =========================================================================
    if (scope === "ALL_SERIES" && existing.seriesId) {
      const updatableSeriesAppts = await prisma.appointment.findMany({
        where: {
          companyId,
          seriesId: existing.seriesId,
          paid: false,
          invoiced: false,
        },
      });

      for (const appt of updatableSeriesAppts) {
        await prisma.appointment.update({
          where: { id: appt.id },
          data: {
            ...(data.title !== undefined && { title: data.title }),
            ...(data.location !== undefined && { location: data.location }),
            ...(data.price !== undefined && { price: new Prisma.Decimal(data.price) }),
            ...(data.notes !== undefined && { notes: data.notes }),
            ...(data.clientId !== undefined && { clientId: data.clientId }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.recurrenceRule !== undefined && { recurrenceRule: data.recurrenceRule }),
            ...(servicesUpdate ? { services: servicesUpdate } : {}),
            manuallyEdited: true,
          },
        });
      }
    }

    // =========================================================================
    // CENÁRIO 3: "THIS_ONLY" (Apenas este agendamento)
    // =========================================================================

    const newServiceIds = data.serviceIds ? [...data.serviceIds].sort() : undefined;
    const existingServiceIds = existing.services.map((s) => s.serviceId).sort();
    const somethingChanged =
      (data.clientId !== undefined && data.clientId !== existing.clientId) ||
      (data.title !== undefined && data.title !== existing.title) ||
      (data.date !== undefined && new Date(data.date).getTime() !== existing.date.getTime()) ||
      (data.startTime !== undefined && new Date(data.startTime).getTime() !== existing.startTime.getTime()) ||
      (data.endTime !== undefined && new Date(data.endTime).getTime() !== existing.endTime.getTime()) ||
      (data.location !== undefined && data.location !== existing.location) ||
      (data.price !== undefined && !new Prisma.Decimal(data.price).equals(existing.price)) ||
      (data.notes !== undefined && data.notes !== existing.notes) ||
      (data.status !== undefined && data.status !== existing.status) ||
      (data.recurrenceRule !== undefined && data.recurrenceRule !== existing.recurrenceRule) ||
      (newServiceIds !== undefined &&
        (newServiceIds.length !== existingServiceIds.length ||
          newServiceIds.some((id, i) => id !== existingServiceIds[i])));

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...(data.clientId !== undefined && { clientId: data.clientId }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.date !== undefined && { date: new Date(data.date) }),
        ...(data.startTime !== undefined && { startTime: new Date(data.startTime) }),
        ...(data.endTime !== undefined && { endTime: new Date(data.endTime) }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.price !== undefined && { price: new Prisma.Decimal(data.price) }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.entryCode !== undefined && { entryCode: data.entryCode }),
        ...(data.alarmCode !== undefined && { alarmCode: data.alarmCode }),
        ...(data.pets !== undefined && { pets: data.pets }),
        ...(data.parkingInstructions !== undefined && { parkingInstructions: data.parkingInstructions }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.recurrenceRule !== undefined && { recurrenceRule: data.recurrenceRule }),
        ...(servicesUpdate ? { services: servicesUpdate } : {}),
        ...(somethingChanged ? { manuallyEdited: true } : {}),
      },
      include: {
        client: true,
        services: { include: { service: true } },
      },
    });

    PushService.notifyAgendaChange({
      companyId,
      appointmentId: updated.id,
      action: updated.status === "CANCELLED" ? "CANCELLED" : "UPDATED",
    }).catch((err) => console.error("[AppointmentService] Erro ao disparar push de atualização:", err));

    return updated;
  }

  /**
   * Exclui um agendamento com suporte a escopos de série recorrente:
   * - "THIS_ONLY": Remove apenas esta ocorrência.
   * - "THIS_AND_FOLLOWING": Mantém o histórico passado intacto e remove este e os futuros não faturados.
   * - "ALL_SERIES": Remove toda a série não faturada.
   */
  static async deleteAppointment(
    id: string,
    companyId: string,
    deleteScope: AppointmentDeleteScope = "THIS_ONLY"
  ) {
    const existing = await prisma.appointment.findFirst({
      where: { id, companyId },
      include: {
        invoice: { select: { id: true, status: true } },
      },
    });

    if (!existing) {
      throw new Error("Agendamento não encontrado.");
    }

    if (existing.paid || existing.invoice?.status === "PAID") {
      throw new Error(
        "Não é possível excluir um atendimento que já foi pago. Cancele o atendimento ou estorne o pagamento primeiro."
      );
    }

    if (deleteScope === "THIS_AND_FOLLOWING" && existing.seriesId) {
      const futureAppts = await prisma.appointment.findMany({
        where: {
          companyId,
          seriesId: existing.seriesId,
          startTime: { gte: existing.startTime },
        },
        include: {
          invoice: { select: { status: true } },
        },
      });

      const removableIds = futureAppts
        .filter((a) => !a.paid && a.invoice?.status !== "PAID")
        .map((a) => a.id);

      if (removableIds.length > 0) {
        await prisma.appointment.deleteMany({
          where: { id: { in: removableIds } },
        });
      }

      // Desativa a regra de recorrência das ocorrências restantes passadas
      // para evitar que o horizonte rolling window volte a estender essa série cancelada
      await prisma.appointment.updateMany({
        where: {
          companyId,
          seriesId: existing.seriesId,
        },
        data: {
          recurrenceRule: "NONE",
        },
      });

      return { count: removableIds.length };
    }

    if (deleteScope === "ALL_SERIES" && existing.seriesId) {
      const seriesAppts = await prisma.appointment.findMany({
        where: {
          companyId,
          seriesId: existing.seriesId,
        },
        include: {
          invoice: { select: { status: true } },
        },
      });

      const removableIds = seriesAppts
        .filter((a) => !a.paid && a.invoice?.status !== "PAID")
        .map((a) => a.id);

      if (removableIds.length > 0) {
        await prisma.appointment.deleteMany({
          where: { id: { in: removableIds } },
        });
      }

      return { count: removableIds.length };
    }

    // Default: THIS_ONLY
    await prisma.appointment.delete({
      where: { id },
    });

    PushService.notifyAgendaChange({
      companyId,
      appointmentId: id,
      action: "CANCELLED",
      fallbackData: {
        clientName: existing.title,
        startTime: existing.startTime,
        location: existing.location,
      },
    }).catch((err) => console.error("[AppointmentService] Erro ao disparar push de cancelamento:", err));

    return { count: 1 };
  }

  /**
   * Marca agendamento como concluído ou atualiza status
   */
  static async completeAppointment(
    id: string,
    companyId?: string,
    status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" = "COMPLETED"
  ) {
    if (companyId) {
      const appt = await prisma.appointment.findFirst({
        where: { id, companyId },
      });

      if (!appt) {
        throw new Error("Agendamento não encontrado.");
      }
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status },
      include: {
        client: true,
        services: { include: { service: true } },
      },
    });

    if (status === "CANCELLED") {
      PushService.notifyAgendaChange({
        companyId: updated.companyId,
        appointmentId: updated.id,
        action: "CANCELLED",
      }).catch((err) => console.error("[AppointmentService] Erro ao disparar push de cancelamento:", err));
    }

    return updated;
  }

  /**
   * Busca agendamentos concluídos que ainda não foram faturados para um cliente
   */
  static async getUninvoicedAppointments(clientId: string, companyId: string) {
    return prisma.appointment.findMany({
      where: {
        clientId,
        companyId,
        status: "COMPLETED",
        invoiced: false,
      },
      orderBy: { date: "asc" },
      include: { services: { include: { service: true } } },
    });
  }

  /**
   * Verifica se há conflito de horário para os profissionais especificados.
   */
  static async checkSchedulingConflict(params: {
    companyId: string;
    startTime: Date | string;
    endTime: Date | string;
    professionalIds?: string[];
    excludeAppointmentId?: string;
  }) {
    const { companyId, startTime, endTime, professionalIds, excludeAppointmentId } = params;
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return { hasConflict: false };
    }

    const candidates = await prisma.appointment.findMany({
      where: {
        companyId,
        status: { notIn: ["CANCELLED"] },
        id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
        startTime: { lt: end },
        endTime: { gt: start },
      },
      include: {
        client: { select: { id: true, name: true } },
        professionals: {
          include: {
            professional: { select: { id: true, name: true } },
          },
        },
      },
    });

    const formattedExisting: ExistingAppointmentWithProfessionals[] = candidates.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      startTime: c.startTime,
      endTime: c.endTime,
      professionalIds: c.professionals.map((p) => p.professionalId),
      clientName: c.client?.name,
    }));

    const conflict = findMultiCleanerConflict(
      { startTime: start, endTime: end, professionalIds },
      formattedExisting,
      excludeAppointmentId
    );

    if (!conflict) {
      return { hasConflict: false };
    }

    const matchedDb = candidates.find((c) => c.id === conflict.id);
    const professionalNames = matchedDb?.professionals.map((p) => p.professional.name) || [];

    return {
      hasConflict: true,
      conflictingAppointment: {
        id: conflict.id,
        title: conflict.title,
        startTime: conflict.startTime,
        endTime: conflict.endTime,
        clientName: conflict.clientName,
        professionalNames,
      },
    };
  }

  /**
   * Gera links de navegação para GPS
   */
  static getNavigationLinks(address: string) {
    const encoded = encodeURIComponent(address);
    return {
      appleMaps: `https://maps.apple.com/?daddr=${encoded}`,
      googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
      waze: `https://waze.com/ul?q=${encoded}`,
    };
  }

  private static lastHorizonCheck = new Map<string, number>();

  /**
   * Garante que todas as séries recorrentes ativas da empresa estejam geradas até o
   * limite do horizonte configurado (ex: 2 meses à frente).
   * 
   * Ao virar o mês ou quando a série atinge o último mês da janela, este método
   * estende automaticamente os novos atendimentos no fuso de Denver, mantendo o
   * banco de dados enxuto e a agenda sempre abastecida sem intervenção manual.
   */
  static async ensureRecurrenceHorizon(companyId: string, force = false) {
    const now = Date.now();
    const lastCheck = this.lastHorizonCheck.get(companyId) || 0;
    // Debounce de 60 segundos por empresa para performance máxima
    if (!force && now - lastCheck < 60_000) {
      return { extendedSeriesCount: 0, newAppointmentsCount: 0 };
    }
    this.lastHorizonCheck.set(companyId, now);

    try {
      const company = await prisma.companyProfile.findUnique({
        where: { id: companyId },
        select: { recurrenceHorizonMonths: true },
      });

      const horizonMonths = company?.recurrenceHorizonMonths || 2;
      const { horizonEndUtc } = getRecurrenceHorizonBoundary({ horizonMonths });

      // Busca a última ocorrência de cada série recorrente ativa
      const activeSeriesLastAppts = await prisma.appointment.findMany({
        where: {
          companyId,
          seriesId: { not: null },
          recurrenceRule: { notIn: ["NONE", ""] },
          status: { not: "CANCELLED" },
        },
        orderBy: { startTime: "desc" },
        distinct: ["seriesId"],
        include: {
          services: true,
          professionals: true,
        },
      });

      let newAppointmentsCount = 0;
      let extendedSeriesCount = 0;

      for (const lastAppt of activeSeriesLastAppts) {
        if (!lastAppt.seriesId || !lastAppt.recurrenceRule) continue;

        // Se a última ocorrência já atinge ou ultrapassa o final do horizonte, está atualizado
        if (lastAppt.startTime.getTime() >= horizonEndUtc.getTime()) {
          continue;
        }

        const nextOccurrences = generateNextOccurrencesUntil({
          lastOccurrenceStartTime: lastAppt.startTime,
          lastOccurrenceEndTime: lastAppt.endTime,
          frequency: lastAppt.recurrenceRule as RecurrenceFrequency,
          untilUtc: horizonEndUtc,
          startIndex: (lastAppt.recurrenceIndex ?? 0) + 1,
        });

        if (nextOccurrences.length === 0) continue;

        extendedSeriesCount++;

        for (const occ of nextOccurrences) {
          const createdAppt = await prisma.appointment.create({
            data: {
              companyId,
              clientId: lastAppt.clientId,
              title: lastAppt.title,
              date: occ.date,
              startTime: occ.startTime,
              endTime: occ.endTime,
              location: lastAppt.location,
              price: lastAppt.price,
              origin: "INTERNAL",
              billable: lastAppt.billable,
              notes: lastAppt.notes,
              recurrenceRule: lastAppt.recurrenceRule,
              seriesId: lastAppt.seriesId,
              recurrenceIndex: occ.index,
              ...(lastAppt.services.length > 0
                ? {
                    services: {
                      create: lastAppt.services.map((s) => ({
                        serviceId: s.serviceId,
                        price: s.price,
                      })),
                    },
                  }
                : {}),
            },
          });

          if (lastAppt.professionals.length > 0) {
            await prisma.appointmentProfessional.createMany({
              data: lastAppt.professionals.map((p) => ({
                appointmentId: createdAppt.id,
                professionalId: p.professionalId,
                cleaningCategory: p.cleaningCategory,
              })),
            });
          }

          newAppointmentsCount++;
        }
      }

      return { extendedSeriesCount, newAppointmentsCount };
    } catch (err) {
      console.error("Erro ao estender horizonte de recorrência da agenda:", err);
      return { extendedSeriesCount: 0, newAppointmentsCount: 0 };
    }
  }
}
