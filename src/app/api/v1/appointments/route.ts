import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createAppointmentSchema } from "@/lib/validations/appointment";
import { AppointmentService } from "@/services/appointment-service";
import { prisma } from "@/lib/prisma";

async function getDefaultCompanyId() {
  const company = await prisma.companyProfile.findFirst();
  return company?.id || "";
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`appts_get_${ip}`, { limit: 100, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Limite de requisições atingido." },
      { status: 429 }
    );
  }

  try {
    const companyId = await getDefaultCompanyId();
    const appts = await AppointmentService.listAppointments(companyId);

    return NextResponse.json({ data: appts });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao buscar agendamentos." },
      { status: 500 }
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

  try {
    const body = await req.json();
    const parsed = createAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const companyId = await getDefaultCompanyId();
    const appointment = await AppointmentService.createAppointment(companyId, parsed.data);

    return NextResponse.json({ data: appointment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao agendar compromisso." },
      { status: 400 }
    );
  }
}
