import { describe, it, expect, vi, beforeEach } from "vitest";
import { DepartureReminderService } from "@/services/departure-reminder-service";
import * as abandonedModule from "@/services/abandoned-recovery-service";
import { prisma } from "@/lib/prisma";

describe("Unified Background Dispatcher Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls departure reminder sync and dispatch functions without throwing", async () => {
    const syncSpy = vi.spyOn(DepartureReminderService, "syncDailyReminders").mockResolvedValueOnce({
      companiesChecked: 1,
      remindersCreated: 2,
      appointmentsProcessed: 2,
    });

    const dispatchSpy = vi.spyOn(DepartureReminderService, "dispatchPendingReminders").mockResolvedValueOnce({
      dispatched: 1,
      errors: 0,
    });

    const syncRes = await DepartureReminderService.syncDailyReminders();
    const dispatchRes = await DepartureReminderService.dispatchPendingReminders();

    expect(syncSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(syncRes.remindersCreated).toBe(2);
    expect(dispatchRes.dispatched).toBe(1);
  });

  it("calls abandoned estimate recovery with companyId", async () => {
    const recoverySpy = vi.spyOn(abandonedModule, "processAbandonedEstimates").mockResolvedValueOnce({
      processed: 1,
      skipped: false,
    } as any);

    const res = await abandonedModule.processAbandonedEstimates("test_company");
    expect(recoverySpy).toHaveBeenCalledWith("test_company");
    expect(res.processed).toBe(1);
  });
});
