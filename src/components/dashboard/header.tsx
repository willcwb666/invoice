"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  RefreshCw,
  LogOut,
  Loader2,
  Receipt,
  Sparkles,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Tooltip } from "@/components/ui/tooltip";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
  loading?: boolean;
  actionSlot?: React.ReactNode;
}

export function Header({
  title = "Painel de Controle",
  subtitle = "Field Service & Invoicing",
  onRefresh,
  loading = false,
  actionSlot,
}: HeaderProps) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [loggingOut, setLoggingOut] = useState(false);

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

  // Get initials from user name
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "RM";

  const renderRoleBadge = () => {
    const role = user?.role || "ADMIN";
    switch (role) {
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>Admin</span>
          </span>
        );
      case "FINANCIAL":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-2xs">
            <Receipt className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Financeiro</span>
          </span>
        );
      case "OPERATOR":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Operador</span>
          </span>
        );
      case "VIEWER":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs">
            <Eye className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span>Visualizador</span>
          </span>
        );
      default:
        return null;
    }
  };

  const renderStatusBadge = () => {
    const status = user?.status || "ACTIVE";
    switch (status) {
      case "ACTIVE":
        return (
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ativo</span>
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-700 font-bold">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Pendente</span>
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-700 font-bold">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>Suspenso</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="border-b border-slate-200/80 backdrop-blur-md sticky top-0 z-30 bg-white/80 px-6 py-4 flex items-center justify-between shadow-xs">
      <div>
        <h2 className="font-bold text-base text-slate-900 tracking-tight">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-colors cursor-pointer"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        )}

        {actionSlot}

        {/* Dynamic RBAC Badges */}
        <div className="flex items-center gap-2">
          {renderRoleBadge()}
          {renderStatusBadge()}
        </div>

        {/* User Initials Avatar with Tooltip */}
        <Tooltip
          content={
            user
              ? `${user.name} (${user.email}) • Função: ${user.role} • Status: ${user.status}`
              : "Renata Matos de Oliveira (renatamatoz@gmail.com) • Função: ADMIN • Status: ACTIVE"
          }
          position="bottom"
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xs font-black text-indigo-700 select-none shadow-2xs cursor-default">
            {initials}
          </div>
        </Tooltip>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          title="Encerrar Sessão (Logout)"
        >
          {loggingOut ? (
            <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          <span className="hidden lg:inline text-xs font-semibold">Sair</span>
        </button>
      </div>
    </header>
  );
}
