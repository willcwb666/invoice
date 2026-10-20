"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          // Registrado com sucesso
        })
        .catch((err) => {
          console.warn("ServiceWorker registration skipped:", err);
        });
    }
  }, []);

  return null;
}
