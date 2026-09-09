import { prisma } from "@/lib/prisma";
import { CreateAppointmentInput, UpdateAppointmentInput } from "@/lib/validations/appointment";
import { Prisma } from "@prisma/client";

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
   * Cria um novo agendamento com valor negociável
   */
  static async createAppointment(companyId: string, data: CreateAppointmentInput) {
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, companyId },
    });

    if (!client) {
      throw new Error("Cliente não encontrado.");
    }

    const location = data.location || client.address;

    const services = data.serviceIds.length
      ? await prisma.service.findMany({
          where: { id: { in: data.serviceIds }, companyId },
        })
      : [];

    return prisma.appointment.create({
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
        notes: data.notes || null,
        ...(services.length
          ? { services: { create: services.map((s) => ({ serviceId: s.id, price: s.basePrice })) } }
          : {}),
      },
      include: {
        client: true,
        services: { include: { service: true } },
      },
    });
  }

  /**
   * Edita um agendamento existente (ex: um evento importado do iPhone que o
   * usuário quer corrigir na aplicação) — todo campo é opcional, atualiza só
   * o que veio no payload. Quando `serviceIds` é enviado, substitui todos os
   * vínculos de serviço do agendamento pelos novos (preço de cada um é um
   * novo snapshot do basePrice atual do serviço).
   */
  static async updateAppointment(id: string, companyId: string, data: UpdateAppointmentInput) {
    const existing = await prisma.appointment.findFirst({
      where: { id, companyId },
      include: { services: { select: { serviceId: true } } },
    });
    if (!existing) {
      throw new Error("Agendamento não encontrado.");
    }

    // Once an appointment is linked to an invoice, the invoice's line item
    // is a frozen snapshot of who was billed and how much - silently
    // changing the appointment's client or price afterwards makes the
    // appointment and the invoice that documents it disagree, with no
    // indication either record is now wrong. Everything else (time,
    // location, notes, status, services) is still editable.
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

    // manuallyEdited freezes the appointment out of future iCloud syncs
    // (see icloud.ts) - it should only flip when something actually
    // changed, not on every PATCH regardless of content. Without this, just
    // opening a synced appointment and clicking Save (no real edit) was
    // enough to permanently detach it from the calendar, with no way back.
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
      (newServiceIds !== undefined &&
        (newServiceIds.length !== existingServiceIds.length ||
          newServiceIds.some((id, i) => id !== existingServiceIds[i])));

    return prisma.appointment.update({
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
        ...(data.status !== undefined && { status: data.status }),
        ...(servicesUpdate ? { services: servicesUpdate } : {}),
        ...(somethingChanged ? { manuallyEdited: true } : {}),
      },
      include: {
        client: true,
        services: { include: { service: true } },
      },
    });
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

    return prisma.appointment.update({
      where: { id },
      data: { status },
      include: {
        client: true,
        services: { include: { service: true } },
      },
    });
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
}
