import { describe, it, expect } from "vitest";
import { intervalsOverlap, findConflictingAppointment } from "../lib/scheduling/conflict";

describe("Scheduling Conflict / Double-Booking Prevention", () => {
  it("detects exact overlapping intervals", () => {
    const a = {
      startTime: new Date("2026-10-23T08:30:00Z"),
      endTime: new Date("2026-10-23T11:30:00Z"),
    };
    const b = {
      startTime: new Date("2026-10-23T08:30:00Z"),
      endTime: new Date("2026-10-23T11:30:00Z"),
    };
    expect(intervalsOverlap(a, b)).toBe(true);
  });

  it("detects partial overlaps (start inside existing)", () => {
    const existing = {
      startTime: new Date("2026-10-23T08:00:00Z"),
      endTime: new Date("2026-10-23T10:00:00Z"),
    };
    const candidate = {
      startTime: new Date("2026-10-23T09:00:00Z"),
      endTime: new Date("2026-10-23T11:00:00Z"),
    };
    expect(intervalsOverlap(existing, candidate)).toBe(true);
  });

  it("detects candidate enclosing existing", () => {
    const existing = {
      startTime: new Date("2026-10-23T09:00:00Z"),
      endTime: new Date("2026-10-23T10:00:00Z"),
    };
    const candidate = {
      startTime: new Date("2026-10-23T08:00:00Z"),
      endTime: new Date("2026-10-23T11:00:00Z"),
    };
    expect(intervalsOverlap(existing, candidate)).toBe(true);
  });

  it("allows adjacent non-overlapping bookings", () => {
    const appt1 = {
      startTime: new Date("2026-10-23T08:00:00Z"),
      endTime: new Date("2026-10-23T10:00:00Z"),
    };
    const appt2 = {
      startTime: new Date("2026-10-23T10:00:00Z"),
      endTime: new Date("2026-10-23T12:00:00Z"),
    };
    expect(intervalsOverlap(appt1, appt2)).toBe(false);
  });

  it("ignores CANCELLED appointments when searching for conflicts", () => {
    const existing = [
      {
        id: "appt-cancelled",
        startTime: new Date("2026-10-23T08:30:00Z"),
        endTime: new Date("2026-10-23T11:30:00Z"),
        status: "CANCELLED",
      },
      {
        id: "appt-scheduled",
        startTime: new Date("2026-10-23T14:00:00Z"),
        endTime: new Date("2026-10-23T16:00:00Z"),
        status: "SCHEDULED",
      },
    ];

    const candidate = {
      startTime: new Date("2026-10-23T08:30:00Z"),
      endTime: new Date("2026-10-23T11:30:00Z"),
    };

    const conflict = findConflictingAppointment(candidate, existing);
    expect(conflict).toBeUndefined();
  });

  it("finds conflict when appointment is SCHEDULED or COMPLETED", () => {
    const existing = [
      {
        id: "appt-active",
        startTime: new Date("2026-10-23T08:30:00Z"),
        endTime: new Date("2026-10-23T11:30:00Z"),
        status: "SCHEDULED",
      },
    ];

    const candidate = {
      startTime: new Date("2026-10-23T09:00:00Z"),
      endTime: new Date("2026-10-23T10:00:00Z"),
    };

    const conflict = findConflictingAppointment(candidate, existing);
    expect(conflict?.id).toBe("appt-active");
  });
});
