import { prisma } from "@/lib/prisma";
import { AppointmentStatus } from "@prisma/client";

export interface SanitizedCleanerAppointment {
  id: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  status: AppointmentStatus;
  notes: string | null;
  services: any[];
  client: {
    id: string;
    name: string;
    phone: string | null;
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  access: {
    entryCode: string | null;
    alarmCode: string | null;
    pets: string | null;
    parkingInstructions: string | null;
  };
  checklists: Array<{
    id: string;
    room: string;
    title: string;
    completed: boolean;
    completedAt: Date | null;
    completedBy: string | null;
  }>;
  photos: Array<{
    id: string;
    photoType: "BEFORE" | "AFTER";
    photoUrl: string;
    room: string | null;
    caption: string | null;
    createdAt: Date;
  }>;
  team: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
}

export class CleanerService {
  /**
   * Sanitizes an appointment record to completely strip financial data
   * and resolve access codes with client-level fallback.
   */
  static sanitizeAppointment(appt: any): SanitizedCleanerAppointment {
    const client = appt.client || {};
    return {
      id: appt.id,
      date: appt.date instanceof Date ? appt.date.toISOString().split("T")[0] : String(appt.date).split("T")[0],
      timeStart: appt.timeStart,
      timeEnd: appt.timeEnd,
      status: appt.status,
      notes: appt.notes || null,
      services: Array.isArray(appt.services) ? appt.services : [],
      client: {
        id: client.id || "",
        name: client.name || "Cliente",
        phone: client.phone || null,
        address: client.address || "",
        city: client.city || null,
        state: client.state || null,
        zip: client.zip || null,
      },
      access: {
        entryCode: appt.entryCode || client.entryCode || null,
        alarmCode: appt.alarmCode || client.alarmCode || null,
        pets: appt.pets || client.pets || null,
        parkingInstructions: appt.parkingInstructions || client.parkingInstructions || null,
      },
      checklists: (appt.checklists || []).map((c: any) => ({
        id: c.id,
        room: c.room,
        title: c.title,
        completed: Boolean(c.completed),
        completedAt: c.completedAt || null,
        completedBy: c.completedBy || null,
      })),
      photos: (appt.photos || []).map((p: any) => ({
        id: p.id,
        photoType: p.photoType,
        photoUrl: p.photoUrl,
        room: p.room || null,
        caption: p.caption || null,
        createdAt: p.createdAt,
      })),
      team: (appt.professionals || []).map((ap: any) => ({
        id: ap.professional?.id || ap.professionalId,
        name: ap.professional?.name || "Colaboradora",
        color: ap.professional?.color || null,
      })),
    };
  }

  /**
   * Fetches assigned appointments for a cleaner on a given date.
   * Blinded against financial information.
   */
  static async listCleanerAppointments({
    companyId,
    professionalId,
    date,
  }: {
    companyId: string;
    professionalId?: string | null;
    date: string;
  }): Promise<SanitizedCleanerAppointment[]> {
    // If no professionalId is associated, return empty array safely
    if (!professionalId) {
      return [];
    }

    // Build start and end of target day
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    const appts = await prisma.appointment.findMany({
      where: {
        companyId,
        cancelledAt: null,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        professionals: {
          some: {
            professionalId,
          },
        },
      },
      orderBy: {
        timeStart: "asc",
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            entryCode: true,
            alarmCode: true,
            pets: true,
            parkingInstructions: true,
          },
        },
        checklists: {
          orderBy: { sortOrder: "asc" },
        },
        photos: {
          orderBy: { createdAt: "desc" },
        },
        professionals: {
          include: {
            professional: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    return appts.map((appt) => this.sanitizeAppointment(appt));
  }

  /**
   * Updates an appointment's operational status (IN_PROGRESS or COMPLETED).
   * Verifies that the cleaner is assigned to this job unless caller is an admin.
   */
  static async updateAppointmentStatus({
    companyId,
    appointmentId,
    professionalId,
    status,
    updatedBy,
    isAdmin = false,
  }: {
    companyId: string;
    appointmentId: string;
    professionalId?: string | null;
    status: AppointmentStatus;
    updatedBy: string;
    isAdmin?: boolean;
  }) {
    const appt = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        companyId,
      },
      include: {
        professionals: true,
        client: true,
      },
    });

    if (!appt) {
      throw new Error("Atendimento não encontrado.");
    }

    if (!isAdmin && professionalId) {
      const isAssigned = appt.professionals.some((p) => p.professionalId === professionalId);
      if (!isAssigned) {
        throw new Error("Você não tem autorização para atualizar este atendimento.");
      }
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status,
        completedAt: status === "COMPLETED" ? new Date() : appt.completedAt,
        notes: appt.notes,
      },
      include: {
        client: true,
        checklists: true,
        photos: true,
        professionals: {
          include: {
            professional: true,
          },
        },
      },
    });

    // If completed, schedule Google Review Booster 60 min later
    if (status === "COMPLETED" && appt.client?.phone) {
      try {
        const company = await prisma.companyProfile.findUnique({
          where: { id: companyId },
          select: { googleReviewUrl: true, name: true },
        });

        if (company?.googleReviewUrl) {
          const runAt = new Date(Date.now() + 60 * 60 * 1000); // +1 hour
          const reviewMsg = `Olá ${appt.client.name}! Agradecemos pela confiança na ${company.name}. Poderia deixar uma avaliação rápida de 5 estrelas sobre o nosso serviço de hoje? Acesse: ${company.googleReviewUrl}`;

          await prisma.scheduledPush.create({
            data: {
              companyId,
              title: "Avaliação do Atendimento",
              body: reviewMsg,
              category: "CUSTOM",
              runAt,
              appointmentId: appt.id,
              metadata: {
                type: "GOOGLE_REVIEW_REQUEST",
                clientPhone: appt.client.phone,
                clientName: appt.client.name,
                googleReviewUrl: company.googleReviewUrl,
              },
            },
          });
        }
      } catch (reviewErr) {
        console.warn("Falha ao agendar solicitação de review no Google:", reviewErr);
      }
    }

    return this.sanitizeAppointment(updated);
  }
}
