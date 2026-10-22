"use client";

import { useState, useEffect, useCallback } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Checa se o navegador e o Service Worker suportam Push
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    ) {
      setIsSupported(true);
      setPermission(Notification.permission);

      navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => {
          setIsSubscribed(Boolean(subscription));
          setLoading(false);
        })
        .catch((err) => {
          console.error("[usePushNotifications] Erro ao checar subscrição:", err);
          setLoading(false);
        });
    } else {
      setIsSupported(false);
      setLoading(false);
    }
  }, []);

  const subscribe = useCallback(
    async (professionalId?: string): Promise<boolean> => {
      setError(null);
      setLoading(true);

      try {
        if (!isSupported) {
          throw new Error("Seu navegador ou dispositivo não suporta notificações Push.");
        }

        const perm = await Notification.requestPermission();
        setPermission(perm);

        if (perm !== "granted") {
          throw new Error("Permissão para notificações foi negada.");
        }

        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) {
          throw new Error("Chave pública VAPID não configurada no frontend.");
        }

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const applicationServerKey = urlBase64ToUint8Array(publicKey);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as any,
          });
        }

        const subJson = subscription.toJSON();

        // Envia para o backend salvar no Postgres
        const res = await fetch("/api/v1/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: subJson.keys,
            professionalId,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Falha ao registrar notificação no servidor.");
        }

        setIsSubscribed(true);
        setLoading(false);
        return true;
      } catch (err: any) {
        console.error("[usePushNotifications] Erro na inscrição:", err);
        setError(err?.message || "Erro desconhecido ao ativar notificações.");
        setLoading(false);
        return false;
      }
    },
    [isSupported]
  );

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setError(null);
    setLoading(true);

    try {
      if (!isSupported) return false;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Notifica o backend para deletar
        await fetch("/api/v1/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }

      setIsSubscribed(false);
      setLoading(false);
      return true;
    } catch (err: any) {
      console.error("[usePushNotifications] Erro ao desinscrever:", err);
      setError(err?.message || "Erro ao desativar notificações.");
      setLoading(false);
      return false;
    }
  }, [isSupported]);

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    error,
    subscribe,
    unsubscribe,
  };
}
