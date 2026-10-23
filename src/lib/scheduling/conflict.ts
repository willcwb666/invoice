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
export interface CandidateAppointment extends TimeInterval {
  id?: string;
  professionalIds?: string[];
}

export interface ExistingAppointmentWithProfessionals extends TimeInterval {
  id: string;
  title: string;
  status?: string;
  professionalIds?: string[];
  clientName?: string;
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

/**
 * Finds the first conflicting appointment taking into account assigned professionals.
 * - Always ignores appointments with status === "CANCELLED".
 * - Ignores self when excludeAppointmentId is provided.
 * - If candidate and existing both have professionals, they conflict ONLY if they share at least one professional.
 * - If either candidate or existing has no professionals assigned, they conflict (treats unassigned as full company / solo cleaner lock).
 */
export function findMultiCleanerConflict<T extends ExistingAppointmentWithProfessionals>(
  candidate: CandidateAppointment,
  existingAppointments: T[],
  excludeAppointmentId?: string
): T | undefined {
  return existingAppointments.find((appt) => {
    if (appt.status === "CANCELLED") return false;
    if (excludeAppointmentId && appt.id === excludeAppointmentId) return false;
    if (candidate.id && appt.id === candidate.id) return false;

    // Check time interval overlap first
    const overlaps = intervalsOverlap(candidate, {
      startTime: appt.startTime,
      endTime: appt.endTime,
    });
    if (!overlaps) return false;

    const candidateProfs = candidate.professionalIds || [];
    const existingProfs = appt.professionalIds || [];

    // If both have assigned professionals, conflict occurs ONLY if at least one professional is in both
    if (candidateProfs.length > 0 && existingProfs.length > 0) {
      return candidateProfs.some((profId) => existingProfs.includes(profId));
    }

    // If either side is unassigned, it conflicts (company capacity reservation / solo cleaner mode)
    return true;
  });
}
