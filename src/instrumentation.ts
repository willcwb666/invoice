export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      console.log("[Instrumentation] Starting auto-seed and iCloud sync...");
      const { ensureExampleInvoicesSeeded } = await import("@/lib/seed-data");
      const { ensureICloudCalendarSynced } = await import("@/lib/calendar/icloud");
      await ensureExampleInvoicesSeeded();
      const res = await ensureICloudCalendarSynced(true);
      console.log(
        "[Instrumentation] iCloud auto-sync result:",
        res ? `${res.length} empresa(s) sincronizada(s)` : res
      );
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.error("[Instrumentation] Error initializing iCloud sync:", err);
      // This is a genuinely top-level failure (ensureExampleInvoicesSeeded,
      // or ensureICloudCalendarSynced's own findMany/count, throwing before
      // its per-company loop even starts) - it can't be meaningfully
      // attributed to any one company. ensureICloudCalendarSynced's internal
      // per-company try/catch already notifies the RIGHT company for any
      // failure specific to syncing that one company; this outer catch must
      // not paper over a whole-batch failure by filing a notification
      // against "whichever company happens to be first" via an unscoped
      // findFirst() - that's the exact cross-tenant pattern this task fixes
      // elsewhere. console.error above is the only signal for this case.
    }
  }
}

