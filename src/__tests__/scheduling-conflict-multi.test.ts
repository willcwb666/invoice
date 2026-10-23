import { describe, it, expect } from "vitest";
import {
  intervalsOverlap,
  findMultiCleanerConflict,
  CandidateAppointment,
  ExistingAppointmentWithProfessionals,
} from "../lib/scheduling/conflict";

describe("Multi-Cleaner Scheduling Conflict Detection", () => {
  it("detects overlap between two appointments sharing the same professional", () => {
    const candidate: CandidateAppointment = {
      startTime: "2026-10-25T09:00:00Z",
      endTime: "2026-10-25T11:00:00Z",
      professionalIds: ["prof_renata"],
    };

    const existing: ExistingAppointmentWithProfessionals[] = [
      {
        id: "appt_1",
        title: "Smith Residence - Standard",
        startTime: "2026-10-25T10:00:00Z",
        endTime: "2026-10-25T12:00:00Z",
        status: "SCHEDULED",
        professionalIds: ["prof_renata"],
      },
    ];

    const conflict = findMultiCleanerConflict(candidate, existing);
    expect(conflict).toBeDefined();
    expect(conflict?.id).toBe("appt_1");
  });

  it("allows overlapping appointments if they are assigned to DIFFERENT professionals", () => {
    const candidate: CandidateAppointment = {
      startTime: "2026-10-25T09:00:00Z",
      endTime: "2026-10-25T11:00:00Z",
      professionalIds: ["prof_maria"],
    };

    const existing: ExistingAppointmentWithProfessionals[] = [
      {
        id: "appt_1",
        title: "Smith Residence - Standard",
        startTime: "2026-10-25T10:00:00Z",
        endTime: "2026-10-25T12:00:00Z",
        status: "SCHEDULED",
        professionalIds: ["prof_renata"],
      },
    ];

    const conflict = findMultiCleanerConflict(candidate, existing);
    expect(conflict).toBeUndefined(); // Different professionals -> No conflict!
  });

  it("ignores CANCELLED appointments even if times and professionals match", () => {
    const candidate: CandidateAppointment = {
      startTime: "2026-10-25T09:00:00Z",
      endTime: "2026-10-25T11:00:00Z",
      professionalIds: ["prof_renata"],
    };

    const existing: ExistingAppointmentWithProfessionals[] = [
      {
        id: "appt_cancelled",
        title: "Cancelled Job",
        startTime: "2026-10-25T09:30:00Z",
        endTime: "2026-10-25T11:30:00Z",
        status: "CANCELLED",
        professionalIds: ["prof_renata"],
      },
    ];

    const conflict = findMultiCleanerConflict(candidate, existing);
    expect(conflict).toBeUndefined();
  });

  it("flags conflict if candidate is unassigned (solo company mode) and overlaps", () => {
    const candidate: CandidateAppointment = {
      startTime: "2026-10-25T09:00:00Z",
      endTime: "2026-10-25T11:00:00Z",
      professionalIds: [], // Unassigned / solo company
    };

    const existing: ExistingAppointmentWithProfessionals[] = [
      {
        id: "appt_1",
        title: "Johnson House",
        startTime: "2026-10-25T10:00:00Z",
        endTime: "2026-10-25T12:00:00Z",
        status: "SCHEDULED",
        professionalIds: ["prof_renata"],
      },
    ];

    const conflict = findMultiCleanerConflict(candidate, existing);
    expect(conflict).toBeDefined();
    expect(conflict?.id).toBe("appt_1");
  });

  it("ignores self when excludeAppointmentId is provided", () => {
    const candidate: CandidateAppointment = {
      id: "appt_editing",
      startTime: "2026-10-25T09:00:00Z",
      endTime: "2026-10-25T11:00:00Z",
      professionalIds: ["prof_renata"],
    };

    const existing: ExistingAppointmentWithProfessionals[] = [
      {
        id: "appt_editing",
        title: "My Own Job",
        startTime: "2026-10-25T09:00:00Z",
        endTime: "2026-10-25T11:00:00Z",
        status: "SCHEDULED",
        professionalIds: ["prof_renata"],
      },
    ];

    const conflict = findMultiCleanerConflict(candidate, existing, "appt_editing");
    expect(conflict).toBeUndefined();
  });
});
