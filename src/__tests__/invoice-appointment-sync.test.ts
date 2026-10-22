import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvoiceService } from "../services/invoice-service";
import { CompanyService } from "../services/company-service";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

describe("Invoice to Appointment Payment Synchronization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("marks all linked appointments as paid when invoice status changes to PAID", async () => {
    const mockInvoice = {
      id: "inv-101",
      companyId: "comp-1",
      status: "PENDING",
      totalAmount: new Prisma.Decimal(250),
      paidAmount: new Prisma.Decimal(0),
      paidAt: null,
    };

    vi.spyOn(prisma.invoice, "findFirst").mockResolvedValueOnce(mockInvoice as any);
    vi.spyOn(prisma.invoice, "update").mockResolvedValueOnce({
      ...mockInvoice,
      status: "PAID",
      paidAmount: new Prisma.Decimal(250),
      paidAt: new Date(),
    } as any);

    const updateManyApptsSpy = vi
      .spyOn(prisma.appointment, "updateMany")
      .mockResolvedValueOnce({ count: 2 } as any);

    const result = await InvoiceService.updateInvoiceStatus("inv-101", "comp-1", "PAID");

    expect(updateManyApptsSpy).toHaveBeenCalledWith({
      where: { invoiceId: "inv-101", companyId: "comp-1" },
      data: expect.objectContaining({
        paid: true,
      }),
    });
    expect(result.status).toBe("PAID");
  });

  it("reverts all linked appointments to unpaid when invoice status changes away from PAID", async () => {
    const mockInvoice = {
      id: "inv-102",
      companyId: "comp-1",
      status: "PAID",
      totalAmount: new Prisma.Decimal(180),
      paidAmount: new Prisma.Decimal(180),
      paidAt: new Date(),
    };

    vi.spyOn(prisma.invoice, "findFirst").mockResolvedValueOnce(mockInvoice as any);
    vi.spyOn(prisma.invoice, "update").mockResolvedValueOnce({
      ...mockInvoice,
      status: "PENDING",
    } as any);

    const updateManyApptsSpy = vi
      .spyOn(prisma.appointment, "updateMany")
      .mockResolvedValueOnce({ count: 1 } as any);

    const result = await InvoiceService.updateInvoiceStatus("inv-102", "comp-1", "PENDING");

    expect(updateManyApptsSpy).toHaveBeenCalledWith({
      where: { invoiceId: "inv-102", companyId: "comp-1" },
      data: {
        paid: false,
        paidAt: null,
      },
    });
    expect(result.status).toBe("PENDING");
  });

  it("marks linked appointments as paid when invoice is created with status PAID", async () => {
    vi.spyOn(CompanyService, "getDefaultAddress").mockResolvedValueOnce("123 Main St" as any);

    const mockClient = {
      id: "cli-1",
      name: "Client Test",
      companyId: "comp-1",
      notes: null,
    };

    const mockAppt = {
      id: "appt-1",
      title: "House Cleaning",
      date: new Date(),
      price: new Prisma.Decimal(150),
      services: [],
    };

    const mockCreatedInvoice = {
      id: "inv-new",
      companyId: "comp-1",
      status: "PAID",
      totalAmount: new Prisma.Decimal(150),
      paidAmount: new Prisma.Decimal(150),
      paidAt: new Date(),
    };

    const updateManyApptsSpy = vi.fn().mockResolvedValue({ count: 1 });

    const txMock = {
      client: {
        findFirst: vi.fn().mockResolvedValue(mockClient),
        findMany: vi.fn().mockResolvedValue([]),
      },
      appointment: {
        findMany: vi.fn().mockResolvedValue([mockAppt]),
        updateMany: updateManyApptsSpy,
      },
      invoice: {
        create: vi.fn().mockResolvedValue(mockCreatedInvoice),
      },
    };

    vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => cb(txMock));

    await InvoiceService.createInvoice("comp-1", {
      clientId: "cli-1",
      invoiceNumber: "INV-001",
      status: "PAID",
      dueDate: "2026-10-30",
      items: [],
      appointmentIds: ["appt-1"],
      adjustments: [],
      discount: 0,
    });

    expect(updateManyApptsSpy).toHaveBeenCalledWith({
      where: { id: { in: ["appt-1"] } },
      data: expect.objectContaining({
        invoiced: true,
        invoiceId: "inv-new",
        paid: true,
      }),
    });
  });
});

