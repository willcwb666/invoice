import { describe, it, expect, vi, beforeEach } from "vitest";
import { PaymentService } from "../services/payment-service";
import { prisma } from "../lib/prisma";

describe("PaymentService Completion & Flexible Payment Toggles", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("toggles appointment completion from SCHEDULED to COMPLETED and vice-versa", async () => {
    const mockApptScheduled = {
      id: "appt-1",
      companyId: "comp-1",
      status: "SCHEDULED",
      billable: true,
      invoiced: false,
    };

    vi.spyOn(prisma.appointment, "findFirst").mockResolvedValueOnce(mockApptScheduled as any);
    const updateSpy = vi.spyOn(prisma.appointment, "update").mockResolvedValueOnce({
      ...mockApptScheduled,
      status: "COMPLETED",
    } as any);

    const result = await PaymentService.toggleCompleted("appt-1", "comp-1");

    expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
      where: { id: "appt-1", companyId: "comp-1" },
    });
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: "appt-1" },
      data: { status: "COMPLETED" },
      include: {
        client: { select: { id: true, name: true, billingType: true } },
        services: { include: { service: true } },
      },
    });
    expect(result.status).toBe("COMPLETED");

    // Second toggle: COMPLETED -> SCHEDULED
    vi.spyOn(prisma.appointment, "findFirst").mockResolvedValueOnce({
      ...mockApptScheduled,
      status: "COMPLETED",
    } as any);
    vi.spyOn(prisma.appointment, "update").mockResolvedValueOnce({
      ...mockApptScheduled,
      status: "SCHEDULED",
    } as any);

    const result2 = await PaymentService.toggleCompleted("appt-1", "comp-1");
    expect(result2.status).toBe("SCHEDULED");
  });

  it("marks appointment as paid even if status was SCHEDULED", async () => {
    const mockAppt = {
      id: "appt-2",
      companyId: "comp-1",
      status: "SCHEDULED",
      billable: true,
      invoiced: false,
      paid: false,
    };

    vi.spyOn(prisma.appointment, "findFirst").mockResolvedValueOnce(mockAppt as any);
    const updateSpy = vi.spyOn(prisma.appointment, "update").mockResolvedValueOnce({
      ...mockAppt,
      paid: true,
    } as any);

    const res = await PaymentService.markPaid("appt-2", "comp-1");
    expect(updateSpy).toHaveBeenCalled();
    expect(res.paid).toBe(true);
  });

  it("queries non-cancelled appointments and includes service relations in listPayments", async () => {
    const findManySpy = vi.spyOn(prisma.appointment, "findMany").mockResolvedValueOnce([
      {
        id: "appt-1",
        title: "Cleaning Dawn",
        status: "SCHEDULED",
        services: [{ service: { id: "srv-1", name: "House - Standard cleaning" } }],
      },
    ] as any);

    const list = await PaymentService.listPayments("comp-1");
    expect(findManySpy).toHaveBeenCalled();
    const queryArg = findManySpy.mock.calls[0][0];

    // Status filter should accept scheduled, completed, and in_progress
    expect(queryArg?.where?.status).toEqual({ in: ["SCHEDULED", "COMPLETED", "IN_PROGRESS"] });
    expect(queryArg?.include?.services).toBeDefined();
    expect(list.length).toBe(1);
  });

  it("restricts listPayments to today and past dates, excluding future appointments", async () => {
    const findManySpy = vi.spyOn(prisma.appointment, "findMany").mockResolvedValueOnce([]);

    await PaymentService.listPayments("comp-1");
    expect(findManySpy).toHaveBeenCalled();
    const queryArg = findManySpy.mock.calls[0][0] as any;

    // Date filter must have lte bounded to today
    expect(queryArg?.where?.date?.lte).toBeDefined();
    const lteDate = queryArg.where.date.lte as Date;
    const now = new Date();
    // lte should be later than now (end of today) but not next week
    expect(lteDate.getTime()).toBeGreaterThan(now.getTime() - 86400000);
    expect(lteDate.getTime()).toBeLessThan(now.getTime() + 86400000 * 2);
  });
});
