import { prisma } from "@/lib/prisma";
import { extractCityFromAddress, getTravelTimeMinutes } from "@/lib/routing/travel-time";
import { PushService } from "./push-service";

export interface ProcessLocationInput {
  companyId: string;
  professionalId?: string;
  userId?: string;
  latitude?: number;
  longitude?: number;
  lastAppointmentId?: string;
}

export interface DepartureResult {
  hasUpcoming: boolean;
  appointmentId?: string;
  clientName?: string;
  destinationCity?: string;
  originLocation?: string;
  nextStartTime?: Date;
  departureTime?: Date;
  driveMinutes?: number;
  alert1ScheduledFor?: Date;
  alert2ScheduledFor?: Date;
  isImmediateNotification?: boolean;
  message?: string;
}

const NOCO_CITY_COORDINATES: Array<{ city: string; lat: number; lng: number }> = [
  { city: "evans", lat: 40.38, lng: -104.6922 },
  { city: "greeley", lat: 40.4233, lng: -104.7091 },
  { city: "garden_city", lat: 40.395, lng: -104.69 },
  { city: "windsor", lat: 40.4775, lng: -104.9014 },
  { city: "timnath", lat: 40.5283, lng: -104.9808 },
  { city: "severance", lat: 40.5247, lng: -104.8511 },
  { city: "fort_collins", lat: 40.5853, lng: -105.0844 },
  { city: "loveland", lat: 40.3978, lng: -105.075 },
  { city: "johnstown", lat: 40.3369, lng: -104.9122 },
  { city: "milliken", lat: 40.3294, lng: -104.8553 },
  { city: "eaton", lat: 40.5294, lng: -104.7108 },
];

function findClosestCity(lat: number, lng: number): string {
  let closest = "greeley";
  let minDistance = Infinity;

  for (const item of NOCO_CITY_COORDINATES) {
    const dLat = lat - item.lat;
    const dLng = lng - item.lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistance) {
      minDistance = distSq;
      closest = item.city;
    }
  }

  return closest;
}

let lastDispatchTimestamp = 0;

export class DepartureReminderService {
  /**
   * Obtém o endereço padrão cadastrado em Configurações (ex: casa da profissional / base)
   */
  static async getHomeOriginAddress(companyId: string): Promise<string> {
    const defaultAddress = await prisma.companyAddress.findFirst({
      where: { companyId, isDefault: true },
      select: { street: true, city: true, state: true },
    });

    if (defaultAddress?.city) {
      return `${defaultAddress.street || ""}, ${defaultAddress.city}`;
    }

    const anyAddress = await prisma.companyAddress.findFirst({
      where: { companyId },
      select: { street: true, city: true },
    });

    if (anyAddress?.city) {
      return `${anyAddress.street || ""}, ${anyAddress.city}`;
    }

    return "Evans, CO"; // Padrão da sede
  }

  /**
   * Varre e sincroniza os lembretes de saída para TODOS os atendimentos do dia
   * de cada empresa (Casa 1, Casa 2, Casa 3, etc.).
   *
   * Rota encadeada:
   * - Casa 1: sai de Casa (Endereço Padrão em Configurações) -> Casa 1
   * - Casa 2: sai da Casa 1 -> Casa 2
   * - Casa 3: sai da Casa 2 -> Casa 3
   */
  static async syncDailyReminders(targetCompanyId?: string): Promise<{
    companiesChecked: number;
    remindersCreated: number;
    appointmentsProcessed: number;
  }> {
    const now = new Date();
    const broadStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const broadEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const todayDenverStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Denver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const companies = await prisma.companyProfile.findMany({
      where: targetCompanyId ? { id: targetCompanyId } : {},
      select: { id: true, name: true },
    });

    let remindersCreated = 0;
    let appointmentsProcessed = 0;

    for (const comp of companies) {
      const homeAddress = await this.getHomeOriginAddress(comp.id);

      const candidateAppts = await prisma.appointment.findMany({
        where: {
          companyId: comp.id,
          date: { gte: broadStart, lte: broadEnd },
          status: { in: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"] },
        },
        include: {
          client: { select: { name: true, address: true, city: true } },
          professionals: { select: { professionalId: true } },
        },
        orderBy: { startTime: "asc" },
      });

      // Filtra exatamente os atendimentos que caem no dia de hoje em America/Denver
      const todayAppts = candidateAppts.filter((a) => {
        const dStr = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Denver",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(a.date || a.startTime));
        return dStr === todayDenverStr;
      });

      if (todayAppts.length === 0) continue;

      for (let i = 0; i < todayAppts.length; i++) {
        const appt = todayAppts[i];
        appointmentsProcessed++;

        // Origem: se for a 1ª casa sai de casa; se for casa 2+, sai da casa anterior!
        const prev = i > 0 ? todayAppts[i - 1] : null;
        const origin = prev
          ? prev.location || prev.client?.address || prev.client?.city || homeAddress
          : homeAddress;

        const destination = appt.location || appt.client?.address || appt.client?.city || "Greeley";

        // Calcula tempo de viagem com +5 min de buffer para trânsito
        const driveMinutes = await getTravelTimeMinutes(origin, destination, 5);

        const appointmentStart = new Date(appt.startTime);
        const departureTime = new Date(appointmentStart.getTime() - driveMinutes * 60 * 1000);

        // Alerta 1: 30 minutos antes do horário de saída
        const alert1Time = new Date(departureTime.getTime() - 30 * 60 * 1000);
        // Alerta 2: 10 minutos antes do horário de saída
        const alert2Time = new Date(departureTime.getTime() - 10 * 60 * 1000);

        const clientName = appt.client?.name || appt.title || "Cliente";
        const originCity = extractCityFromAddress(origin);
        const destCity = extractCityFromAddress(destination);

        const apptTimeStr = new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Denver",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(appointmentStart);

        const departureTimeStr = new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Denver",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(departureTime);

        const targetProfId = appt.professionals[0]?.professionalId || null;

        // Títulos e corpos dos alertas
        const titleAlert1 = `Preparar saída: ${clientName} (${apptTimeStr})`;
        const bodyAlert1 = `Agenda às ${apptTimeStr}. Viagem: ~${driveMinutes} min (${originCity} → ${destCity}). Saída recomendada às ${departureTimeStr}. Trânsito moderado, tempo nublado.`;

        const titleAlert2 = `Atenção: saída em 10 minutos!`;
        const bodyAlert2 = `Hora de sair às ${departureTimeStr} para chegar às ${apptTimeStr} em ${clientName} (${destCity}).`;

        // 1. Verifica ou cria Alerta 1
        const existingAlert1 = await prisma.scheduledPush.findFirst({
          where: {
            appointmentId: appt.id,
            type: "DEPARTURE_REMINDER",
            title: titleAlert1,
          },
        });

        if (!existingAlert1) {
          await prisma.scheduledPush.create({
            data: {
              companyId: comp.id,
              professionalId: targetProfId,
              appointmentId: appt.id,
              type: "DEPARTURE_REMINDER",
              title: titleAlert1,
              body: bodyAlert1,
              url: "/agenda",
              scheduledFor: alert1Time,
              sent: false,
            },
          });
          remindersCreated++;
        }

        // 2. Verifica ou cria Alerta 2
        const existingAlert2 = await prisma.scheduledPush.findFirst({
          where: {
            appointmentId: appt.id,
            type: "DEPARTURE_REMINDER",
            title: titleAlert2,
          },
        });

        if (!existingAlert2) {
          await prisma.scheduledPush.create({
            data: {
              companyId: comp.id,
              professionalId: targetProfId,
              appointmentId: appt.id,
              type: "DEPARTURE_REMINDER",
              title: titleAlert2,
              body: bodyAlert2,
              url: "/agenda",
              scheduledFor: alert2Time,
              sent: false,
            },
          });
          remindersCreated++;
        }
      }
    }

    return {
      companiesChecked: companies.length,
      appointmentsProcessed,
      remindersCreated,
    };
  }

  /**
   * Despacha todos os ScheduledPushes pendentes cuja data scheduledFor já foi atingida.
   * Envia Web Push para o celular e cria notificação in-app (sino da aplicação).
   */
  static async dispatchPendingReminders(): Promise<number> {
    const now = new Date();
    const pendingPushes = await prisma.scheduledPush.findMany({
      where: {
        scheduledFor: { lte: now },
        sent: false,
      },
      take: 50,
      orderBy: { scheduledFor: "asc" },
    });

    let sentCount = 0;

    for (const item of pendingPushes) {
      try {
        const payload = {
          title: item.title,
          body: item.body,
          tag: `scheduled-${item.id}`,
          data: {
            url: item.url || "/agenda",
            type: item.type,
            appointmentId: item.appointmentId || undefined,
          },
        };

        // Envia para a empresa inteira (garante que admin e todos os dispositivos recebam)
        await PushService.sendToCompany(item.companyId, payload);

        // Se houver profissional atribuído com subscrição separada, envia também
        if (item.professionalId) {
          await PushService.sendToProfessional(item.companyId, item.professionalId, payload);
        }

        await prisma.scheduledPush.update({
          where: { id: item.id },
          data: { sent: true, sentAt: new Date() },
        });

        sentCount++;
      } catch (err) {
        console.error(`[DepartureReminderService] Erro ao despachar push ${item.id}:`, err);
      }
    }

    return sentCount;
  }

  /**
   * Sincroniza e despacha em uma única chamada com controle de debounce (máx 1x a cada 15s).
   */
  static async syncAndDispatch(targetCompanyId?: string): Promise<{
    synced: number;
    dispatched: number;
  }> {
    const nowMs = Date.now();
    if (nowMs - lastDispatchTimestamp < 15000) {
      return { synced: 0, dispatched: 0 };
    }
    lastDispatchTimestamp = nowMs;

    const syncResult = await this.syncDailyReminders(targetCompanyId);
    const dispatched = await this.dispatchPendingReminders();

    return {
      synced: syncResult.remindersCreated,
      dispatched,
    };
  }

  /**
   * Processa a rota para o próximo cliente do dia quando o celular envia coordenadas GPS
   */
  static async processLocationUpdate(input: ProcessLocationInput): Promise<DepartureResult> {
    const { companyId, latitude, longitude, lastAppointmentId } = input;
    let professionalId = input.professionalId;

    if (!professionalId && input.userId) {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      });
      if (user?.email) {
        const prof = await prisma.professional.findFirst({
          where: { companyId, email: user.email },
          select: { id: true },
        });
        if (prof) professionalId = prof.id;
      }
    }

    const now = new Date();
    const broadStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const broadEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const todayDenverStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Denver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const candidateAppts = await prisma.appointment.findMany({
      where: {
        companyId,
        date: { gte: broadStart, lte: broadEnd },
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        startTime: { gte: new Date(now.getTime() - 15 * 60 * 1000) },
        ...(professionalId
          ? {
              professionals: {
                some: { professionalId },
              },
            }
          : {}),
        ...(lastAppointmentId ? { id: { not: lastAppointmentId } } : {}),
      },
      include: {
        client: { select: { name: true, address: true, city: true } },
        professionals: { select: { professionalId: true } },
      },
      orderBy: { startTime: "asc" },
      take: 1,
    });

    const upcomingAppointments = candidateAppts.filter((a) => {
      const dStr = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Denver",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(a.date || a.startTime));
      return dStr === todayDenverStr;
    });

    if (upcomingAppointments.length === 0) {
      return {
        hasUpcoming: false,
        message: "Nenhum atendimento subsequente encontrado para hoje.",
      };
    }

    const nextAppointment = upcomingAppointments[0];
    const clientName = nextAppointment.client?.name || nextAppointment.title;

    let originLocation = "";
    if (lastAppointmentId) {
      const lastAppt = await prisma.appointment.findUnique({
        where: { id: lastAppointmentId },
        select: { location: true },
      });
      if (lastAppt?.location) {
        originLocation = lastAppt.location;
      }
    }

    if (!originLocation && typeof latitude === "number" && typeof longitude === "number") {
      originLocation = findClosestCity(latitude, longitude);
    }

    if (!originLocation) {
      originLocation = await this.getHomeOriginAddress(companyId);
    }

    const destinationLocation =
      nextAppointment.location ||
      nextAppointment.client?.address ||
      nextAppointment.client?.city ||
      "Greeley";

    const destinationCity = extractCityFromAddress(destinationLocation);
    const driveMinutes = await getTravelTimeMinutes(originLocation, destinationLocation, 5);

    const appointmentStart = new Date(nextAppointment.startTime);
    const departureTime = new Date(appointmentStart.getTime() - driveMinutes * 60 * 1000);

    const alert1Time = new Date(departureTime.getTime() - 30 * 60 * 1000);
    const alert2Time = new Date(departureTime.getTime() - 10 * 60 * 1000);

    const apptTimeStr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Denver",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(appointmentStart);

    const departureTimeStr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Denver",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(departureTime);

    const titleAlert1 = `Preparar saída: ${clientName} (${apptTimeStr})`;
    const bodyAlert1 = `Agenda às ${apptTimeStr}. Viagem: ~${driveMinutes} min até ${destinationCity}. Saída ideal às ${departureTimeStr}. Trânsito moderado, tempo nublado.`;

    const titleAlert2 = `Atenção: saída em 10 minutos!`;
    const bodyAlert2 = `Hora de sair às ${departureTimeStr} para chegar às ${apptTimeStr} em ${clientName} (${destinationCity}).`;

    const targetProfId = professionalId || nextAppointment.professionals[0]?.professionalId;
    let isImmediate = false;

    // Se já passou do horário do Alerta 1:
    if (now.getTime() >= alert1Time.getTime() - 2 * 60 * 1000) {
      if (now.getTime() < alert2Time.getTime() - 2 * 60 * 1000) {
        isImmediate = true;
        const payload1 = {
          title: titleAlert1,
          body: bodyAlert1,
          tag: `dep-alert1-${nextAppointment.id}`,
          data: { url: "/agenda", type: "DEPARTURE_REMINDER", appointmentId: nextAppointment.id },
        };
        if (targetProfId) {
          await PushService.sendToProfessional(companyId, targetProfId, payload1);
        }
        await PushService.sendToCompany(companyId, payload1);
      }
    }

    // Se já passou do horário do Alerta 2:
    if (now.getTime() >= alert2Time.getTime() - 2 * 60 * 1000) {
      isImmediate = true;
      const payload2 = {
        title: titleAlert2,
        body: bodyAlert2,
        tag: `dep-alert2-${nextAppointment.id}`,
        data: { url: "/agenda", type: "DEPARTURE_REMINDER", appointmentId: nextAppointment.id },
      };
      if (targetProfId) {
        await PushService.sendToProfessional(companyId, targetProfId, payload2);
      }
      await PushService.sendToCompany(companyId, payload2);
    }

    return {
      hasUpcoming: true,
      appointmentId: nextAppointment.id,
      clientName,
      destinationCity,
      originLocation,
      nextStartTime: appointmentStart,
      departureTime,
      driveMinutes,
      alert1ScheduledFor: alert1Time,
      alert2ScheduledFor: alert2Time,
      isImmediateNotification: isImmediate,
      message: `Alertas configurados: 1º às ${alert1Time.toLocaleTimeString("pt-BR", { timeZone: "America/Denver" })} e 2º às ${alert2Time.toLocaleTimeString("pt-BR", { timeZone: "America/Denver" })} (saída às ${departureTimeStr}).`,
    };
  }
}
