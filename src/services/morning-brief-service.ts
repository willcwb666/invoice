import { prisma } from "@/lib/prisma";
import { extractCityFromAddress } from "@/lib/routing/travel-time";
import { PushService } from "./push-service";

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
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const companies = await prisma.companyProfile.findMany({
      where: targetCompanyId ? { id: targetCompanyId } : {},
      select: { id: true, name: true },
    });

    let sentCount = 0;
    const details: MorningBriefResult["details"] = [];

    for (const comp of companies) {
      // 1. Busca todos os agendamentos de hoje para a empresa
      const appointments = await prisma.appointment.findMany({
        where: {
          companyId: comp.id,
          date: { gte: startOfDay, lte: endOfDay },
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        },
        include: {
          client: { select: { name: true, address: true, city: true } },
          professionals: { select: { professionalId: true } },
        },
        orderBy: { startTime: "asc" },
      });

      if (appointments.length === 0) continue;

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
        const body = `Bom dia! Seu primeiro trabalho é às ${timeStr} com ${clientName} em ${city}.`;

        // Evita envio duplicado do briefing matinal no mesmo dia
        const todayTag = `morning-brief-${comp.id}-${profId}-${now.toISOString().slice(0, 10)}`;
        const alreadySent = await prisma.scheduledPush.findFirst({
          where: {
            companyId: comp.id,
            professionalId: profId,
            type: "MORNING_BRIEF",
            createdAt: { gte: startOfDay, lte: endOfDay },
          },
        });

        if (!alreadySent) {
          const delivered = await PushService.sendToProfessional(comp.id, profId, {
            title,
            body,
            tag: todayTag,
            data: {
              url: "/agenda",
              type: "MORNING_BRIEF",
            },
          });

          // Registra como enviado
          await prisma.scheduledPush.create({
            data: {
              companyId: comp.id,
              professionalId: profId,
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
            createdAt: { gte: startOfDay, lte: endOfDay },
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
