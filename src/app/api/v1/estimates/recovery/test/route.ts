import { NextRequest, NextResponse } from "next/server";
import { sendTestRecoveryEmail } from "@/services/abandoned-recovery-service";
import { requirePermission } from "@/lib/security/permissions";
import { getTargetCompanyId } from "@/lib/company-context";

export async function POST(req: NextRequest) {
  const check = await requirePermission(req, "estimates", "update");
  if (check.response) return check.response;

  try {
    const body = await req.json();
    const email = body.email;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Informe um endereço de e-mail válido para teste." },
        { status: 400 }
      );
    }

    const companyId = await getTargetCompanyId(check.session.companyId);
    const res = await sendTestRecoveryEmail(email, companyId);
    if (!res.success) {
      return NextResponse.json(
        { success: false, error: res.error || "Falha ao enviar e-mail de teste." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: `E-mail de teste enviado para ${email}!` });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}
