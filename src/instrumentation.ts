export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      console.log("[Instrumentation] Starting auto-seed and iCloud sync...");
      const { ensureExampleInvoicesSeeded } = await import("@/lib/seed-data");
      const { ensureICloudCalendarSynced } = await import("@/lib/calendar/icloud");
      await ensureExampleInvoicesSeeded();
      const res = await ensureICloudCalendarSynced(true);
      console.log("[Instrumentation] iCloud auto-sync result:", res?.message || res);
    } catch (err) {
      console.error("[Instrumentation] Error initializing iCloud sync:", err);
    }
  }
}

