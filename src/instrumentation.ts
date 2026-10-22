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
      // Mesma lógica do catch em icloud.ts: console.error não aparece pra
      // ninguém em produção, então também avisa via notificação (sininho)
      // quando há empresa cadastrada.
      try {
        const { prisma } = await import("@/lib/prisma");
        const { NotificationService } = await import("@/services/notification-service");
        const company = await prisma.companyProfile.findFirst();
        if (company) {
          await NotificationService.create({
            companyId: company.id,
            title: "Falha na inicialização do sistema",
            message: `A rotina de inicialização (seed/sync automático) falhou: ${errMessage}`,
            type: "URGENT",
          });
        }
      } catch {}
    }
  }
}

