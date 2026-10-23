import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/security/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addPhotoSchema = z.object({
  photoType: z.enum(["BEFORE", "AFTER"]),
  photoUrl: z.string().min(5, "URL ou imagem da foto é obrigatória"),
  room: z.string().trim().optional(),
  caption: z.string().trim().optional(),
});

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
    const photos = await prisma.appointmentPhoto.findMany({
      where: { appointmentId: id },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: photos.map((p) => ({
        ...p,
        photoUrl: p.imageUrl,
        createdAt: p.uploadedAt,
      })),
    });
  } catch (error) {
    console.error("Erro ao buscar fotos do atendimento:", error);
    return NextResponse.json({ error: "Erro ao buscar fotos." }, { status: 500 });
  }
}

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
    const parsed = addPhotoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const photo = await prisma.appointmentPhoto.create({
      data: {
        appointmentId: id,
        photoType: parsed.data.photoType,
        imageUrl: parsed.data.photoUrl,
        room: parsed.data.room || null,
        caption: parsed.data.caption || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...photo,
          photoUrl: photo.imageUrl,
          createdAt: photo.uploadedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao registrar foto:", error);
    return NextResponse.json({ error: "Erro ao salvar foto." }, { status: 500 });
  }
}
