import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { PushSubscription } from "@prisma/client";

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    type?: string;
    appointmentId?: string;
    [key: string]: unknown;
  };
  actions?: Array<{ action: string; title: string }>;
}

export interface SaveSubscriptionInput {
  companyId: string;
  userId?: string;
  professionalId?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

let isVapidConfigured = false;

function configureVapid(): boolean {
  if (isVapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@renatamatoscleaning.com";

  if (!publicKey || !privateKey) {
    console.warn("[PushService] VAPID keys not configured in environment variables.");
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    isVapidConfigured = true;
    return true;
  } catch (error) {
    console.error("[PushService] Failed to set VAPID details:", error);
    return false;
  }
}

export class PushService {
  /**
   * Salva ou atualiza a inscrição do dispositivo para receber pushes
   */
  static async saveSubscription(input: SaveSubscriptionInput) {
    return prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      update: {
        companyId: input.companyId,
        userId: input.userId,
        professionalId: input.professionalId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
      },
      create: {
        companyId: input.companyId,
        userId: input.userId,
        professionalId: input.professionalId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
      },
    });
  }

  /**
   * Remove a inscrição de um dispositivo (ex: logout ou revogação de permissão)
   */
  static async removeSubscription(endpoint: string, companyId?: string) {
    try {
      if (companyId) {
        await prisma.pushSubscription.deleteMany({
          where: { endpoint, companyId },
        });
      } else {
        await prisma.pushSubscription.deleteMany({
          where: { endpoint },
        });
      }
    } catch (err) {
      console.error("[PushService] Error removing subscription:", err);
    }
  }

  /**
   * Envia uma notificação Web Push direta para uma inscrição específica.
   * Se o endpoint tiver sido invalidado pelo navegador (410 Gone / 404),
   * remove automaticamente o registro do banco.
   */
  static async sendPush(subscription: PushSubscription, payload: PushPayload): Promise<boolean> {
    if (!configureVapid()) return false;

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/icons/icon-192x192.png",
      badge: payload.badge || "/icons/icon-72x72.png",
      tag: payload.tag || "rm-push-notification",
      data: payload.data || { url: "/agenda" },
      actions: payload.actions,
    });

    try {
      await webpush.sendNotification(pushSubscription, notificationPayload, {
        TTL: 14400, // 4 horas
      });
      return true;
    } catch (error: any) {
      if (error?.statusCode === 410 || error?.statusCode === 404) {
        console.log(`[PushService] Subscription expired (${error.statusCode}). Removing endpoint: ${subscription.endpoint}`);
        await prisma.pushSubscription.deleteMany({
          where: { endpoint: subscription.endpoint },
        }).catch(() => {});
      } else {
        console.error("[PushService] Error delivering push:", error?.message || error);
      }
      return false;
    }
  }

  /**
   * Envia notificação para todos os dispositivos registrados de uma profissional
   */
  static async sendToProfessional(
    companyId: string,
    professionalId: string,
    payload: PushPayload
  ): Promise<number> {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        companyId,
        professionalId,
      },
    });

    if (subscriptions.length === 0) return 0;

    const results = await Promise.allSettled(
      subscriptions.map((sub) => this.sendPush(sub, payload))
    );

    return results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  }

  /**
   * Envia notificação para todos os dispositivos de um usuário
   */
  static async sendToUser(
    companyId: string,
    userId: string,
    payload: PushPayload
  ): Promise<number> {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        companyId,
        userId,
      },
    });

    if (subscriptions.length === 0) return 0;

    const results = await Promise.allSettled(
      subscriptions.map((sub) => this.sendPush(sub, payload))
    );

    return results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  }

  /**
   * Envia transmissão para todos os dispositivos de uma empresa (admins e profissionais)
   */
  static async sendToCompany(companyId: string, payload: PushPayload): Promise<number> {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { companyId },
    });

    if (subscriptions.length === 0) return 0;

    const results = await Promise.allSettled(
      subscriptions.map((sub) => this.sendPush(sub, payload))
    );

    return results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  }

  /**
   * Notifica alterações em tempo real na agenda (criação, edição ou cancelamento)
   */
  static async notifyAgendaChange(params: {
    companyId: string;
    appointmentId: string;
    action: "CREATED" | "UPDATED" | "CANCELLED";
    fallbackData?: {
      clientName?: string;
      date?: Date;
      startTime?: Date;
      location?: string | null;
      professionalIds?: string[];
    };
  }) {
    const { companyId, appointmentId, action, fallbackData } = params;

    try {
      // 1. Se foi alterado ou cancelado, limpa qualquer aviso de saída agendado pendente
      if (action === "UPDATED" || action === "CANCELLED") {
        await prisma.scheduledPush.deleteMany({
          where: { appointmentId, sent: false },
        }).catch(() => {});
      }

      // 2. Busca os dados completos do agendamento se ainda existir no banco
      const appt = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          client: { select: { name: true } },
          professionals: { select: { professionalId: true } },
        },
      });

      const clientName = appt?.client?.name || fallbackData?.clientName || "Cliente";
      const startTime = appt?.startTime || fallbackData?.startTime || new Date();
      const location = appt?.location || fallbackData?.location || "";
      const assignedProfIds =
        appt?.professionals.map((p) => p.professionalId) ||
        fallbackData?.professionalIds ||
        [];

      const timeStr = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Denver",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(startTime));

      const dateStr = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Denver",
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(startTime));

      let title = "Atualização na Agenda";
      let body = `Alteração no atendimento de ${clientName}`;

      if (action === "CREATED") {
        title = `Novo Agendamento: ${clientName}`;
        body = `Marcado para ${dateStr} às ${timeStr}${location ? ` em ${location}` : ""}.`;
      } else if (action === "UPDATED") {
        title = `Agenda Alterada: ${clientName}`;
        body = `Horário ajustado para ${dateStr} às ${timeStr}${location ? ` em ${location}` : ""}.`;
      } else if (action === "CANCELLED") {
        title = `Agendamento Cancelado: ${clientName}`;
        body = `O atendimento de ${dateStr} às ${timeStr} foi cancelado.`;
      }

      const payload: PushPayload = {
        title,
        body,
        tag: `agenda-change-${appointmentId}`,
        data: {
          url: "/agenda",
          type: "AGENDA_CHANGE",
          appointmentId,
        },
      };

      // Dispara push para as profissionais escaladas
      if (assignedProfIds.length > 0) {
        await Promise.allSettled(
          assignedProfIds.map((pId) => this.sendToProfessional(companyId, pId, payload))
        );
      } else {
        // Se não houver profissional específica escalada, transmite para a empresa
        await this.sendToCompany(companyId, payload);
      }
    } catch (err) {
      console.error("[PushService] Erro ao notificar alteração de agenda:", err);
    }
  }
}
