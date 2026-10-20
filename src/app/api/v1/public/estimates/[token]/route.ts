import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateEstimateDuration } from "@/lib/scheduling/duration";
import { findAvailableSlots } from "@/lib/scheduling/slot-finder";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const resolvedParams = await params;
    const token = resolvedParams.token;

    // Localiza o orçamento apenas pelo token público - o `id` interno
    // também circula em contextos autenticados (URLs do dashboard, e-mails
    // de envio) e não pode funcionar como credencial de acesso público.
    const estimate = await prisma.estimate.findFirst({
      where: { publicToken: token },
      include: {
        client: true,
        items: true,
        company: {
          include: { addresses: true },
        },
      },
    });

    if (!estimate) {
      return NextResponse.json(
        { success: false, error: "Orçamento não encontrado." },
        { status: 404 }
      );
    }

    const company = estimate.company;
    const defaultAddress =
      company.addresses.find((a) => a.isDefault)?.street ||
      company.addresses[0]?.street ||
      "4172 MeadowView, Evans, CO 80620";

    // Calcula duração da faxina baseada no escopo
    const metadata = (estimate.metadata as any) || {};
    const durationMinutes =
      estimate.estimatedDurationMinutes || calculateEstimateDuration(metadata);

    // Busca agendamentos existentes nos próximos 21 dias para calcular rota e vãos livres
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 21);

    const appointments = await prisma.appointment.findMany({
      where: {
        companyId: company.id,
        date: { gte: startDate, lte: endDate },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        title: true,
        date: true,
        startTime: true,
        endTime: true,
        location: true,
        status: true,
      },
      orderBy: { startTime: "asc" },
    });

    // Roda o motor de otimização de rota e vãos livres
    const availableDays = await findAvailableSlots(
      {
        clientAddress: estimate.client.address || defaultAddress,
        serviceDurationMinutes: durationMinutes,
        baseAddress: defaultAddress,
        workDayStartHour: company.workDayStartHour,
        workDayEndHour: company.workDayEndHour,
        workDays: company.workDays,
        travelBufferMinutes: company.travelBufferMinutes,
        daysAhead: 18,
      },
      appointments
    );

    return NextResponse.json({
      success: true,
      data: {
        estimate: {
          id: estimate.id,
          estimateNumber: estimate.estimateNumber,
          status: estimate.status,
          subtotal: Number(estimate.subtotal),
          discount: Number(estimate.discount),
          totalAmount: Number(estimate.totalAmount),
          notes: estimate.notes,
          validUntil: estimate.validUntil,
          metadata: estimate.metadata,
          abandonedDiscountApplied: estimate.abandonedDiscountApplied,
          client: {
            name: estimate.client.name,
            address: estimate.client.address,
            phone: estimate.client.phone,
            email: estimate.client.email,
          },
          items: estimate.items.map((it) => ({
            id: it.id,
            description: it.description,
            quantity: it.quantity,
            unitPrice: Number(it.unitPrice),
            total: Number(it.total),
          })),
        },
        company: {
          name: company.name,
          phone: company.phone,
          email: company.email,
        },
        durationMinutes,
        availableDays,
      },
    });
  } catch (error: any) {
    console.error("Erro ao carregar orçamento público:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}
