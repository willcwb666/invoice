import { NextRequest, NextResponse } from "next/server";
import { ProfessionalService } from "@/services/professional-service";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { requirePermission } from "@/lib/security/permissions";
import { getTargetCompanyId } from "@/lib/company-context";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`profs_get_${ip}`, { limit: 120, windowMs: 60000 });
  if (!rate.success) {
    return NextResponse.json({ error: { code: "RATE_LIMIT", message: "Muitas requisições." } }, { status: 429 });
  }

  const check = await requirePermission(request, "professionals", "read");
  if (check.response) return check.response;

  try {
    const companyId = await getTargetCompanyId(check.session.companyId);
    const professionals = await ProfessionalService.listProfessionals(companyId);
    return NextResponse.json({ data: professionals });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "FETCH_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`profs_post_${ip}`, { limit: 30, windowMs: 60000 });
  if (!rate.success) {
    return NextResponse.json({ error: { code: "RATE_LIMIT", message: "Limite de criação atingido." } }, { status: 429 });
  }

  const check = await requirePermission(request, "professionals", "create");
  if (check.response) return check.response;

  try {
    const body = await request.json();
    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "O nome do profissional é obrigatório." } },
        { status: 400 }
      );
    }
    const companyId = await getTargetCompanyId(check.session.companyId);
    const created = await ProfessionalService.saveProfessional(companyId, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "SAVE_ERROR", message: error.message } },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`profs_patch_${ip}`, { limit: 40, windowMs: 60000 });
  if (!rate.success) {
    return NextResponse.json({ error: { code: "RATE_LIMIT", message: "Limite de edição atingido." } }, { status: 429 });
  }

  const check = await requirePermission(request, "professionals", "update");
  if (check.response) return check.response;

  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "ID do profissional é obrigatório." } },
        { status: 400 }
      );
    }
    const companyId = await getTargetCompanyId(check.session.companyId);
    const updated = await ProfessionalService.saveProfessional(companyId, body);
    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: error.message } },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`profs_del_${ip}`, { limit: 20, windowMs: 60000 });
  if (!rate.success) {
    return NextResponse.json({ error: { code: "RATE_LIMIT", message: "Limite de exclusão atingido." } }, { status: 429 });
  }

  const check = await requirePermission(request, "professionals", "delete");
  if (check.response) return check.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "ID do profissional é obrigatório." } },
        { status: 400 }
      );
    }
    const companyId = await getTargetCompanyId(check.session.companyId);
    const deleted = await ProfessionalService.deleteProfessional(companyId, id);
    if (!deleted) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Profissional não encontrado." } },
        { status: 404 }
      );
    }
    return NextResponse.json({ data: { deleted: true } });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "DELETE_ERROR", message: error.message } },
      { status: 400 }
    );
  }
}
