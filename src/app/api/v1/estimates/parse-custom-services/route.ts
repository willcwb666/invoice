import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { parseCustomServices } from "@/lib/custom-services-parser";
import { requirePermission } from "@/lib/security/permissions";
import { z } from "zod";

const parseSchema = z.object({
  text: z.string().trim().min(2, "Texto muito curto"),
  defaultPrice: z.number().positive().default(20),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`estimates_parse_${ip}`, { limit: 40, windowMs: 60000 });
  if (!rate.success) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
  }

  const check = await requirePermission(req, "estimates", "create");
  if (check.response) return check.response;

  try {
    const body = await req.json();
    const parsed = parseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const items = await parseCustomServices(parsed.data.text, parsed.data.defaultPrice);
    return NextResponse.json({ success: true, data: items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao interpretar pedidos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
