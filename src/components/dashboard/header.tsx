"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  RefreshCw,
  LogOut,
  Loader2,
  Receipt,
  Sparkles,
  Eye,
  User as UserIcon,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Tooltip } from "@/components/ui/tooltip";
import { StatusDot } from "@/components/ui/status-dot";
import { PeriodToggle, PeriodMode } from "@/components/dashboard/period-toggle";
import { NotificationBell } from "@/components/dashboard/notification-bell";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
  loading?: boolean;
  actionSlot?: React.ReactNode;
  showPeriodToggle?: boolean;
  period?: PeriodMode;
  onPeriodChange?: (period: PeriodMode) => void;
}

export function Header({
  title = "Painel de Controle",
  subtitle = "Field Service & Invoicing",
  onRefresh,
  loading = false,
  actionSlot,
  showPeriodToggle = false,
  period = "weekly",
  onPeriodChange,
}: HeaderProps) {
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  const [loggingOut, setLoggingOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora ou pressionar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Continue even if network error
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  // Get initials from user name without hardcoded flicker
  const displayName = user?.name || (userLoading ? "Carregando..." : "Usuário");
  const displayEmail = user?.email || "";
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : userLoading
    ? "••"
    : "US";

  const renderRoleBadge = () => {
    const role = user?.role || "ADMIN";
    switch (role) {
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold">
            <ShieldCheck className="w-3 h-3 text-indigo-600 shrink-0" />
            <span>Admin</span>
          </span>
        );
      case "FINANCIAL":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
            <Receipt className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>Financeiro</span>
          </span>
        );
      case "OPERATOR":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold">
            <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
            <span>Operador</span>
          </span>
        );
      case "VIEWER":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold">
            <Eye className="w-3 h-3 text-slate-600 shrink-0" />
            <span>Visualizador</span>
          </span>
        );
      default:
        return null;
    }
  };

  const renderStatusDot = () => {
    const status = user?.status || "ACTIVE";
    switch (status) {
      case "ACTIVE":
        return <StatusDot color="emerald" tooltip="Status: Ativo" />;
      case "PENDING_APPROVAL":
        return <StatusDot color="amber" tooltip="Status: Pendente de Aprovação" />;
      case "SUSPENDED":
        return <StatusDot color="rose" tooltip="Status: Suspenso" />;
      default:
        return null;
    }
  };

  return (
    <header className="border-b border-slate-200/80 backdrop-blur-md sticky top-0 z-30 bg-white/80 px-6 py-4 flex items-center justify-between shadow-xs print:hidden">
      <div>
        <h2 className="font-bold text-base text-slate-900 tracking-tight">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {actionSlot}

        {/* Toggle Semanal / Mensal animado (lado a lado com o recarregar dados) */}
        {showPeriodToggle && onPeriodChange && (
          <PeriodToggle value={period} onChange={onPeriodChange} />
        )}

        {/* Botão Recarregar Dados */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-colors cursor-pointer"
            title="Recarregar dados"
            aria-label="Recarregar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        )}

        {/* Central de Notificações In-App */}
        <NotificationBell />

        {/* Menu do Perfil do Usuário */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
            aria-label={`Menu do perfil de ${displayName}`}
            className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            title="Menu do Perfil"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-xs select-none">
              {initials}
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                isMenuOpen ? "rotate-180 text-indigo-600" : ""
              }`}
            />
          </button>

          {/* Dropdown Menu com Animação */}
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-2 z-50 overflow-hidden"
              >
                {/* Cabeçalho do Menu: Nome, Email, Role e Bolinha de Status */}
                <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2 mb-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-xs text-slate-900 truncate">
                      {displayName}
                    </p>
                    {renderStatusDot()}
                  </div>

                  <p className="text-[11px] text-slate-500 truncate font-mono">
                    {displayEmail}
                  </p>

                  <div className="pt-1 flex items-center gap-2">
                    {renderRoleBadge()}
                  </div>
                </div>

                {/* Opções de Navegação */}
                <div className="space-y-0.5">
                  <Link
                    href="/profile"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50/80 transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                    <span>Meu Perfil</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50/80 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                    <span>Configurações</span>
                  </Link>
                </div>

                {/* Divisor */}
                <div className="h-px bg-slate-100 my-1.5" />

                {/* Botão de Logoff */}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loggingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                  ) : (
                    <LogOut className="w-4 h-4 text-rose-500" />
                  )}
                  <span>{loggingOut ? "Encerrando..." : "Sair da Conta"}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
