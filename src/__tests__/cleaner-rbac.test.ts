import { describe, it, expect } from "vitest";
import { hasPermission } from "@/lib/security/rbac";
import { CleanerService } from "@/services/cleaner-service";

describe("Cleaner RBAC & Zero Financial Exposure", () => {
  it("enforces CLEANER role cannot access financial screens", () => {
    expect(hasPermission("CLEANER", "financeiro", "read")).toBe(false);
    expect(hasPermission("CLEANER", "invoices", "read")).toBe(false);
    expect(hasPermission("CLEANER", "payments", "read")).toBe(false);
    expect(hasPermission("CLEANER", "commissions", "read")).toBe(false);
    expect(hasPermission("CLEANER", "reports", "read")).toBe(false);
    expect(hasPermission("CLEANER", "settings", "read")).toBe(false);
    expect(hasPermission("CLEANER", "users", "read")).toBe(false);
    expect(hasPermission("CLEANER", "appointments", "read")).toBe(false);
  });

  it("enforces CLEANER role has read and update access to cleaner portal", () => {
    expect(hasPermission("CLEANER", "cleaner", "read")).toBe(true);
    expect(hasPermission("CLEANER", "cleaner", "update")).toBe(true);
    expect(hasPermission("CLEANER", "cleaner", "create")).toBe(false);
    expect(hasPermission("CLEANER", "cleaner", "delete")).toBe(false);
    expect(hasPermission("CLEANER", "cleaner", "export")).toBe(false);
  });

  it("enforces ADMIN has full access to cleaner screen", () => {
    expect(hasPermission("ADMIN", "cleaner", "read")).toBe(true);
    expect(hasPermission("ADMIN", "cleaner", "create")).toBe(true);
    expect(hasPermission("ADMIN", "cleaner", "update")).toBe(true);
    expect(hasPermission("ADMIN", "cleaner", "delete")).toBe(true);
  });

  it("enforces VIEWER and FINANCIAL cannot access cleaner portal", () => {
    expect(hasPermission("VIEWER", "cleaner", "read")).toBe(false);
    expect(hasPermission("FINANCIAL", "cleaner", "read")).toBe(false);
  });

  it("strictly strips all financial fields and calculates access code fallbacks", () => {
    const rawAppointment = {
      id: "appt_123",
      date: new Date("2026-10-23T08:00:00.000Z"),
      timeStart: "08:30",
      timeEnd: "11:30",
      status: "CONFIRMED",
      price: 250.0,
      invoiced: true,
      invoiceId: "inv_999",
      paid: true,
      billable: true,
      billingType: "HOURLY",
      notes: "Cuidado com o cachorro",
      entryCode: "9988",
      alarmCode: null, // Should fall back to client
      pets: null, // Should fall back to client
      parkingInstructions: "Estacionar na frente da garagem",
      services: [{ name: "Deep Clean", price: 250 }],
      client: {
        id: "cli_1",
        name: "Maria Silva",
        phone: "9701112233",
        address: "123 Main St",
        city: "Evans",
        state: "CO",
        zip: "80620",
        entryCode: "1122",
        alarmCode: "4321",
        pets: "Golden Retriever dócil",
        parkingInstructions: "Rua pública",
      },
      checklists: [
        { id: "chk_1", room: "Cozinha", title: "Limpar microondas", completed: true, completedAt: new Date(), completedBy: "Renata" }
      ],
      photos: [
        { id: "pho_1", photoType: "BEFORE", photoUrl: "https://example.com/p1.jpg", room: "Cozinha", caption: "Antes", createdAt: new Date() }
      ],
      professionals: [
        { professionalId: "prof_1", professional: { id: "prof_1", name: "Renata", color: "#6366f1" } }
      ],
    };

    const sanitized = CleanerService.sanitizeAppointment(rawAppointment as any);

    // Verify financial data is completely excluded
    expect((sanitized as any).price).toBeUndefined();
    expect((sanitized as any).invoiced).toBeUndefined();
    expect((sanitized as any).invoiceId).toBeUndefined();
    expect((sanitized as any).paid).toBeUndefined();
    expect((sanitized as any).billable).toBeUndefined();
    expect((sanitized as any).billingType).toBeUndefined();

    // Verify access fields with fallback logic
    expect(sanitized.access.entryCode).toBe("9988"); // Override from appointment
    expect(sanitized.access.alarmCode).toBe("4321"); // Fallback from client
    expect(sanitized.access.pets).toBe("Golden Retriever dócil"); // Fallback from client
    expect(sanitized.access.parkingInstructions).toBe("Estacionar na frente da garagem"); // Override from appointment

    // Verify basic info
    expect(sanitized.client.name).toBe("Maria Silva");
    expect(sanitized.timeStart).toBe("08:30");
    expect(sanitized.checklists).toHaveLength(1);
    expect(sanitized.photos).toHaveLength(1);
    expect(sanitized.team[0].name).toBe("Renata");
  });
});
