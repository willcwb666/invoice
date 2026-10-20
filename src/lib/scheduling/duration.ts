/**
 * Estimate Duration Calculator
 * Calcula a duração estimada do atendimento em minutos
 * baseado no tipo de serviço, quartos, banheiros, metragem, extras e condição da casa.
 */

export interface DurationFactors {
  cleaningType?: string | null;
  bedrooms?: number;
  fullBaths?: number;
  halfBaths?: number;
  sqFt?: number;
  isPartialScope?: boolean;
  selectedExtras?: string[];
  customServices?: Array<{ name: string; price: number }>;
  conditionRatings?: {
    bathrooms?: number | null;
    roomsKitchen?: number | null;
    pets?: number | null;
    kids?: number | null;
  } | null;
}

export function calculateEstimateDuration(meta: DurationFactors): number {
  const type = (meta.cleaningType || "STANDARD").toUpperCase();
  const bedrooms = Number(meta.bedrooms) || 0;
  const fullBaths = Number(meta.fullBaths) || 0;
  const halfBaths = Number(meta.halfBaths) || 0;
  const totalBaths = fullBaths + halfBaths * 0.5;
  const sqFt = Number(meta.sqFt) || 0;
  const extras = meta.selectedExtras || [];
  const customItems = meta.customServices || [];

  // Média de condição da casa (1 a 5)
  const conditionValues: number[] = [];
  if (meta.conditionRatings?.bathrooms) conditionValues.push(meta.conditionRatings.bathrooms);
  if (meta.conditionRatings?.roomsKitchen) conditionValues.push(meta.conditionRatings.roomsKitchen);
  if (meta.conditionRatings?.pets) conditionValues.push(meta.conditionRatings.pets);
  if (meta.conditionRatings?.kids) conditionValues.push(meta.conditionRatings.kids);

  const avgCondition =
    conditionValues.length > 0
      ? conditionValues.reduce((a, b) => a + b, 0) / conditionValues.length
      : 1.0;

  let baseMinutes = 105; // 1h45 padrão mínimo

  if (type === "DEEP" || type === "MOVE") {
    // Deep Cleaning / Move Out: 4h00 a 6h00 (240 a 360 min)
    baseMinutes = 240;

    // Ajuste por banheiros
    if (totalBaths > 2) {
      baseMinutes += Math.round((totalBaths - 2) * 25);
    }
    // Ajuste por quartos
    if (bedrooms > 3) {
      baseMinutes += (bedrooms - 3) * 20;
    }
    // Ajuste por metragem
    if (sqFt > 2000) {
      baseMinutes += Math.round(((sqFt - 2000) / 500) * 25);
    }
    // Ajuste por sujeira/condição pesada
    if (avgCondition > 2.5) {
      baseMinutes += Math.round((avgCondition - 2.5) * 30);
    }

    // Trava entre 240 e 360 minutos
    baseMinutes = Math.min(360, Math.max(240, baseMinutes));
  } else {
    // Standard Cleaning: 1h45 a 2h30 (105 a 150 min)
    baseMinutes = 105;

    // Banheiros adicionais além de 1
    if (totalBaths > 1) {
      baseMinutes += Math.round((totalBaths - 1) * 15);
    }
    // Quartos além de 2
    if (bedrooms > 2) {
      baseMinutes += (bedrooms - 2) * 10;
    }
    // Metragem além de 1500 sq ft
    if (sqFt > 1500) {
      baseMinutes += Math.round(((sqFt - 1500) / 500) * 10);
    }
    // Condição da casa
    if (avgCondition >= 3) {
      baseMinutes += Math.round((avgCondition - 2) * 12);
    }

    // Trava do Standard entre 105 e 150 minutos (1h45 a 2h30)
    baseMinutes = Math.min(150, Math.max(105, baseMinutes));
  }

  // Extras adicionam tempo específico
  let extrasMinutes = 0;
  extras.forEach((ext) => {
    const lower = ext.toLowerCase();
    if (lower.includes("oven")) extrasMinutes += 30;
    else if (lower.includes("fridge")) extrasMinutes += 30;
    else if (lower.includes("cabinets")) extrasMinutes += 30;
    else if (lower.includes("blinds")) extrasMinutes += 25;
    else if (lower.includes("heavy duty")) extrasMinutes += 45;
    else if (lower.includes("dishes")) extrasMinutes += 20;
    else if (lower.includes("laundry")) extrasMinutes += 25;
    else if (lower.includes("carpet")) extrasMinutes += 35;
    else extrasMinutes += 20;
  });

  // Serviços customizados identificados por IA: 20 min cada
  const customMinutes = customItems.length * 20;

  return baseMinutes + extrasMinutes + customMinutes;
}
