import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createAppointmentSchema } from "@/lib/validations/appointment";
import { AppointmentService } from "@/services/appointment-service";
import { ProfessionalService } from "@/services/professional-service";
import { NotificationService } from "@/services/notification-service";
import { requirePermission } from "@/lib/security/permissions";
import { getTargetCompanyId } from "@/lib/company-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`appts_get_${ip}`, { limit: 100, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Limite de requisições atingido." },
      { status: 429, headers: NO_CACHE_HEADERS }
    );
  }

  const check = await requirePermission(req, "appointments", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const companyId = await getTargetCompanyId(session.companyId);

    const clientId = req.nextUrl.searchParams.get("clientId");
    const uninvoicedOnly = req.nextUrl.searchParams.get("uninvoiced") === "true";

    if (clientId && uninvoicedOnly) {
      const uninvoiced = await AppointmentService.getUninvoicedAppointments(clientId, companyId);
      const enriched = await ProfessionalService.enrichAppointments(uninvoiced, companyId);
      return NextResponse.json({ data: enriched }, { headers: NO_CACHE_HEADERS });
    }

    const upcoming = req.nextUrl.searchParams.get("upcoming") === "true";
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 5;

    if (upcoming) {
      const upcomingAppts = await AppointmentService.getUpcomingAppointments(companyId, limit);
      const enriched = await ProfessionalService.enrichAppointments(upcomingAppts, companyId);
      return NextResponse.json({ data: enriched }, { headers: NO_CACHE_HEADERS });
    }

    // Garante que séries ativas estejam estendidas até o horizonte configurado (ex: 2 meses à frente)
    await AppointmentService.ensureRecurrenceHorizon(companyId);

    const appts = await AppointmentService.listAppointments(companyId);
    const enriched = await ProfessionalService.enrichAppointments(appts, companyId);

    return NextResponse.json({ data: enriched }, { headers: NO_CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: "Erro ao buscar agendamentos." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`appts_post_${ip}`, { limit: 50, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Limite de criação de agendamentos atingido." },
      { status: 429 }
    );
  }

  const check = await requirePermission(req, "appointments", "create");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const body = await req.json();
    const parsed = createAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const companyId = await getTargetCompanyId(session.companyId);
    const cleaningCategory = parsed.data.cleaningCategory;
    const professionalIds =
      parsed.data.professionalIds && parsed.data.professionalIds.length > 0
        ? parsed.data.professionalIds
        : await ProfessionalService.getDefaultOwnerProfessionalIds(companyId);

    const appointment = await AppointmentService.createAppointment(
      companyId,
      parsed.data,
      { professionalIds, cleaningCategory }
    );

    await ProfessionalService.setAppointmentProfessionals(
      companyId,
      appointment.id,
      professionalIds,
      cleaningCategory
    );

    const [enriched] = await ProfessionalService.enrichAppointments([appointment], companyId);

    // Dispara notificação in-app
    NotificationService.notifyAppointmentChange({
      companyId,
      action: "CREATED",
      appointmentTitle: appointment.title,
      appointmentDate: appointment.date,
      clientName: appointment.client?.name,
      appointmentId: appointment.id,
      professionalNames: enriched.professionals.map((p) => p.name),
    }).catch(() => {});

    return NextResponse.json({ data: enriched }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : undefined) || "Erro ao agendar compromisso." },
      { status: 400 }
    );
  }
}
