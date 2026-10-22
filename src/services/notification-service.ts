import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

export interface CreateNotificationInput {
  companyId: string;
  userId?: string;
  professionalId?: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
  metadata?: any;
}

export class NotificationService {
  /**
   * Cria uma nova notificação no sistema
   */
  static async create(input: CreateNotificationInput) {
    try {
      return await prisma.notification.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          professionalId: input.professionalId,
          title: input.title,
          message: input.message,
          type: input.type || "INFO",
          link: input.link,
          metadata: input.metadata,
        },
      });
    } catch (error) {
      console.error("Erro ao criar notificação:", error);
      return null;
    }
  }

  /**
   * Lista as notificações mais recentes da empresa / usuário
   */
  static async list(params: {
    companyId: string;
    userId?: string;
    limit?: number;
    unreadOnly?: boolean;
  }) {
    const { companyId, userId, limit = 20, unreadOnly = false } = params;

    const where: any = { companyId };
    if (userId) {
      where.OR = [{ userId }, { userId: null }];
    }
    if (unreadOnly) {
      where.read = false;
    }

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: {
          companyId,
          read: false,
          ...(userId ? { OR: [{ userId }, { userId: null }] } : {}),
        },
      }),
    ]);

    return {
      items,
      unreadCount,
    };
  }

  /**
   * Marca uma notificação individual como lida. Escopado por companyId
   * para impedir que uma empresa marque como lida uma notificação de
   * outra (IDOR) - updateMany retorna count 0 (sem lançar) quando o id
   * pertence a outra empresa, o que é tratado como "não encontrada".
   */
  static async markAsRead(id: string, companyId: string) {
    try {
      const result = await prisma.notification.updateMany({
        where: { id, companyId },
        data: { read: true },
      });
      return result.count > 0 ? result : null;
    } catch {
      return null;
    }
  }

  /**
   * Marca todas as notificações como lidas
   */
  static async markAllAsRead(companyId: string, userId?: string) {
    try {
      const where: any = { companyId, read: false };
      if (userId) {
        where.OR = [{ userId }, { userId: null }];
      }
      return await prisma.notification.updateMany({
        where,
        data: { read: true },
      });
    } catch {
      return { count: 0 };
    }
  }

  /**
   * Dispara notificação sobre eventos de agendamento (criação, edição, lembrete)
   */
  static async notifyAppointmentChange(params: {
    companyId: string;
    action: "CREATED" | "UPDATED" | "CANCELLED" | "REMINDER";
    appointmentTitle: string;
    appointmentDate: string | Date;
    clientName?: string;
    appointmentId: string;
    professionalNames?: string[];
  }) {
    const dateFormatted = new Date(params.appointmentDate).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Denver",
    });

    const profs = params.professionalNames?.length
      ? ` • Equipe: ${params.professionalNames.join(", ")}`
      : "";

    let title = "";
    let message = "";
    let type: NotificationType = "INFO";

    switch (params.action) {
      case "CREATED":
        title = "Novo Agendamento Confirmado";
        message = `${params.appointmentTitle} com ${params.clientName || "Cliente"} em ${dateFormatted}${profs}`;
        type = "SUCCESS";
        break;
      case "UPDATED":
        title = "Agendamento Alterado";
        message = `Horário ou dados atualizados: ${params.appointmentTitle} em ${dateFormatted}${profs}`;
        type = "INFO";
        break;
      case "CANCELLED":
        title = "Agendamento Cancelado";
        message = `O atendimento "${params.appointmentTitle}" de ${dateFormatted} foi cancelado.`;
        type = "WARNING";
        break;
      case "REMINDER":
        title = "Atendimento Próximo";
        message = `Em breve: ${params.appointmentTitle} com ${params.clientName || "Cliente"} (${dateFormatted})${profs}`;
        type = "URGENT";
        break;
    }

    return await this.create({
      companyId: params.companyId,
      title,
      message,
      type,
      link: `/agenda?date=${encodeURIComponent(new Date(params.appointmentDate).toISOString().split("T")[0])}`,
      metadata: {
        appointmentId: params.appointmentId,
        action: params.action,
        professionalNames: params.professionalNames,
      },
    });
  }
}
