import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateEstimateDuration } from "@/lib/scheduling/duration";

function parseTime12h(timeStr: string): { hours: number; minutes: number } {
  // Ex: "10:30 AM" ou "02:15 PM"
  const parts = timeStr.trim().split(" ");
  const [hStr, mStr] = parts[0].split(":");
  let hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr || "0", 10);
  const isPM = parts[1]?.toUpperCase() === "PM";

  if (isPM && hours < 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;

  return { hours, minutes };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const resolvedParams = await params;
    const token = resolvedParams.token;
    const body = await req.json();

    const { date, time, clientNotes } = body;

    if (!date || !time) {
      return NextResponse.json(
        { success: false, error: "Informe a data e o horário desejado para o agendamento." },
        { status: 400 }
      );
    }

    // Localiza o orçamento apenas pelo token público (ver nota em
    // GET /api/v1/public/estimates/[token]/route.ts)
    const estimate = await prisma.estimate.findFirst({
      where: { publicToken: token },
      include: {
        client: true,
      },
    });

    if (!estimate) {
      return NextResponse.json(
        { success: false, error: "Orçamento não encontrado." },
        { status: 404 }
      );
    }

    const metadata = (estimate.metadata as any) || {};
    const durationMinutes =
      estimate.estimatedDurationMinutes || calculateEstimateDuration(metadata);

    // Constrói startTime e endTime com fuso horário seguro
    const { hours, minutes } = parseTime12h(time);
    const [year, month, day] = date.split("-").map(Number);

    const startDateTime = new Date(year, month - 1, day, hours, minutes, 0);
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);

    // Cria o agendamento oficial no sistema
    const appointment = await prisma.appointment.create({
      data: {
        companyId: estimate.companyId,
        clientId: estimate.clientId,
        estimateId: estimate.id,
        title: `${estimate.client.name} - ${metadata.cleaningType || "Cleaning Service"}`,
        date: new Date(year, month - 1, day, 12, 0, 0),
        startTime: startDateTime,
        endTime: endDateTime,
        location: estimate.client.address || undefined,
        price: estimate.totalAmount,
        status: "SCHEDULED",
        origin: "INTERNAL",
        billable: true,
        notes: clientNotes
          ? `[Agendado pelo Cliente]: ${clientNotes}`
          : "Agendado via link público de orçamento com otimização de rota.",
      },
    });

    // Atualiza o orçamento para ACCEPTED
    const updatedEstimate = await prisma.estimate.update({
      where: { id: estimate.id },
      data: {
        status: "ACCEPTED",
        metadata: {
          ...metadata,
          bookedAppointmentId: appointment.id,
          bookedAt: new Date().toISOString(),
          bookedSlot: `${date} ${time}`,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        appointmentId: appointment.id,
        estimateId: updatedEstimate.id,
        status: "SCHEDULED",
        date,
        time,
        clientName: estimate.client.name,
      },
    });
  } catch (error: any) {
    console.error("Erro ao efetivar agendamento pelo orçamento:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno ao confirmar agendamento." },
      { status: 500 }
    );
  }
}
