import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/security/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const DEFAULT_CHECKLIST_TEMPLATES = [
  { room: "Cozinha", task: "Limpar bancadas e pia" },
  { room: "Cozinha", task: "Limpar fogão e micro-ondas (externo/interno)" },
  { room: "Cozinha", task: "Tirar lixo e repor saco" },
  { room: "Banheiros", task: "Higienizar e desinfetar vaso sanitário" },
  { room: "Banheiros", task: "Lavar e secar box/banheira" },
  { room: "Banheiros", task: "Limpar espelhos e bancada da pia" },
  { room: "Banheiros", task: "Tirar lixo e repor toalhas" },
  { room: "Quartos", task: "Arrumar / trocar lençóis da cama" },
  { room: "Quartos", task: "Tirar pó de mesas de cabeceira e móveis" },
  { room: "Quartos", task: "Aspirar carpete / passar pano no piso" },
  { room: "Sala / Geral", task: "Tirar pó das superfícies e TV" },
  { room: "Sala / Geral", task: "Aspirar sofá, tapetes e cantos" },
  { room: "Sala / Geral", task: "Passar pano úmido em todo o piso" },
  { room: "Sala / Geral", task: "Conferir janelas e trancar portas" },
];

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    let items = await prisma.appointmentChecklist.findMany({
      where: { appointmentId: id },
      orderBy: { createdAt: "asc" },
    });

    // If no checklist items exist yet, seed default templates
    if (items.length === 0) {
      await prisma.appointmentChecklist.createMany({
        data: DEFAULT_CHECKLIST_TEMPLATES.map((tmpl) => ({
          appointmentId: id,
          room: tmpl.room,
          task: tmpl.task,
        })),
      });

      items = await prisma.appointmentChecklist.findMany({
        where: { appointmentId: id },
        orderBy: { createdAt: "asc" },
      });
    }

    return NextResponse.json({
      success: true,
      data: items.map((i) => ({ ...i, title: i.task })),
    });
  } catch (error) {
    console.error("Erro ao buscar checklist:", error);
    return NextResponse.json({ error: "Erro ao buscar checklist." }, { status: 500 });
  }
}

const addChecklistSchema = z.object({
  room: z.string().trim().min(1).default("Geral"),
  title: z.string().trim().min(2, "Título deve ter pelo menos 2 caracteres"),
});

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
    const body = await req.json();
    const parsed = addChecklistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const item = await prisma.appointmentChecklist.create({
      data: {
        appointmentId: id,
        room: parsed.data.room,
        task: parsed.data.title,
      },
    });

    return NextResponse.json(
      { success: true, data: { ...item, title: item.task } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao adicionar item de checklist:", error);
    return NextResponse.json({ error: "Erro ao adicionar item." }, { status: 500 });
  }
}

const updateChecklistSchema = z.object({
  itemId: z.string(),
  completed: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const parsed = updateChecklistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const item = await prisma.appointmentChecklist.update({
      where: {
        id: parsed.data.itemId,
        appointmentId: id,
      },
      data: {
        completed: parsed.data.completed,
        completedAt: parsed.data.completed ? new Date() : null,
        completedBy: parsed.data.completed ? session.name || session.email : null,
      },
    });

    return NextResponse.json({ success: true, data: { ...item, title: item.task } });
  } catch (error) {
    console.error("Erro ao atualizar item de checklist:", error);
    return NextResponse.json({ error: "Erro ao atualizar item." }, { status: 500 });
  }
}
