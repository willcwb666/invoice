import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/v1/properties/lookup/route";
import { RentCastService } from "../services/rentcast-service";
import * as permissionsModule from "../lib/security/permissions";

describe("GET /api/v1/properties/lookup", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Default authorized admin session mock
    vi.spyOn(permissionsModule, "requirePermission").mockResolvedValue({
      session: {
        id: "user-1",
        role: "ADMIN",
        email: "test@example.com",
        name: "Test Admin",
        companyId: "comp-1",
      },
    } as any);
  });

  it("returns 400 if address param is missing or too short", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/properties/lookup?address=abc");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns property data when found by RentCastService", async () => {
    vi.spyOn(RentCastService, "fetchProperty").mockResolvedValueOnce({
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1750,
      propertyType: "Single Family",
      formattedAddress: "123 Main St, Greeley, CO 80634",
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/properties/lookup?address=" +
        encodeURIComponent("123 Main St, Greeley, CO 80634")
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.found).toBe(true);
    expect(json.data).toEqual({
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1750,
      propertyType: "Single Family",
      formattedAddress: "123 Main St, Greeley, CO 80634",
    });
  });

  it("returns found: false when RentCastService returns null", async () => {
    vi.spyOn(RentCastService, "fetchProperty").mockResolvedValueOnce(null);

    const req = new NextRequest(
      "http://localhost:3000/api/v1/properties/lookup?address=" +
        encodeURIComponent("999 Nonexistent St, Denver, CO")
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.found).toBe(false);
    expect(json.data).toBeNull();
  });
});
