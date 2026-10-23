import { prisma } from "@/lib/prisma";
import { extractCityFromAddress } from "@/lib/routing/travel-time";
import { PushService } from "./push-service";
import { DepartureReminderService } from "./departure-reminder-service";
import { WeatherService } from "./weather-service";

export interface MorningBriefResult {
  sentCount: number;
  companiesProcessed: number;
  details: Array<{
    companyId: string;
    professionalId?: string;
    appointmentsCount: number;
    firstAppointmentTime?: string;
    clientName?: string;
    city?: string;
  }>;
}

export class MorningBriefService {
  /**
   * Dispara o briefing diário matinal das 6:00 da manhã para todas as empresas ativas
   */
  static async dispatchDailyBriefing(targetCompanyId?: string): Promise<MorningBriefResult> {
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

    let sentCount = 0;
    const details: MorningBriefResult["details"] = [];

    for (const comp of companies) {
      // 1. Busca todos os agendamentos de hoje para a empresa
      const candidateAppointments = await prisma.appointment.findMany({
        where: {
          companyId: comp.id,
          date: { gte: broadStart, lte: broadEnd },
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        },
        include: {
          client: { select: { name: true, address: true, city: true } },
          professionals: { select: { professionalId: true } },
        },
        orderBy: { startTime: "asc" },
      });

      const appointments = candidateAppointments.filter((a) => {
        const dStr = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Denver",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(a.date || a.startTime));
        return dStr === todayDenverStr;
      });

      if (appointments.length === 0) continue;

      // Sincroniza automaticamente todos os alertas de saída do dia
      await DepartureReminderService.syncDailyReminders(comp.id).catch((err) =>
        console.error("[MorningBriefService] Erro ao sincronizar alertas do dia:", err)
      );

      // 2. Agrupa por profissional
      const professionalMap = new Map<string, typeof appointments>();
      const unassignedAppointments: typeof appointments = [];

      for (const appt of appointments) {
        if (appt.professionals.length === 0) {
          unassignedAppointments.push(appt);
        } else {
          for (const prof of appt.professionals) {
            const list = professionalMap.get(prof.professionalId) || [];
            list.push(appt);
            professionalMap.set(prof.professionalId, list);
          }
        }
      }

      // 3. Envia para cada profissional
      const weather = await WeatherService.getDailyWeather().catch(() => null);
      const weatherSnippet = weather ? ` (${weather.tempCurrent}°F, ${weather.condition})` : "";

      for (const [profId, profAppointments] of professionalMap.entries()) {
        const count = profAppointments.length;
        const first = profAppointments[0];
        const clientName = first.client?.name || first.title;
        const destination = first.location || first.client?.address || first.client?.city || "Greeley";
        const city = extractCityFromAddress(destination);

        const timeStr = new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Denver",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(first.startTime));

        const title = `Agenda de Hoje: ${count} atendimento${count > 1 ? "s" : ""}`;
        const body = `Bom dia! Seu 1º trabalho é às ${timeStr} com ${clientName} em ${city}${weatherSnippet}. Toque para abrir suas casas e rota.`;

        const todayTag = `morning-brief-${comp.id}-${profId}-${now.toISOString().slice(0, 10)}`;
        const alreadySent = await prisma.scheduledPush.findFirst({
          where: {
            companyId: comp.id,
            professionalId: profId,
            type: "MORNING_BRIEF",
            title,
          },
        });

        if (!alreadySent) {
          const delivered = await PushService.sendToProfessional(comp.id, profId, {
            title,
            body,
            tag: todayTag,
            data: {
              url: "/cleaner",
              type: "MORNING_BRIEF",
            },
          });

          await prisma.scheduledPush.create({
            data: {
              companyId: comp.id,
              professionalId: profId,
              type: "MORNING_BRIEF",
              title,
              body,
              url: "/cleaner",
              scheduledFor: now,
              sent: true,
              sentAt: new Date(),
            },
          });

          sentCount += delivered;

          details.push({
            companyId: comp.id,
            professionalId: profId,
            appointmentsCount: count,
            firstAppointmentTime: timeStr,
            clientName,
            city,
          });
        }
      }

      // 4. Se houver agendamentos sem profissional específico escalado, envia resumo geral para os donos/admins
      if (unassignedAppointments.length > 0 && professionalMap.size === 0) {
        const count = unassignedAppointments.length;
        const first = unassignedAppointments[0];
        const clientName = first.client?.name || first.title;
        const destination = first.location || first.client?.address || first.client?.city || "Greeley";
        const city = extractCityFromAddress(destination);

        const timeStr = new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Denver",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(first.startTime));

        const title = `Agenda de Hoje: ${count} atendimento${count > 1 ? "s" : ""}`;
        const body = `Bom dia! Há ${count} atendimento${count > 1 ? "s" : ""} agendado${count > 1 ? "s" : ""} hoje. Primeiro às ${timeStr} (${clientName} em ${city}).`;

        const todayTag = `morning-brief-${comp.id}-admin-${now.toISOString().slice(0, 10)}`;
        const alreadySent = await prisma.scheduledPush.findFirst({
          where: {
            companyId: comp.id,
            professionalId: null,
            type: "MORNING_BRIEF",
            title,
          },
        });

        if (!alreadySent) {
          const delivered = await PushService.sendToCompany(comp.id, {
            title,
            body,
            tag: todayTag,
            data: {
              url: "/agenda",
              type: "MORNING_BRIEF",
            },
          });

          await prisma.scheduledPush.create({
            data: {
              companyId: comp.id,
              professionalId: null,
              type: "MORNING_BRIEF",
              title,
              body,
              url: "/agenda",
              scheduledFor: now,
              sent: true,
              sentAt: new Date(),
            },
          });

          sentCount += delivered;
          details.push({
            companyId: comp.id,
            appointmentsCount: count,
            firstAppointmentTime: timeStr,
            clientName,
            city,
          });
        }
      }
    }

    return {
      sentCount,
      companiesProcessed: companies.length,
      details,
    };
  }
}
