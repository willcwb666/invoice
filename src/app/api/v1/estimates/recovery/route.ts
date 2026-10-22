import { NextRequest, NextResponse } from "next/server";
import { processAbandonedEstimates } from "@/services/abandoned-recovery-service";
import { requirePermission } from "@/lib/security/permissions";
import { getTargetCompanyId } from "@/lib/company-context";

export async function POST(req: NextRequest) {
  const check = await requirePermission(req, "estimates", "update");
  if (check.response) return check.response;

  try {
    const companyId = await getTargetCompanyId(check.session.companyId);
    const result = await processAbandonedEstimates(companyId);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Erro ao processar orçamentos abandonados:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
