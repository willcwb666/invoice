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
    const existing = await prisma.appointment.findFirst({ where: { id, companyId } });
    if (!existing) {
      throw new Error("Agendamento não encontrado.");
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
        manuallyEdited: true,
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
