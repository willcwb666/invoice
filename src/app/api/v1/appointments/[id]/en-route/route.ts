import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/security/auth";
import { prisma } from "@/lib/prisma";
import { getTravelTimeMinutes } from "@/lib/routing/travel-time";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        company: {
          include: {
            addresses: {
              where: { isDefault: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!appt || !appt.client) {
      return NextResponse.json(
        { error: "Atendimento ou cliente não encontrado." },
        { status: 404 }
      );
    }

    const client = appt.client;
    const company = appt.company;
    const defaultAddr = company?.addresses?.[0];
    const origin = defaultAddr
      ? `${defaultAddr.street}, ${defaultAddr.city}, ${defaultAddr.state}`
      : "Evans, CO";
    const destination = client.address
      ? `${client.address}, ${client.city || ""}, ${client.state || ""}`
      : "";

    let etaMinutes = 15;
    if (destination) {
      try {
        etaMinutes = await getTravelTimeMinutes(origin, destination, 3);
      } catch (tErr) {
        console.warn("Falha ao calcular tempo exato de viagem, usando estimativa padrão:", tErr);
      }
    }

    const companyName = company?.name || "Renata Matos Cleaning";
    const message = `Olá, ${client.name}! A equipe da ${companyName} está a caminho. Previsão estimada de chegada em aproximadamente ${etaMinutes} minutos.`;

    const cleanPhone = (client.phone || "").replace(/\D/g, "");
    const encodedMsg = encodeURIComponent(message);
    const smsUrl = cleanPhone ? `sms:${cleanPhone}?body=${encodedMsg}` : `sms:?body=${encodedMsg}`;
    const whatsappUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodedMsg}`
      : `https://wa.me/?text=${encodedMsg}`;

    return NextResponse.json({
      success: true,
      etaMinutes,
      message,
      clientPhone: client.phone,
      smsUrl,
      whatsappUrl,
    });
  } catch (error) {
    console.error("Erro ao gerar aviso a caminho (ETA):", error);
    return NextResponse.json({ error: "Erro ao gerar aviso a caminho." }, { status: 500 });
  }
}
