import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/security/permissions";
import { CleanerService } from "@/services/cleaner-service";
import { prisma } from "@/lib/prisma";
import { getTargetCompanyId } from "@/lib/company-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const check = await requirePermission(req, "cleaner", "read");
  if (check.response) return check.response;
  const { session } = check;

  try {
    const companyId = await getTargetCompanyId(session.companyId);

    // Resolve professionalId
    let professionalId = session.professionalId;
    if (!professionalId) {
      // Check user record
      const dbUser = await prisma.user.findUnique({
        where: { id: session.sub },
        select: { professionalId: true },
      });
      professionalId = dbUser?.professionalId;
    }

    // If still not linked and user is an admin or operator, allow querying by ?cleanerId=
    const cleanerIdParam = req.nextUrl.searchParams.get("cleanerId");
    if ((session.role === "ADMIN" || session.role === "OPERATOR") && cleanerIdParam) {
      professionalId = cleanerIdParam;
    } else if (!professionalId && (session.role === "ADMIN" || session.role === "OPERATOR")) {
      // Fallback for admin preview: pick first active professional in company
      const firstProf = await prisma.professional.findFirst({
        where: { companyId, active: true },
        orderBy: { name: "asc" },
      });
      if (firstProf) professionalId = firstProf.id;
    }

    // Default to today in YYYY-MM-DD
    const dateParam = req.nextUrl.searchParams.get("date");
    const todayStr = new Date().toISOString().split("T")[0];
    const targetDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr;

    const appointments = await CleanerService.listCleanerAppointments({
      companyId,
      professionalId,
      date: targetDate,
    });

    let professionalInfo = null;
    if (professionalId) {
      professionalInfo = await prisma.professional.findUnique({
        where: { id: professionalId },
        select: { id: true, name: true, phone: true, color: true },
      });
    }

    return NextResponse.json({
      success: true,
      data: appointments,
      date: targetDate,
      professional: professionalInfo,
    });
  } catch (error: any) {
    console.error("Erro ao listar atendimentos da diarista:", error);
    return NextResponse.json(
      { error: "Erro ao buscar atendimentos do dia." },
      { status: 500 }
    );
  }
}
