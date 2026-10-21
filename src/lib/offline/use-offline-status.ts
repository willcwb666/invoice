"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getOfflineSyncQueue,
  processOfflineSyncQueue,
  type QueuedSyncItem,
} from "./offline-agenda";
import { useToast } from "@/components/ui/toast";

export function useOfflineStatus() {
  const { showToast } = useToast();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [syncQueue, setSyncQueue] = useState<QueuedSyncItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshQueue = useCallback(() => {
    setSyncQueue(getOfflineSyncQueue());
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      const res = await processOfflineSyncQueue();
      refreshQueue();
      if (res.rejectedCount > 0) {
        showToast(
          res.rejectedCount === 1
            ? "1 agendamento criado offline não pôde ser sincronizado e foi descartado."
            : `${res.rejectedCount} agendamentos criados offline não puderam ser sincronizados e foram descartados.`,
          "error"
        );
      }
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshQueue, showToast]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    refreshQueue();

    const handleOnline = async () => {
      setIsOnline(true);
      await triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshQueue();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Verifica a fila a cada 30 segundos quando online
    const interval = setInterval(() => {
      if (navigator.onLine && getOfflineSyncQueue().length > 0) {
        triggerSync();
      }
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [triggerSync, refreshQueue]);

  return {
    isOnline,
    isOffline: !isOnline,
    pendingSyncCount: syncQueue.length,
    syncQueue,
    isSyncing,
    triggerSync,
    refreshQueue,
  };
}
