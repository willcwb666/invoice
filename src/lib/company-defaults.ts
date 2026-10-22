/**
 * Valores-padrão de uma CompanyProfile. Dividido em dois conjuntos:
 *
 * - GENERIC_COMPANY_DEFAULTS: seguro reaproveitar em QUALQUER empresa nova
 *   (termos de pagamento genéricos, horário de trabalho, textos de
 *   recuperação de orçamento abandonado). Usado pelo onboarding
 *   (POST /api/v1/onboarding/complete) ao criar a empresa de um dono novo.
 *
 * - DEFAULT_COMPANY_SETTINGS: os valores de UMA empresa específica (a da
 *   Renata) - nome, e-mail, telefone, Zelle/Venmo reais dela, assinatura
 *   dela. Nunca deve ser usado como base pra criar uma empresa nova; é só
 *   o fallback/estado inicial da tela de Configurações dela mesma e do
 *   seed de dados de exemplo (seed-data.ts).
 */
export const GENERIC_COMPANY_DEFAULTS = {
  monthlyRevenueGoal: 6000,
  terms:
    "Payment is due within 7 days of invoice date. Late payments are subject to a 1.5% monthly finance charge.",
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

export const DEFAULT_COMPANY_SETTINGS = {
  ...GENERIC_COMPANY_DEFAULTS,
  name: "Renata Matos de Oliveira",
  email: "renatamatoz@gmail.com",
  phone: "9704129406",
  paymentMethods:
    "Zelle: 9704129406\nVenmo: @RenataMatoz\nCheck payable to: Renata Matos de Oliveira",
  signatureUrl: "/signatures/renata-signature.svg",
  logoUrl: "",
  icloudCalendarUrl: "",
};
