"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Calendar,
  Receipt,
  Users,
  Fuel,
  Settings,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Flame,
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/", icon: TrendingUp },
  { name: "Agenda (iPhone)", href: "/agenda", icon: Calendar },
  { name: "Faturas (Invoices)", href: "/invoices", icon: FileText },
  { name: "Orçamentos", href: "/estimates", icon: Receipt },
  { name: "Clientes & GPS", href: "/clients", icon: Users },
  { name: "Despesas", href: "/expenses", icon: Fuel },
  { name: "Marketing IA", href: "/marketing", icon: Sparkles },
  { name: "Configurações", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col justify-between shrink-0 min-h-screen print:hidden shadow-xs">
      <div>
        {/* Brand */}
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="overflow-hidden">
            <h1 className="font-bold text-sm text-slate-900 truncate">Renata Matos</h1>
            <p className="text-[11px] text-emerald-600 font-semibold truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Evans, CO • Ativo
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 shadow-xs border border-indigo-100/60"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-100 text-xs space-y-3">
        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px]">
            <Flame className="w-3.5 h-3.5 text-amber-600" />
            <span>Meta Mensal $6k</span>
          </div>
          <p className="text-[11px] text-amber-800/80 leading-relaxed">
            Acompanhe o faturamento e a projeção com a agenda.
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 font-medium">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Postgres 17</span>
          </span>
          <span className="font-mono text-slate-400">v1.0</span>
        </div>
      </div>
    </aside>
  );
}
