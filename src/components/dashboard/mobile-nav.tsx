"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  TrendingUp,
  Calendar,
  FileText,
  Users,
  Menu,
  X,
  Receipt,
  Fuel,
  Settings,
  LogOut,
  Loader2,
  CalendarCheck,
  UserCheck,
  Wrench,
  Wallet,
} from "lucide-react";

const primaryNavItems = [
  { name: "Início", href: "/", icon: TrendingUp },
  { name: "Agendamentos", href: "/appointments", icon: CalendarCheck },
  { name: "Faturas", href: "/invoices", icon: FileText },
  { name: "Clientes", href: "/clients", icon: Users },
];

const secondaryNavItems = [
  { name: "Agenda", href: "/agenda", icon: Calendar },
  { name: "Serviços", href: "/services", icon: Wrench },
  { name: "Orçamentos", href: "/estimates", icon: Receipt },
  { name: "Pagamentos", href: "/payments", icon: Wallet },
  { name: "Despesas", href: "/expenses", icon: Fuel },
  { name: "Usuários & RBAC", href: "/users", icon: UserCheck },
  { name: "Configurações", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Fecha o menu móvel ao mudar de rota
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Continue
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const isMoreActive = secondaryNavItems.some((item) =>
    pathname.startsWith(item.href)
  );

  return (
    <>
      {/* Drawer Móvel Expandido */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="absolute bottom-16 left-0 right-0 bg-white border-t border-slate-200 rounded-t-2xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-bold text-slate-900 text-sm">Mais Funcionalidades</span>
                <p className="text-[11px] text-slate-500">Renata Matos • Admin</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {secondaryNavItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 p-3 rounded-xl text-xs font-semibold border transition-all ${
                      isActive
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs"
                        : "bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? "text-indigo-600" : "text-slate-500"
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Logout button in Mobile Drawer */}
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200/80 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
              >
                {loggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                <span>Encerrar Sessão (Logout)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra Inferior Fixa */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-200 backdrop-blur-xl md:hidden print:hidden px-3 py-2 shadow-lg">
        <div className="flex items-center justify-around">
          {primaryNavItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                  isActive
                    ? "text-indigo-600 font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                <span className="text-[10px] mt-1">{item.name}</span>
              </Link>
            );
          })}

          {/* Botão Mais */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              isOpen || isMoreActive
                ? "text-indigo-600 font-bold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-1">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
