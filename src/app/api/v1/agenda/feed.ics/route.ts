import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTargetCompanyId } from "@/lib/company-context";
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
    // When the caller has a real authenticated session, scope strictly to
    // their own company - same pattern as every other migrated route.
    //
    // KNOWN GAP (reported BLOCKED, see task-12 report): the token branch
    // above has no per-company identity at all. WEBCAL_SECRET is a single
    // global env var shared by every company in the database (see
    // proxy.ts's identical isWebcalFeed check), so a bare `?token=` request
    // cannot be mapped to "the company that token belongs to" - there is no
    // such mapping, because the token doesn't carry a companyId and nothing
    // stores one per company. Falling back to findFirst() here is a known,
    // intentional stand-in for that unresolved case, not a scoping bug we
    // can close with a Prisma query - it needs its own design (e.g. a
    // per-company secret/column) before it can be fixed for real.
    //
    // Branches on `session` itself, not `session?.companyId`: a session that
    // exists but somehow lacks a companyId (shouldn't happen for a real
    // ACTIVE user, but this plan fails closed on that, never falls back to
    // "company #1") must still go through getTargetCompanyId and throw -
    // caught below as a 500 - rather than silently falling into the
    // unscoped findFirst() meant only for the genuinely unauthenticated
    // token path.
    const companyId = session
      ? await getTargetCompanyId(session.companyId)
      : (await prisma.companyProfile.findFirst({ select: { id: true } }))?.id;

    const appointments = await prisma.appointment.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        status: { not: "CANCELLED" },
        origin: { not: "ICLOUD_SYNC" }, // Evita duplicação: não reexporta eventos que já vieram do iPhone
      },
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
