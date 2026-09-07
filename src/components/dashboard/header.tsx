"use client";

import React from "react";
import { ShieldCheck, RefreshCw } from "lucide-react";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
  loading?: boolean;
}

export function Header({
  title = "Painel de Controle",
  subtitle = "Field Service & Invoicing",
  onRefresh,
  loading = false,
}: HeaderProps) {
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
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-colors"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        )}

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>RBAC Ativo</span>
        </div>

        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700">
          RM
        </div>
      </div>
    </header>
  );
}
