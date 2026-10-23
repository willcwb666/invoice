export interface TimeInterval {
  startTime: Date | string;
  endTime: Date | string;
}

/**
 * Checks whether two time intervals overlap.
 * Two intervals [S1, E1] and [S2, E2] overlap if and only if S1 < E2 and E1 > S2.
 */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  const startA = new Date(a.startTime).getTime();
  const endA = new Date(a.endTime).getTime();
  const startB = new Date(b.startTime).getTime();
  const endB = new Date(b.endTime).getTime();

  return startA < endB && endA > startB;
}

/**
 * Finds the first conflicting appointment among a list of existing appointments.
 * Automatically ignores appointments with status === "CANCELLED".
 */
export function findConflictingAppointment<
  T extends { startTime: Date | string; endTime: Date | string; status?: string }
>(candidate: TimeInterval, existingAppointments: T[]): T | undefined {
  return existingAppointments.find((appt) => {
    if (appt.status === "CANCELLED") return false;
    return intervalsOverlap(candidate, {
      startTime: appt.startTime,
      endTime: appt.endTime,
    });
  });
}
