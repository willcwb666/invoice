import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/security/permissions";
import { CleanerService, getDenverTodayDateString } from "@/services/cleaner-service";
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

    // 1. Resolve professionalId from session or DB
    let professionalId = session.professionalId;
    let dbUser: any = null;
    if (!professionalId) {
      dbUser = await prisma.user.findUnique({
        where: { id: session.sub },
        select: { id: true, professionalId: true, email: true, name: true },
      });
      professionalId = dbUser?.professionalId;
    }

    // Auto-link fallback if professionalId is still null
    if (!professionalId && (session.email || dbUser?.email)) {
      const email = session.email || dbUser?.email;
      const firstName = (session.name || dbUser?.name || "").split(" ")[0];
      const matchedProf = await prisma.professional.findFirst({
        where: {
          companyId,
          OR: [
            ...(email ? [{ email }] : []),
            ...(firstName ? [{ name: { contains: firstName, mode: "insensitive" as const } }] : []),
          ],
        },
      });
      if (matchedProf) {
        professionalId = matchedProf.id;
        await prisma.user
          .update({
            where: { id: session.sub },
            data: { professionalId: matchedProf.id },
          })
          .catch(() => {});
      }
    }

    // 2. Handle Admin/Operator preview and cleaner selector
    const isAdminOrOperator = session.role === "ADMIN" || session.role === "OPERATOR";
    const cleanerIdParam = req.nextUrl.searchParams.get("cleanerId");

    let targetProfessionalId: string | null = professionalId || null;
    let includeUnassigned = false;

    if (isAdminOrOperator) {
      if (cleanerIdParam === "all") {
        targetProfessionalId = null;
        includeUnassigned = true;
      } else if (cleanerIdParam) {
        targetProfessionalId = cleanerIdParam;
        includeUnassigned = false;
      } else {
        // Default for admin/operator: if no cleaner specified, show own + unassigned houses
        includeUnassigned = true;
      }
    } else {
      includeUnassigned = false;
    }

    // 3. Default to today in America/Denver (YYYY-MM-DD)
    const dateParam = req.nextUrl.searchParams.get("date");
    const denverToday = getDenverTodayDateString();
    const targetDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : denverToday;

    // 4. Query sanitized appointments
    const appointments = await CleanerService.listCleanerAppointments({
      companyId,
      professionalId: targetProfessionalId,
      date: targetDate,
      includeUnassigned,
    });

    // 5. Fetch current cleaner info & all active professionals for switcher
    let professionalInfo = null;
    if (targetProfessionalId) {
      professionalInfo = await prisma.professional.findUnique({
        where: { id: targetProfessionalId },
        select: { id: true, name: true, phone: true, color: true, isOwner: true },
      });
    }

    let allProfessionals: Array<{ id: string; name: string; isOwner: boolean; color: string | null }> = [];
    if (isAdminOrOperator) {
      allProfessionals = await prisma.professional.findMany({
        where: { companyId, active: true },
        select: { id: true, name: true, isOwner: true, color: true },
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json({
      success: true,
      data: appointments,
      date: targetDate,
      professional: professionalInfo,
      allProfessionals,
      isAdminView: isAdminOrOperator,
    });
  } catch (error: any) {
    console.error("Erro ao listar atendimentos da diarista:", error);
    return NextResponse.json(
      { error: "Erro ao buscar atendimentos do dia." },
      { status: 500 }
    );
  }
}
