import { prisma } from "@/lib/prisma";
import { AppointmentStatus } from "@prisma/client";

/**
 * Calculates start (00:00:00.000) and end (23:59:59.999) Date objects
 * for a YYYY-MM-DD date in America/Denver (Mountain Time), accurately
 * accounting for Daylight Saving Time (MDT UTC-6 vs MST UTC-7).
 */
export function getDenverDayBounds(dateStr: string): { startOfDay: Date; endOfDay: Date } {
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    timeZoneName: "shortOffset",
  }).formatToParts(noonUtc);
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-6";
  const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
  let offsetStr = "-06:00";
  if (match) {
    const sign = match[1];
    const hours = match[2].padStart(2, "0");
    const minutes = (match[3] || "00").padStart(2, "0");
    offsetStr = `${sign}${hours}:${minutes}`;
  }
  return {
    startOfDay: new Date(`${dateStr}T00:00:00.000${offsetStr}`),
    endOfDay: new Date(`${dateStr}T23:59:59.999${offsetStr}`),
  };
}

/**
 * Returns today's date formatted as YYYY-MM-DD in America/Denver.
 */
export function getDenverTodayDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

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
    zipCode: string | null;
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
    task: string;
    title: string;
    completed: boolean;
    completedAt: Date | null;
    completedBy: string | null;
  }>;
  photos: Array<{
    id: string;
    photoType: string;
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

    const timeStart =
      appt.timeStart ||
      (appt.startTime instanceof Date
        ? appt.startTime.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Denver",
          })
        : typeof appt.startTime === "string"
        ? appt.startTime
        : "");

    const timeEnd =
      appt.timeEnd ||
      (appt.endTime instanceof Date
        ? appt.endTime.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Denver",
          })
        : typeof appt.endTime === "string"
        ? appt.endTime
        : "");

    return {
      id: appt.id,
      date:
        appt.date instanceof Date
          ? new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Denver",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(appt.date)
          : String(appt.date).split("T")[0],
      timeStart,
      timeEnd,
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
        zipCode: client.zipCode || client.zip || null,
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
        task: c.task || c.title || "",
        title: c.task || c.title || "",
        completed: Boolean(c.completed),
        completedAt: c.completedAt || null,
        completedBy: c.completedBy || null,
      })),
      photos: (appt.photos || []).map((p: any) => ({
        id: p.id,
        photoType: p.photoType,
        photoUrl: p.imageUrl || p.photoUrl || "",
        room: p.room || null,
        caption: p.caption || null,
        createdAt: p.uploadedAt || p.createdAt || new Date(),
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
   * Accurately supports Mountain Time daylight-saving boundaries and includes
   * unassigned appointments when viewing as owner or when requested.
   */
  static async listCleanerAppointments({
    companyId,
    professionalId,
    date,
    includeUnassigned,
  }: {
    companyId: string;
    professionalId?: string | null;
    date: string;
    includeUnassigned?: boolean;
  }): Promise<SanitizedCleanerAppointment[]> {
    let isOwner = false;
    if (professionalId) {
      const prof = await prisma.professional.findUnique({
        where: { id: professionalId },
        select: { id: true, isOwner: true },
      });
      isOwner = Boolean(prof?.isOwner);
    }

    const { startOfDay, endOfDay } = getDenverDayBounds(date);

    const andFilters: any[] = [
      {
        OR: [
          { date: { gte: startOfDay, lte: endOfDay } },
          { startTime: { gte: startOfDay, lte: endOfDay } },
        ],
      },
    ];

    const shouldIncludeUnassigned = includeUnassigned ?? (isOwner || !professionalId);

    if (shouldIncludeUnassigned) {
      andFilters.push({
        OR: [
          ...(professionalId ? [{ professionals: { some: { professionalId } } }] : []),
          { professionals: { none: {} } },
        ],
      });
    } else if (professionalId) {
      andFilters.push({
        professionals: {
          some: { professionalId },
        },
      });
    }

    const appts = await prisma.appointment.findMany({
      where: {
        companyId,
        status: {
          not: "CANCELLED",
        },
        AND: andFilters,
      },
      orderBy: {
        startTime: "asc",
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
            zipCode: true,
            entryCode: true,
            alarmCode: true,
            pets: true,
            parkingInstructions: true,
          },
        },
        checklists: {
          orderBy: { createdAt: "asc" },
        },
        photos: {
          orderBy: { uploadedAt: "desc" },
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
   * Verifies that the cleaner is assigned to this job unless caller is an admin,
   * is an owner, or the appointment is unassigned.
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
        const prof = await prisma.professional.findUnique({
          where: { id: professionalId },
          select: { isOwner: true },
        });
        const isOwner = Boolean(prof?.isOwner);
        const isUnassigned = appt.professionals.length === 0;

        if (!isOwner && !isUnassigned) {
          throw new Error("Você não tem autorização para atualizar este atendimento.");
        }

        // If unassigned house is started by a cleaner, automatically associate them
        if (isUnassigned) {
          await prisma.appointmentProfessional.create({
            data: {
              appointmentId,
              professionalId,
            },
          }).catch(() => {});
        }
      }
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status,
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
              type: "GENERAL",
              scheduledFor: runAt,
              appointmentId: appt.id,
              url: company.googleReviewUrl,
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
