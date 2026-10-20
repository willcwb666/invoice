/**
 * Route & Travel Time Engine
 * Calcula o tempo de deslocamento em minutos de carro entre endereços,
 * com foco especial na região de Northern Colorado (Evans, Greeley, Timnath, Windsor, Loveland, Fort Collins, etc).
 * 
 * Utiliza cache em memória, matriz geográfica pré-calculada e fallback resiliente.
 */

// Cache em memória para tempos calculados entre pares de endereços/cidades
const travelTimeCache = new Map<string, number>();

// Matriz de tempo médio em minutos entre cidades/regiões de Northern Colorado
const NOCO_DRIVE_MATRIX: Record<string, Record<string, number>> = {
  evans: {
    evans: 6,
    greeley: 8,
    garden_city: 5,
    windsor: 18,
    severance: 22,
    timnath: 26,
    loveland: 26,
    johnstown: 18,
    milliken: 14,
    fort_collins: 36,
    eaton: 20,
    berthoud: 32,
    longmont: 42,
  },
  greeley: {
    evans: 8,
    greeley: 7,
    garden_city: 5,
    windsor: 16,
    severance: 18,
    timnath: 24,
    loveland: 28,
    johnstown: 22,
    milliken: 18,
    fort_collins: 34,
    eaton: 14,
    berthoud: 35,
    longmont: 45,
  },
  timnath: {
    timnath: 5,
    fort_collins: 12,
    windsor: 10,
    severance: 14,
    loveland: 18,
    greeley: 24,
    evans: 26,
    johnstown: 22,
    eaton: 26,
  },
  windsor: {
    windsor: 6,
    timnath: 10,
    severance: 8,
    greeley: 16,
    evans: 18,
    loveland: 18,
    fort_collins: 20,
    johnstown: 20,
    eaton: 22,
  },
  fort_collins: {
    fort_collins: 8,
    timnath: 12,
    windsor: 20,
    loveland: 20,
    greeley: 34,
    evans: 36,
    severance: 24,
  },
  loveland: {
    loveland: 8,
    fort_collins: 20,
    windsor: 18,
    timnath: 18,
    johnstown: 14,
    berthoud: 12,
    greeley: 28,
    evans: 26,
  },
  johnstown: {
    johnstown: 6,
    milliken: 8,
    evans: 18,
    greeley: 22,
    loveland: 14,
    windsor: 20,
    timnath: 22,
  },
  milliken: {
    milliken: 6,
    johnstown: 8,
    evans: 14,
    greeley: 18,
    loveland: 18,
  },
  eaton: {
    eaton: 6,
    greeley: 14,
    evans: 20,
    severance: 14,
    windsor: 22,
    timnath: 26,
  },
  severance: {
    severance: 6,
    windsor: 8,
    timnath: 14,
    eaton: 14,
    greeley: 18,
    evans: 22,
    fort_collins: 24,
  },
};

/**
 * Normaliza e identifica a cidade a partir de uma string de endereço
 */
export function extractCityFromAddress(address: string): string {
  if (!address) return "greeley";
  const lower = address.toLowerCase();

  if (lower.includes("timnath")) return "timnath";
  if (lower.includes("windsor")) return "windsor";
  if (lower.includes("severance")) return "severance";
  if (lower.includes("fort collins") || lower.includes("ft collins") || lower.includes("ft. collins"))
    return "fort_collins";
  if (lower.includes("loveland")) return "loveland";
  if (lower.includes("johnstown")) return "johnstown";
  if (lower.includes("milliken")) return "milliken";
  if (lower.includes("eaton")) return "eaton";
  if (lower.includes("berthoud")) return "berthoud";
  if (lower.includes("longmont")) return "longmont";
  if (lower.includes("garden city")) return "garden_city";
  if (lower.includes("evans") || lower.includes("80620")) return "evans";
  if (lower.includes("greeley") || lower.includes("80631") || lower.includes("80634")) return "greeley";

  return "greeley";
}

/**
 * Retorna o tempo estimado de deslocamento de carro em minutos entre dois endereços.
 * Execução instantânea e sem custos de API externa.
 */
export async function getTravelTimeMinutes(
  fromAddress: string,
  toAddress: string,
  trafficBufferMinutes = 0
): Promise<number> {
  const from = (fromAddress || "").trim();
  const to = (toAddress || "").trim();

  if (!from || !to) return 10 + trafficBufferMinutes;
  if (from.toLowerCase() === to.toLowerCase()) return 0;

  const cacheKey = `${from.toLowerCase()}___${to.toLowerCase()}`;
  if (travelTimeCache.has(cacheKey)) {
    return travelTimeCache.get(cacheKey)! + trafficBufferMinutes;
  }

  const cityA = extractCityFromAddress(from);
  const cityB = extractCityFromAddress(to);

  let minutes = 15; // default fallback

  if (cityA === cityB) {
    minutes = 8; // mesmo município / bairro
  } else if (NOCO_DRIVE_MATRIX[cityA]?.[cityB]) {
    minutes = NOCO_DRIVE_MATRIX[cityA][cityB];
  } else if (NOCO_DRIVE_MATRIX[cityB]?.[cityA]) {
    minutes = NOCO_DRIVE_MATRIX[cityB][cityA];
  } else {
    // Distância média regional se não cadastrada no mapa direto
    minutes = 25;
  }

  travelTimeCache.set(cacheKey, minutes);
  return minutes + trafficBufferMinutes;
}
