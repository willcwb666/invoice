"use client";

import React from "react";
import { ShieldCheck, Lock, Smartphone, RefreshCw, Bell } from "lucide-react";

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
    <header className="border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-30 bg-[#090D16]/80 px-6 py-4 flex items-center justify-between">
      <div>
        <h2 className="font-bold text-base text-white tracking-tight">{title}</h2>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        )}

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>RBAC Ativo</span>
        </div>

        <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400">
          RM
        </div>
      </div>
    </header>
  );
}
