import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPendingOnboardingUser } from "@/lib/security/auth";
import { onboardingCompleteSchema } from "@/lib/validations/onboarding";
import { GENERIC_COMPANY_DEFAULTS } from "@/lib/company-defaults";

export async function POST(req: NextRequest) {
  const pending = await getPendingOnboardingUser(req);
  if (!pending) {
    return NextResponse.json(
      { error: "Sessão de cadastro inválida ou expirada. Faça login novamente." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parsed = onboardingCompleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { companyName, companyPhone, city, state, userPhone } = parsed.data;

    await prisma.$transaction(async (tx) => {
      const company = await tx.companyProfile.create({
        data: {
          ...GENERIC_COMPANY_DEFAULTS,
          name: companyName,
          email: pending.email,
          phone: companyPhone || "",
          paymentMethods: "",
          ...(city || state
            ? {
                addresses: {
                  create: [
                    {
                      label: "Principal",
                      street: "",
                      city: city || "",
                      state: state || "",
                      zipCode: "",
                      isDefault: true,
                    },
                  ],
                },
              }
            : {}),
        },
      });

      const updateResult = await tx.user.updateMany({
        where: { id: pending.id, companyId: null },
        data: {
          companyId: company.id,
          role: "ADMIN",
          status: "ACTIVE",
          ...(userPhone ? { phone: userPhone } : {}),
        },
      });

      if (updateResult.count === 0) {
        // Another concurrent request already completed onboarding for this
        // user first - throwing here rolls back this entire transaction,
        // including the company we just created above, so no orphan row survives.
        throw new Error("ONBOARDING_ALREADY_COMPLETED");
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "ONBOARDING_ALREADY_COMPLETED") {
      return NextResponse.json(
        { error: "O cadastro desta conta já foi concluído." },
        { status: 400 }
      );
    }
    console.error("Erro ao concluir onboarding:", error);
    return NextResponse.json(
      { error: "Não foi possível concluir o cadastro da empresa." },
      { status: 500 }
    );
  }
}
