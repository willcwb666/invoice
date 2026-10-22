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
   * Normalizes address string for cache consistency
   */
  private static normalizeAddress(address: string): string {
    return address.trim().toLowerCase().replace(/\s+/g, " ");
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
   */
  public static async fetchProperty(address: string): Promise<PropertyData | null> {
    if (!address || typeof address !== "string" || address.trim().length < 5) {
      return null;
    }

    const normalized = this.normalizeAddress(address);
    const cached = propertyCache.get(normalized);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const apiKey = process.env.RENTCAST_API_KEY;
    if (!apiKey) {
      console.warn("[RentCast] RENTCAST_API_KEY não configurada no ambiente.");
      return null;
    }

    try {
      const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address.trim())}`;
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

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
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
