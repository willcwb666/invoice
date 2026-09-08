import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/security/auth";

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(req: NextRequest) {
  // Check authorization: requires either an active session OR a valid secret webcal token
  const session = await getSessionUser(req);
  const token = req.nextUrl.searchParams.get("token");
  const expectedToken = process.env.WEBCAL_SECRET;

  if (!session && (!expectedToken || token !== expectedToken)) {
    return NextResponse.json(
      {
        error:
          "Acesso não autorizado. É necessário estar autenticado ou fornecer o token de assinatura do calendário.",
      },
      { status: 401 }
    );
  }

  try {
    const company = await prisma.companyProfile.findFirst();
    const companyId = company?.id;

    const appointments = await prisma.appointment.findMany({
      where: companyId ? { companyId, status: { not: "CANCELLED" } } : { status: { not: "CANCELLED" } },
      include: { client: true },
      orderBy: { date: "asc" },
    });

    const now = formatIcsDate(new Date());

    const events = appointments.map((appt) => {
      const dtStart = formatIcsDate(appt.startTime);
      const dtEnd = formatIcsDate(appt.endTime);
      const summary = `${appt.title} - ${appt.client?.name || ""}`.trim();
      const location = appt.location || appt.client?.address || "";
      const price = Number(appt.price).toFixed(2);
      const description = `Cliente: ${appt.client?.name}\\nTelefone: ${appt.client?.phone || "N/A"}\\nValor: $${price}\\nNotas: ${appt.notes || "Nenhuma"}`;

      return [
        "BEGIN:VEVENT",
        `UID:${appt.id}@invoice.local`,
        `DTSTAMP:${now}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${summary}`,
        `LOCATION:${location}`,
        `DESCRIPTION:${description}`,
        "STATUS:CONFIRMED",
        "END:VEVENT",
      ].join("\r\n");
    });

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Renata Matos//Invoicing System 2.0//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:Limpezas - Renata Matos`,
      "X-WR-TIMEZONE:America/Denver",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="agenda.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Erro ao gerar feed .ics:", error);
    return NextResponse.json({ error: "Erro ao gerar feed da agenda." }, { status: 500 });
  }
}
