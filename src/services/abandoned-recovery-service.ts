import { prisma } from "@/lib/prisma";
import { sendAbandonedRecoveryEmail } from "@/lib/email";
import crypto from "crypto";

export async function processAbandonedEstimates(companyId: string) {
  // 1. Obter perfil da empresa com as configurações ativas
  const company = await prisma.companyProfile.findUnique({
    where: { id: companyId },
    include: { addresses: true },
  });

  if (!company || !company.abandonedRecoveryEnabled) {
    return { processed: 0, skipped: true, reason: "Recuperação desativada ou perfil não encontrado" };
  }

  const waitMinutes = company.abandonedRecoveryMinutes || 30;
  const cutoffTime = new Date(Date.now() - waitMinutes * 60 * 1000);

  // 2. Localizar orçamentos em rascunho com tempo excedido e e-mail disponível
  const abandonedEstimates = await prisma.estimate.findMany({
    where: {
      companyId: company.id,
      status: "DRAFT",
      abandonedEmailSentAt: null,
      updatedAt: { lte: cutoffTime },
      client: {
        email: { not: null },
      },
    },
    include: {
      client: true,
      items: true,
    },
  });

  let sentCount = 0;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  for (const est of abandonedEstimates) {
    if (!est.client?.email) continue;

    // Garante token público único
    const publicToken = est.publicToken || crypto.randomUUID();
    const originalSubtotal = Number(est.subtotal) || Number(est.totalAmount) || 0;

    // Cálculo do desconto
    const discountVal = Number(company.abandonedRecoveryDiscount) || 10;
    const isPercentage = company.abandonedRecoveryDiscountType !== "FIXED";

    let discountAmount = 0;
    let discountLabel = "";

    if (isPercentage) {
      discountAmount = Math.round((originalSubtotal * discountVal) / 100);
      discountLabel = `${discountVal}% OFF`;
    } else {
      discountAmount = Math.min(originalSubtotal, discountVal);
      discountLabel = `$${discountVal.toFixed(2)} OFF`;
    }

    const discountedTotal = Math.max(0, originalSubtotal - discountAmount);
    const bookingUrl = `${baseUrl}/p/estimate/${publicToken}`;

    // Dispara e-mail de recuperação
    const emailRes = await sendAbandonedRecoveryEmail({
      to: est.client.email,
      clientName: est.client.name,
      originalAmount: originalSubtotal,
      discountLabel,
      discountedAmount: discountedTotal,
      subject: company.abandonedRecoverySubject || undefined,
      bodyTemplate: company.abandonedRecoveryBody || undefined,
      bookingUrl,
    });

    if (emailRes.success) {
      // Atualiza o orçamento no banco
      await prisma.estimate.update({
        where: { id: est.id },
        data: {
          publicToken,
          discount: discountAmount,
          totalAmount: discountedTotal,
          abandonedEmailSentAt: new Date(),
          abandonedDiscountApplied: true,
        },
      });
      sentCount++;
    }
  }

  return { processed: sentCount, totalFound: abandonedEstimates.length };
}

export async function sendTestRecoveryEmail(targetEmail: string, companyId: string) {
  const company = await prisma.companyProfile.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("Perfil da empresa não encontrado.");

  const discountVal = Number(company.abandonedRecoveryDiscount) || 10;
  const isPercentage = company.abandonedRecoveryDiscountType !== "FIXED";
  const originalSubtotal = 200.0;
  const discountAmount = isPercentage
    ? Math.round((originalSubtotal * discountVal) / 100)
    : Math.min(originalSubtotal, discountVal);
  const discountedTotal = originalSubtotal - discountAmount;
  const discountLabel = isPercentage ? `${discountVal}% OFF` : `$${discountVal.toFixed(2)} OFF`;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const dummyToken = "demo-preview-token";

  return sendAbandonedRecoveryEmail({
    to: targetEmail,
    clientName: "Cliente Teste",
    originalAmount: originalSubtotal,
    discountLabel,
    discountedAmount: discountedTotal,
    subject: company.abandonedRecoverySubject || undefined,
    bodyTemplate: company.abandonedRecoveryBody || undefined,
    bookingUrl: `${baseUrl}/p/estimate/${dummyToken}`,
  });
}
