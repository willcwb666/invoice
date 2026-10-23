import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

describe("Prisma Schema Access Fields & Cleaner Role", () => {
  it("has access fields defined in Client and Appointment models", async () => {
    // Verify client model field presence
    const clientFields = (prisma as any)._runtimeDataModel?.models?.Client?.fields || [];
    const clientFieldNames = clientFields.map((f: any) => f.name);

    expect(clientFieldNames).toContain("entryCode");
    expect(clientFieldNames).toContain("alarmCode");
    expect(clientFieldNames).toContain("pets");
    expect(clientFieldNames).toContain("parkingInstructions");

    // Verify appointment model field presence
    const apptFields = (prisma as any)._runtimeDataModel?.models?.Appointment?.fields || [];
    const apptFieldNames = apptFields.map((f: any) => f.name);

    expect(apptFieldNames).toContain("entryCode");
    expect(apptFieldNames).toContain("alarmCode");
    expect(apptFieldNames).toContain("pets");
    expect(apptFieldNames).toContain("parkingInstructions");
  });

  it("has CLEANER in Role enum and professionalId in User", async () => {
    const userFields = (prisma as any)._runtimeDataModel?.models?.User?.fields || [];
    const userFieldNames = userFields.map((f: any) => f.name);

    expect(userFieldNames).toContain("professionalId");

    const { Role } = await import("@prisma/client");
    expect(Role.CLEANER).toBe("CLEANER");
  });

  it("has AppointmentChecklist and AppointmentPhoto models registered", async () => {
    const models = Object.keys((prisma as any)._runtimeDataModel?.models || {});
    expect(models).toContain("AppointmentChecklist");
    expect(models).toContain("AppointmentPhoto");
  });
});
