"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  Calendar,
  Receipt,
  Users,
  Fuel,
  Settings,
  TrendingUp,
  ShieldCheck,
  Flame,
  LogOut,
  Loader2,
  CalendarCheck,
  UserCheck,
  Wrench,
  Wallet,
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/", icon: TrendingUp },
  { name: "Agenda", href: "/agenda", icon: Calendar },
  { name: "Agendamentos", href: "/appointments", icon: CalendarCheck },
  { name: "Serviços", href: "/services", icon: Wrench },
  { name: "Faturas (Invoices)", href: "/invoices", icon: FileText },
  { name: "Orçamentos", href: "/estimates", icon: Receipt },
  { name: "Pagamentos", href: "/payments", icon: Wallet },
  { name: "Clientes & GPS", href: "/clients", icon: Users },
  { name: "Despesas", href: "/expenses", icon: Fuel },
  { name: "Usuários & RBAC", href: "/users", icon: UserCheck },
  { name: "Configurações", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
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
              Evans, CO • Protegido
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

      {/* Footer Info & User Card */}
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

        {/* User Card with Logout */}
        <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              RM
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-xs text-slate-800 truncate leading-tight">
                Renata Matos
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                renatamatoz@gmail.com
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
            title="Encerrar sessão"
          >
            {loggingOut ? (
              <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 font-medium">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Auth & RBAC Ativos</span>
          </span>
          <span className="font-mono text-slate-400">v2.0</span>
        </div>
      </div>
    </aside>
  );
}
