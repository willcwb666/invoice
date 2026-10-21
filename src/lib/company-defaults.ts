/**
 * Valores-padrão de uma CompanyProfile nova (nome, contato, cobrança, agenda).
 * Única fonte da verdade: antes esses mesmos valores apareciam hand-copied em
 * settings/page.tsx (duas vezes - estado inicial do form e fallback ao
 * carregar do banco) e em seed-data.ts, com risco de uma cópia ficar
 * desatualizada em relação às outras.
 */
export const DEFAULT_COMPANY_SETTINGS = {
  name: "Renata Matos de Oliveira",
  email: "renatamatoz@gmail.com",
  phone: "9704129406",
  monthlyRevenueGoal: 6000,
  paymentMethods:
    "Zelle: 9704129406\nVenmo: @RenataMatoz\nCheck payable to: Renata Matos de Oliveira",
  terms:
    "Payment is due within 7 days of invoice date. Late payments are subject to a 1.5% monthly finance charge.",
  signatureUrl: "/signatures/renata-signature.svg",
  logoUrl: "",
  icloudCalendarUrl: "",
  icloudSyncWindowDays: 60,
  abandonedRecoveryEnabled: true,
  abandonedRecoveryMinutes: 30,
  abandonedRecoveryDiscount: 10,
  abandonedRecoveryDiscountType: "PERCENTAGE",
  abandonedRecoverySubject: "Oferta especial para a limpeza da sua casa! ✨",
  abandonedRecoveryBody:
    "Olá [cliente]!\n\nVimos que você calculou o orçamento para a limpeza da sua casa no valor de $[valor].\n\nPara ajudar você a fechar conosco hoje, liberamos um desconto exclusivo de [desconto]!\n\nSeu valor especial com desconto fica por apenas $[valor_final].\n\nClique no botão abaixo para garantir sua vaga e agendar seu atendimento.",
  workDayStartHour: "08:00",
  workDayEndHour: "18:00",
  workDays: "MON,TUE,WED,THU,FRI",
  travelBufferMinutes: 10,
  defaultStandardDurationMinutes: 120,
  defaultDeepDurationMinutes: 300,
  recurrenceHorizonMonths: 2,
};
