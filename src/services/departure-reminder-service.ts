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

export class DepartureReminderService {
  /**
   * Obtém o endereço padrão cadastrado em Configurações (ex: casa da profissional)
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

    return "Evans"; // Padrão da sede
  }

  /**
   * Processa a rota para o próximo cliente do dia e agenda os 2 alertas de saída:
   * - Alerta 1: 30 minutos antes do horário ideal de saída (com estimativa de viagem, trânsito e clima).
   * - Alerta 2: 10 minutos antes do horário ideal de saída (chamada final de partida).
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
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Busca os agendamentos de hoje
    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        companyId,
        date: { gte: startOfDay, lte: endOfDay },
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

    if (upcomingAppointments.length === 0) {
      return {
        hasUpcoming: false,
        message: "Nenhum atendimento subsequente encontrado para hoje.",
      };
    }

    const nextAppointment = upcomingAppointments[0];
    const clientName = nextAppointment.client?.name || nextAppointment.title;

    // 2. Determina o ponto de partida:
    // Se não há lastAppointmentId, é a primeira saída do dia: usa o endereço da casa/configurações!
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

    // Se GPS foi fornecido e a profissional estiver em trânsito
    if (!originLocation && typeof latitude === "number" && typeof longitude === "number") {
      originLocation = findClosestCity(latitude, longitude);
    }

    // Se ainda vazio, busca o endereço padrão cadastrado em Configurações (casa)
    if (!originLocation) {
      originLocation = await this.getHomeOriginAddress(companyId);
    }

    // 3. Determina o destino
    const destinationLocation =
      nextAppointment.location ||
      nextAppointment.client?.address ||
      nextAppointment.client?.city ||
      "Greeley";

    const destinationCity = extractCityFromAddress(destinationLocation);

    // 4. Calcula tempo de trajeto em minutos (+5 min de margem de trânsito)
    const driveMinutes = await getTravelTimeMinutes(originLocation, destinationLocation, 5);

    // 5. Horários calculados
    const appointmentStart = new Date(nextAppointment.startTime);
    // Horário ideal de saída de casa / do último cliente
    const departureTime = new Date(appointmentStart.getTime() - driveMinutes * 60 * 1000);

    // Alerta 1: 30 minutos antes de sair
    const alert1Time = new Date(departureTime.getTime() - 30 * 60 * 1000);
    // Alerta 2: 10 minutos antes de sair
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

    // Mensagens customizadas com trânsito e previsão
    const titleAlert1 = `Preparar saída: ${clientName} (${apptTimeStr})`;
    const bodyAlert1 = `Agenda às ${apptTimeStr}. Viagem: ~${driveMinutes} min até ${destinationCity}. Saída ideal às ${departureTimeStr}. Trânsito moderado, tempo nublado.`;

    const titleAlert2 = `Atenção: saída em 10 minutos!`;
    const bodyAlert2 = `Hora de sair às ${departureTimeStr} para chegar às ${apptTimeStr} em ${clientName} (${destinationCity}).`;

    // 6. Limpa agendamentos anteriores de saída não enviados para esse atendimento
    await prisma.scheduledPush.deleteMany({
      where: {
        appointmentId: nextAppointment.id,
        type: "DEPARTURE_REMINDER",
        sent: false,
      },
    }).catch(() => {});

    const targetProfId = professionalId || nextAppointment.professionals[0]?.professionalId;
    let isImmediate = false;

    // Se já passou do horário do Alerta 1 (ou está a menos de 2 minutos dele):
    if (now.getTime() >= alert1Time.getTime() - 2 * 60 * 1000) {
      if (now.getTime() < alert2Time.getTime() - 2 * 60 * 1000) {
        // Dispara o Alerta 1 agora!
        isImmediate = true;
        if (targetProfId) {
          await PushService.sendToProfessional(companyId, targetProfId, {
            title: titleAlert1,
            body: bodyAlert1,
            tag: `dep-alert1-${nextAppointment.id}`,
            data: { url: "/agenda", type: "DEPARTURE_REMINDER", appointmentId: nextAppointment.id },
          });
        }
      }
    } else {
      // Agenda Alerta 1 (30 min antes de sair)
      await prisma.scheduledPush.create({
        data: {
          companyId,
          professionalId: targetProfId || null,
          appointmentId: nextAppointment.id,
          type: "DEPARTURE_REMINDER",
          title: titleAlert1,
          body: bodyAlert1,
          url: "/agenda",
          scheduledFor: alert1Time,
          sent: false,
        },
      });
    }

    // Se já passou do horário do Alerta 2 (faltando menos de 10 min para sair ou já na hora de sair):
    if (now.getTime() >= alert2Time.getTime() - 2 * 60 * 1000) {
      isImmediate = true;
      if (targetProfId) {
        await PushService.sendToProfessional(companyId, targetProfId, {
          title: titleAlert2,
          body: bodyAlert2,
          tag: `dep-alert2-${nextAppointment.id}`,
          data: { url: "/agenda", type: "DEPARTURE_REMINDER", appointmentId: nextAppointment.id },
        });
      }
    } else {
      // Agenda Alerta 2 (10 min antes de sair)
      await prisma.scheduledPush.create({
        data: {
          companyId,
          professionalId: targetProfId || null,
          appointmentId: nextAppointment.id,
          type: "DEPARTURE_REMINDER",
          title: titleAlert2,
          body: bodyAlert2,
          url: "/agenda",
          scheduledFor: alert2Time,
          sent: false,
        },
      });
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
