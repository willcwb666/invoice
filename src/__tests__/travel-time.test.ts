import { describe, it, expect } from "vitest";
import {
  getTravelTimeMinutes,
  extractCityFromAddress,
} from "@/lib/routing/travel-time";

describe("Travel Time & Routing Engine", () => {
  it("extracts Northern Colorado cities accurately from addresses", () => {
    expect(extractCityFromAddress("123 8th Ave, Greeley, CO 80631")).toBe("greeley");
    expect(extractCityFromAddress("3400 11th Ave, Evans, CO")).toBe("evans");
    expect(extractCityFromAddress("Main St, Windsor, Colorado")).toBe("windsor");
    expect(extractCityFromAddress("Harmony Rd, Timnath")).toBe("timnath");
    expect(extractCityFromAddress("Unknown location")).toBe("greeley");
  });

  it("calculates travel time using the pre-computed matrix as fallback", async () => {
    // Evans to Greeley drive time is 8 mins
    const minutes = await getTravelTimeMinutes(
      "Evans, CO",
      "Greeley, CO"
    );
    expect(minutes).toBe(8);
  });

  it("calculates local travel time inside the same city", async () => {
    const minutes = await getTravelTimeMinutes(
      "100 8th St, Greeley, CO",
      "200 10th St, Greeley, CO"
    );
    expect(minutes).toBe(8);
  });

  it("returns 0 if from and to addresses are identical", async () => {
    const minutes = await getTravelTimeMinutes(
      "100 8th St, Greeley, CO",
      "100 8th St, Greeley, CO"
    );
    expect(minutes).toBe(0);
  });

  it("applies traffic buffer minutes correctly", async () => {
    const minutes = await getTravelTimeMinutes(
      "Evans, CO",
      "Greeley, CO",
      10 // 10 min traffic buffer
    );
    expect(minutes).toBe(18); // 8 + 10
  });
});
