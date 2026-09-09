import { prisma } from "@/lib/prisma";

const DEFAULT_COMPANY_NAME = "Renata Matos de Oliveira";

// Memoized in-process so two concurrent first-requests (e.g. two cold
// serverless instances racing on an empty database) can't each pass the
// "no company yet" check and create their own CompanyProfile row. There is
// no natural unique business key to upsert against (id is a random uuid),
// so this in-process lock is what keeps a single request path atomic; it
// does not protect against two separate processes racing at the exact same
// instant (see the write-up in the priority-2 report - a full fix needs a
// DB-level advisory lock or unique constraint trick, which is more than
// this single-tenant app currently needs).
let creationPromise: Promise<string> | null = null;

async function findOrCreateCompanyId(): Promise<string> {
  const existing = await prisma.companyProfile.findFirst({ select: { id: true } });
  if (existing) return existing.id;

  if (!creationPromise) {
    creationPromise = prisma.companyProfile
      .create({ data: { name: DEFAULT_COMPANY_NAME } })
      .then((company) => company.id)
      .catch(async (err) => {
        creationPromise = null;
        // Someone else may have created it between our findFirst above and
        // this create failing (e.g. a unique constraint or connection
        // hiccup) - check once more before giving up.
        const raced = await prisma.companyProfile.findFirst({ select: { id: true } });
        if (raced) return raced.id;
        throw err;
      });
  }
  return creationPromise;
}

/**
 * Resolves which CompanyProfile a request should operate on. This app is
 * single-tenant in practice (every bootstrap path — login, registration,
 * admin seeding — attaches every user to the one existing CompanyProfile),
 * so this is a "find the one company, creating it if this is a truly fresh
 * database" lookup, not real multi-tenant routing.
 *
 * Was previously copy-pasted into ~17 route files with two different,
 * silently-drifted behaviors: some auto-created a CompanyProfile when none
 * existed, others just fell back to `companyId: ""`, which fails the
 * foreign-key constraint on write with an unhandled 500. This is the one
 * shared implementation both call sites should use — always auto-create.
 */
export async function getTargetCompanyId(preferredCompanyId?: string | null): Promise<string> {
  if (preferredCompanyId) return preferredCompanyId;
  return findOrCreateCompanyId();
}
