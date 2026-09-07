"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TrendingUp,
  Calendar,
  FileText,
  Users,
  Menu,
  X,
  Receipt,
  Fuel,
  Sparkles,
  Settings,
} from "lucide-react";

const primaryNavItems = [
  { name: "Início", href: "/", icon: TrendingUp },
  { name: "Agenda", href: "/agenda", icon: Calendar },
  { name: "Faturas", href: "/invoices", icon: FileText },
  { name: "Clientes", href: "/clients", icon: Users },
];

const secondaryNavItems = [
  { name: "Orçamentos", href: "/estimates", icon: Receipt },
  { name: "Despesas", href: "/expenses", icon: Fuel },
  { name: "Marketing IA", href: "/marketing", icon: Sparkles },
  { name: "Configurações", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Fecha o menu móvel ao mudar de rota
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

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
              <span className="font-bold text-slate-900 text-sm">Mais Funcionalidades</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
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
