"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCheck,
  Calendar,
  AlertTriangle,
  Info,
  Clock,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "SUCCESS" | "URGENT";
  read: boolean;
  link?: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialNotificationsLoad = useRef(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/notifications?limit=15");
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data?.items || []);
        setUnreadCount(json.data?.unreadCount || 0);
      }
    } catch (err) {
      console.error("Erro ao carregar notificações:", err);
      // Só mostra toast na carga inicial — o polling automático a cada 60s
      // fica silencioso no console para não martelar toast repetido.
      if (isInitialNotificationsLoad.current) {
        showToast("Erro ao carregar notificações.", "error");
      }
    } finally {
      setLoading(false);
      isInitialNotificationsLoad.current = false;
    }
  };

  useEffect(() => {
    fetchNotifications();
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(fetchNotifications, 60000); // 1 minuto
    };
    const stopPolling = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fecha o dropdown ao clicar fora ou pressionar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const markAllAsRead = async () => {
    try {
      await fetch("/api/v1/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Erro ao marcar notificações como lidas:", err);
      showToast("Erro ao marcar notificações como lidas.", "error");
    }
  };

  const markItemAsRead = async (id: string) => {
    try {
      await fetch("/api/v1/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Erro ao marcar notificação como lida:", err);
      showToast("Erro ao marcar notificação como lida.", "error");
    }
  };

  const renderIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "URGENT":
        return <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />;
      case "WARNING":
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      case "SUCCESS":
        return <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-indigo-500 shrink-0" />;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Notificações"
        className="relative p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-rose-500 rounded-full shadow-xs ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-3 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900">Notificações</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-extrabold">
                    {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Marcar todas como lidas</span>
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <Bell className="w-8 h-8 mx-auto text-slate-300 mb-2 opacity-50" />
                  Nenhuma notificação no momento.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markItemAsRead(n.id);
                    }}
                    className={`p-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                      n.read
                        ? "bg-slate-50/50 border-slate-100 text-slate-600"
                        : "bg-indigo-50/30 border-indigo-100 text-slate-900 font-medium"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">{renderIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className="font-bold text-xs truncate">{n.title}</p>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(n.createdAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "America/Denver",
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                          {n.message}
                        </p>

                        {n.link && (
                          <Link
                            href={n.link}
                            onClick={() => {
                              setIsOpen(false);
                              if (!n.read) markItemAsRead(n.id);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 mt-1.5"
                          >
                            <span>Ver na Agenda</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between px-1">
              <Link
                href="/settings?tab=notificacoes"
                onClick={() => setIsOpen(false)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 transition-colors"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Configurar Push no Celular</span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
