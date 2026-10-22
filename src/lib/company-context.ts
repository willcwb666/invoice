/**
 * Resolves which CompanyProfile a request should operate on. With real
 * multi-tenancy (see docs/superpowers/specs/2026-10-21-multi-tenant-
 * onboarding-design.md) there is no longer a single "the one company" to
 * fall back to when the caller doesn't have one - every ACTIVE session
 * has a companyId by construction (the only path to ACTIVE is completing
 * /onboarding, which always assigns one), so reaching this function
 * without one means something upstream is broken, not that this is a
 * fresh single-tenant database.
 */
export async function getTargetCompanyId(
  companyId: string | null | undefined
): Promise<string> {
  if (!companyId) {
    throw new Error("Nenhuma empresa associada a esta sessão.");
  }
  return companyId;
}
