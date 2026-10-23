"use client";

import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos

/**
 * Hook de batimento cardíaco resiliente:
 * Garante que os lembretes de saída (30m e 10m antes de cada atendimento) e
 * a recuperação de orçamentos sejam despachados pontualmente ao longo de todo
 * o expediente enquanto qualquer colaborador estiver com o sistema aberto.
 */
export function useDispatcherHeartbeat() {
  const lastTickRef = useRef<number>(0);

  const triggerTick = async () => {
    const now = Date.now();
    // Proteção de debounce no cliente: não dispara mais que 1x a cada 90s por aba
    if (now - lastTickRef.current < 90_000) return;
    lastTickRef.current = now;

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (typeof document !== "undefined" && document.hidden) return;

      await fetch("/api/v1/cron/dispatcher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Falhas de rede silenciosas para não interromper a interface
    }
  };

  useEffect(() => {
    // 1. Disparo inicial após 5 segundos do carregamento da aplicação
    const initialTimer = setTimeout(() => {
      triggerTick();
    }, 5000);

    // 2. Intervalo periódico a cada 3 minutos
    const intervalTimer = setInterval(() => {
      triggerTick();
    }, HEARTBEAT_INTERVAL_MS);

    // 3. Ao alternar entre abas (quando o usuário volta ao app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerTick();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
