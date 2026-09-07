import { prisma } from "@/lib/prisma";
import { CreateAppointmentInput } from "@/lib/validations/appointment";
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
        service: {
          select: { id: true, name: true },
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

    return prisma.appointment.create({
      data: {
        companyId,
        clientId: data.clientId,
        serviceId: data.serviceId || null,
        title: data.title,
        date: new Date(data.date),
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        location,
        price: new Prisma.Decimal(data.price),
        origin: data.origin,
        notes: data.notes || null,
      },
      include: {
        client: true,
        service: true,
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
        service: true,
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
      include: { service: true },
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
