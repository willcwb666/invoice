import { AddressNormalizer } from "@/lib/address-normalizer";

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
   * Sanitizes address string using AddressNormalizer
   */
  public static sanitizeAddress(address: string): string {
    return AddressNormalizer.normalize(address).fullAddress;
  }

  /**
   * Normalizes address string for cache consistency
   */
  private static normalizeAddress(address: string): string {
    return AddressNormalizer.normalize(address).fullAddress.toLowerCase().replace(/\s+/g, " ");
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

    const norm = AddressNormalizer.normalize(rawAddress);
    const cacheKey = norm.fullAddress.toLowerCase().replace(/\s+/g, " ");

    const cached = propertyCache.get(cacheKey);
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
      // 1. Tenta a consulta com o endereço completo normalizado
      let data = await executeQuery(norm.fullAddress);

      // 2. Fallback inteligente: se não encontrou e possui fallback sem CEP diferente
      // (ex: "3068 Aries Drive, Loveland, CO"), busca sem o CEP para cobrir divergências cadastrais.
      if ((!data || data.length === 0) && norm.fallbackAddress && norm.fallbackAddress !== norm.fullAddress) {
        const fallbackData = await executeQuery(norm.fallbackAddress);
        if (fallbackData && fallbackData.length > 0) {
          data = fallbackData;
        }
      }

      if (!data || data.length === 0) {
        // Cache negative lookup to prevent re-querying unknown address immediately
        propertyCache.set(cacheKey, { data: null, timestamp: Date.now() });
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

      propertyCache.set(cacheKey, { data: propertyData, timestamp: Date.now() });
      return propertyData;
    } catch (error) {
      console.error("[RentCast] Exceção inesperada ao consultar API:", error);
      return null;
    }
  }
}
