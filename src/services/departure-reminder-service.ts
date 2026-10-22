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
  nextStartTime?: Date;
  driveMinutes?: number;
  scheduledFor?: Date;
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
   * Processa a atualização de localização do profissional, calcula o tempo de trajeto
   * até o próximo cliente e agenda (ou dispara imediatamente) o alerta de saída 30 minutos antes.
   */
  static async processLocationUpdate(input: ProcessLocationInput): Promise<DepartureResult> {
    const { companyId, latitude, longitude, lastAppointmentId } = input;
    let professionalId = input.professionalId;

    // Se professionalId não foi fornecido diretamente, busca a partir do userId
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
    // Início do dia e fim do dia para buscar apenas atendimentos de hoje
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Busca os agendamentos de hoje ordenados por horário
    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        companyId,
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        startTime: { gte: new Date(now.getTime() - 15 * 60 * 1000) }, // até 15 min de tolerância para atendimento em início
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

    // 2. Determina a origem (por GPS ou endereço do último atendimento)
    let originLocation = "greeley";
    if (typeof latitude === "number" && typeof longitude === "number") {
      originLocation = findClosestCity(latitude, longitude);
    } else if (lastAppointmentId) {
      const lastAppt = await prisma.appointment.findUnique({
        where: { id: lastAppointmentId },
        select: { location: true },
      });
      if (lastAppt?.location) {
        originLocation = lastAppt.location;
      }
    }

    // 3. Determina o destino
    const destinationLocation =
      nextAppointment.location ||
      nextAppointment.client?.address ||
      nextAppointment.client?.city ||
      "greeley";

    const destinationCity = extractCityFromAddress(destinationLocation);

    // 4. Calcula tempo de trajeto
    const driveMinutes = await getTravelTimeMinutes(originLocation, destinationLocation, 5);

    // 5. Calcula o horário alvo do alerta: startTime - (driveMinutes + 30 min)
    const appointmentStart = new Date(nextAppointment.startTime);
    const alertLeadMinutes = driveMinutes + 30;
    const targetReminderTime = new Date(appointmentStart.getTime() - alertLeadMinutes * 60 * 1000);

    const timeStr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Denver",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(appointmentStart);

    const title = `Hora de se preparar: ${clientName}`;
    const body = `Faltam ~${driveMinutes} min de viagem até ${destinationCity}. Seu atendimento começa às ${timeStr}!`;

    // 6. Se o horário do alerta já passou ou está dentro dos próximos 3 minutos, dispara agora
    const isImmediate = targetReminderTime.getTime() <= now.getTime() + 3 * 60 * 1000;

    if (isImmediate) {
      const targetProfId = professionalId || nextAppointment.professionals[0]?.professionalId;
      if (targetProfId) {
        await PushService.sendToProfessional(companyId, targetProfId, {
          title,
          body,
          tag: `departure-${nextAppointment.id}`,
          data: {
            url: "/agenda",
            type: "DEPARTURE_REMINDER",
            appointmentId: nextAppointment.id,
          },
        });
      } else {
        await PushService.sendToCompany(companyId, {
          title,
          body,
          tag: `departure-${nextAppointment.id}`,
          data: {
            url: "/agenda",
            type: "DEPARTURE_REMINDER",
            appointmentId: nextAppointment.id,
          },
        });
      }

      return {
        hasUpcoming: true,
        appointmentId: nextAppointment.id,
        clientName,
        destinationCity,
        nextStartTime: appointmentStart,
        driveMinutes,
        isImmediateNotification: true,
        message: "Notificação de saída disparada imediatamente (dentro da janela de 30 minutos).",
      };
    }

    // 7. Se ainda faltar tempo, agenda no banco (substituindo agendamento anterior para este atendimento se houver)
    await prisma.scheduledPush.deleteMany({
      where: {
        appointmentId: nextAppointment.id,
        type: "DEPARTURE_REMINDER",
        sent: false,
      },
    }).catch(() => {});

    const targetProfId = professionalId || nextAppointment.professionals[0]?.professionalId;

    await prisma.scheduledPush.create({
      data: {
        companyId,
        professionalId: targetProfId || null,
        appointmentId: nextAppointment.id,
        type: "DEPARTURE_REMINDER",
        title,
        body,
        url: "/agenda",
        scheduledFor: targetReminderTime,
        sent: false,
      },
    });

    return {
      hasUpcoming: true,
      appointmentId: nextAppointment.id,
      clientName,
      destinationCity,
      nextStartTime: appointmentStart,
      driveMinutes,
      scheduledFor: targetReminderTime,
      isImmediateNotification: false,
      message: `Alerta agendado com sucesso para ${targetReminderTime.toLocaleTimeString("pt-BR")}.`,
    };
  }
}
