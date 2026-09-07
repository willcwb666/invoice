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
  MapPin,
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
    <aside className="hidden md:flex w-64 bg-slate-900/90 border-r border-slate-800/80 backdrop-blur-md flex-col justify-between shrink-0 min-h-screen print:hidden">
      <div>
        {/* Brand */}
        <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20 shrink-0">
            <div className="w-full h-full bg-[#090D16] rounded-[10px] flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div className="overflow-hidden">
            <h1 className="font-bold text-sm text-white truncate">Renata Matos</h1>
            <p className="text-[11px] text-emerald-400 font-medium truncate">Evans, CO • Active</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1.5">
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
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80 text-xs space-y-3">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
            <Flame className="w-3.5 h-3.5" />
            <span>Meta Mensal $6k</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Acompanhe o faturamento e a projeção com a agenda.
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Postgres 17</span>
          </span>
          <span className="font-mono">v1.0</span>
        </div>
      </div>
    </aside>
  );
}
