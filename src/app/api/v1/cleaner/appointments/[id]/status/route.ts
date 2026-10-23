import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/security/permissions";
import { CleanerService } from "@/services/cleaner-service";
import { prisma } from "@/lib/prisma";
import { getTargetCompanyId } from "@/lib/company-context";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const check = await requirePermission(req, "cleaner", "update");
  if (check.response) return check.response;
  const { session } = check;

  const { id } = await context.params;

  try {
    const body = await req.json();
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Status inválido. Use IN_PROGRESS ou COMPLETED." },
        { status: 400 }
      );
    }

    const companyId = await getTargetCompanyId(session.companyId);

    // Resolve professionalId
    let professionalId = session.professionalId;
    if (!professionalId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.sub },
        select: { professionalId: true },
      });
      professionalId = dbUser?.professionalId;
    }

    const isAdmin = session.role === "ADMIN" || session.role === "OPERATOR";

    const updated = await CleanerService.updateAppointmentStatus({
      companyId,
      appointmentId: id,
      professionalId,
      status: parsed.data.status,
      updatedBy: session.name || session.email,
      isAdmin,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error("Erro ao atualizar status do atendimento:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar status do atendimento." },
      { status: 400 }
    );
  }
}
