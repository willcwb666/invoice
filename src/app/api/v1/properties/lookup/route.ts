import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { requirePermission } from "@/lib/security/permissions";
import { RentCastService } from "@/services/rentcast-service";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`properties_lookup_${ip}`, { limit: 60, windowMs: 60000 });

  if (!rate.success) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(rate.reset) } }
    );
  }

  const check = await requirePermission(req, "clients", "read");
  if (check.response) return check.response;

  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!process.env.RENTCAST_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        found: false,
        error: "A chave RENTCAST_API_KEY não está ativa no ambiente do servidor.",
      },
      { status: 200 }
    );
  }

  if (!address || address.trim().length < 5) {
    return NextResponse.json(
      { error: "Endereço inválido ou muito curto para consulta." },
      { status: 400 }
    );
  }

  try {
    const result = await RentCastService.fetchPropertyDetailed(address);

    if (result.error) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          error: result.error,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        found: !!result.data,
        data: result.data,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=3600",
        },
      }
    );
  } catch (error) {
    console.error("[PropertyLookupRoute] Erro ao consultar dados do imóvel:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar consulta de imóvel." },
      { status: 500 }
    );
  }
}
