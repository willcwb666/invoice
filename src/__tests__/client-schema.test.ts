import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";

describe("Client Model Property Dimensions Schema", () => {
  it("includes bedrooms, bathrooms, squareFeet and propertyType fields in client model", async () => {
    const clientModel = Prisma.dmmf.datamodel.models.find((m) => m.name === "Client");
    expect(clientModel).toBeDefined();

    const fieldNames = clientModel!.fields.map((f) => f.name);

    expect(fieldNames).toContain("bedrooms");
    expect(fieldNames).toContain("bathrooms");
    expect(fieldNames).toContain("squareFeet");
    expect(fieldNames).toContain("propertyType");
  });
});
