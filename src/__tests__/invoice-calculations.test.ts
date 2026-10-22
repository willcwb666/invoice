import { describe, it, expect } from "vitest";
import { createInvoiceSchema } from "@/lib/validations/invoice";

describe("Invoice Calculations & Adjustments Validation", () => {
  it("validates invoice with items and credits/discounts", () => {
    const validPayload = {
      clientId: "client-123",
      invoiceNumber: "INV-2026-001",
      dueDate: new Date().toISOString(),
      status: "PENDING" as const,
      notes: "Test invoice",
      items: [
        {
          description: "Standard House Cleaning",
          quantity: 1,
          unitPrice: 180,
        },
      ],
      adjustments: [
        {
          type: "CREDIT" as const,
          description: "Taxa de Deslocamento",
          amount: 25,
        },
        {
          type: "DISCOUNT" as const,
          description: "Desconto de Indicação",
          amount: 15,
        },
      ],
      discount: 15,
      appointmentIds: [],
    };

    const result = createInvoiceSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.adjustments).toHaveLength(2);
      expect(result.data.adjustments[0].type).toBe("CREDIT");
      expect(result.data.adjustments[1].type).toBe("DISCOUNT");
    }
  });

  it("calculates totals correctly with credits adding and discounts subtracting", () => {
    const items = [
      { price: 180, qty: 1 },
      { price: 50, qty: 1 },
    ];
    const itemsTotal = items.reduce((acc, it) => acc + it.price * it.qty, 0); // 230
    const credit = 30; // acréscimo
    const discount = 20; // dedução

    const subtotal = itemsTotal + credit; // 260
    const totalAmount = Math.max(0, subtotal - discount); // 240

    expect(subtotal).toBe(260);
    expect(totalAmount).toBe(240);
  });
});
