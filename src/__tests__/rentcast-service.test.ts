import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RentCastService } from "../services/rentcast-service";

describe("RentCastService", () => {
  const originalEnv = process.env.RENTCAST_API_KEY;

  beforeEach(() => {
    RentCastService.clearCache();
    process.env.RENTCAST_API_KEY = "test-rentcast-key";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.RENTCAST_API_KEY = originalEnv;
  });

  it("fetches property data successfully from RentCast API", async () => {
    const mockApiResponse = [
      {
        id: "prop_123",
        formattedAddress: "5500 E Peakview Ave, Centennial, CO 80121",
        addressLine1: "5500 E Peakview Ave",
        city: "Centennial",
        state: "CO",
        zipCode: "80121",
        bedrooms: 4,
        bathrooms: 2.5,
        squareFootage: 2650,
        propertyType: "Single Family",
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    } as any);

    const result = await RentCastService.fetchProperty("5500 E Peakview Ave, Centennial, CO 80121");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain("https://api.rentcast.io/v1/properties?address=");
    const headers = (fetchSpy.mock.calls[0][1] as any)?.headers;
    expect(headers?.["X-Api-Key"]).toBe("test-rentcast-key");

    expect(result).toEqual({
      bedrooms: 4,
      bathrooms: 2.5,
      squareFeet: 2650,
      propertyType: "Single Family",
      formattedAddress: "5500 E Peakview Ave, Centennial, CO 80121",
    });
  });

  it("caches repeated queries for the same normalized address to preserve API quota", async () => {
    const mockApiResponse = [
      {
        bedrooms: 3,
        bathrooms: 2,
        squareFootage: 1800,
        propertyType: "Condo",
        formattedAddress: "100 Main St, Denver, CO",
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    } as any);

    // Call 1
    const res1 = await RentCastService.fetchProperty("100 Main St, Denver, CO");
    // Call 2 with different casing / whitespace
    const res2 = await RentCastService.fetchProperty("  100   MAIN ST, DENVER, CO  ");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res1).toEqual(res2);
    expect(res2?.squareFeet).toBe(1800);
  });

  it("returns null when property is not found or API returns empty array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    } as any);

    const result = await RentCastService.fetchProperty("Rural Unknown Road, Nowhere, CO");
    expect(result).toBeNull();
  });

  it("returns null gracefully when API key is missing", async () => {
    delete process.env.RENTCAST_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await RentCastService.fetchProperty("123 Any St, Denver, CO");
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("handles API HTTP errors gracefully without throwing unhandled exceptions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as any);

    const result = await RentCastService.fetchProperty("123 Error St");
    expect(result).toBeNull();
  });
});
