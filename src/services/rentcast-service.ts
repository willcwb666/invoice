export interface PropertyData {
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  propertyType: string | null;
  formattedAddress?: string;
}

interface CacheEntry {
  data: PropertyData | null;
  timestamp: number;
}

const propertyCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class RentCastService {
  /**
   * Cleans and sanitizes raw address strings:
   * 1. Replaces hyphens between city and state: "Loveland - CO" -> "Loveland, CO"
   * 2. Deduplicates repeated city names: "Loveland, Loveland" -> "Loveland"
   * 3. Normalizes whitespace and extra commas
   */
  public static sanitizeAddress(address: string): string {
    if (!address) return "";
    let cleaned = address.trim();

    // Substitui traço antes da sigla de estado (ex: "Loveland - CO" -> "Loveland, CO")
    cleaned = cleaned.replace(/\s+-\s+([A-Za-z]{2})\b/g, ", $1");

    // Remove repetição consecutiva de cidade (ex: "Loveland, Loveland" ou "Loveland, Loveland,")
    cleaned = cleaned.replace(/\b([A-Za-z\s]+),\s*\1\b/gi, "$1");

    // Limpa vírgulas duplicadas ou espaços múltiplos
    cleaned = cleaned.replace(/,\s*,+/g, ",");
    cleaned = cleaned.replace(/\s+/g, " ");

    return cleaned.trim();
  }

  /**
   * Normalizes address string for cache consistency
   */
  private static normalizeAddress(address: string): string {
    return this.sanitizeAddress(address).toLowerCase().replace(/\s+/g, " ");
  }

  /**
   * Clears in-memory property cache (useful for testing or cache resets)
   */
  public static clearCache(): void {
    propertyCache.clear();
  }

  /**
   * Fetches property dimensions (bedrooms, bathrooms, square footage, property type)
   * from RentCast API with caching to preserve monthly API quota.
   * If a query with a zip code yields no results, it automatically retries without the zip
   * code as a fallback (frequently zip codes in client notes differ from tax record zip codes).
   */
  public static async fetchProperty(rawAddress: string): Promise<PropertyData | null> {
    if (!rawAddress || typeof rawAddress !== "string" || rawAddress.trim().length < 5) {
      return null;
    }

    const sanitized = this.sanitizeAddress(rawAddress);
    const normalized = this.normalizeAddress(sanitized);

    const cached = propertyCache.get(normalized);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const apiKey = process.env.RENTCAST_API_KEY;
    if (!apiKey) {
      console.warn("[RentCast] RENTCAST_API_KEY não configurada no ambiente.");
      return null;
    }

    const executeQuery = async (queryAddress: string): Promise<any[] | null> => {
      const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(queryAddress)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Api-Key": apiKey,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.warn(`[RentCast] Erro ao consultar endereço (${response.status}): ${response.statusText}`);
        return null;
      }

      const json = await response.json();
      return Array.isArray(json) ? json : null;
    };

    try {
      // 1. Tenta a consulta com o endereço sanitizado
      let data = await executeQuery(sanitized);

      // 2. Fallback inteligente: se não encontrou e o endereço possui CEP (ex: "80538"),
      // tenta buscar sem o CEP (ex: "3068 Aries Drive, Loveland, CO"), pois divergências
      // de CEP entre importações de calendário e a base municipal são comuns.
      if ((!data || data.length === 0) && /\b\d{5}(-\d{4})?\b/.test(sanitized)) {
        const withoutZip = sanitized.replace(/\b\d{5}(-\d{4})?\b/, "").trim().replace(/,\s*$/, "");
        if (withoutZip.length >= 8) {
          const fallbackData = await executeQuery(withoutZip);
          if (fallbackData && fallbackData.length > 0) {
            data = fallbackData;
          }
        }
      }

      if (!data || data.length === 0) {
        // Cache negative lookup to prevent re-querying unknown address immediately
        propertyCache.set(normalized, { data: null, timestamp: Date.now() });
        return null;
      }

      const firstMatch = data[0];
      const propertyData: PropertyData = {
        bedrooms: typeof firstMatch.bedrooms === "number" ? firstMatch.bedrooms : null,
        bathrooms: typeof firstMatch.bathrooms === "number" ? firstMatch.bathrooms : null,
        squareFeet: typeof firstMatch.squareFootage === "number" ? firstMatch.squareFootage : null,
        propertyType: firstMatch.propertyType || null,
        formattedAddress: firstMatch.formattedAddress || undefined,
      };

      propertyCache.set(normalized, { data: propertyData, timestamp: Date.now() });
      return propertyData;
    } catch (error) {
      console.error("[RentCast] Exceção inesperada ao consultar API:", error);
      return null;
    }
  }
}
