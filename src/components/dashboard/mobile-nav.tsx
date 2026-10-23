"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { ROLE_DEFINITIONS } from "@/lib/security/rbac";
import { StatusDot } from "@/components/ui/status-dot";
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
  Landmark,
  FileSpreadsheet,
  Award,
  Sparkles,
} from "lucide-react";

const primaryNavItems = [
  { name: "Início", href: "/", icon: TrendingUp },
  { name: "Agenda", href: "/agenda", icon: Calendar },
  { name: "Faturas", href: "/invoices", icon: FileText },
  { name: "Clientes", href: "/clients", icon: Users },
];

const secondaryNavItems = [
  { name: "Portal Diarista", href: "/cleaner", icon: Sparkles },
  { name: "Relatórios", href: "/reports", icon: FileSpreadsheet },
  { name: "Financeiro", href: "/financeiro", icon: Landmark },
  { name: "Pagamentos", href: "/payments", icon: Wallet },
  { name: "Despesas", href: "/expenses", icon: Fuel },
  { name: "Profissionais", href: "/professionals", icon: Award },
  { name: "Serviços", href: "/services", icon: Wrench },
  { name: "Orçamentos", href: "/estimates", icon: Receipt },
  { name: "Usuários & RBAC", href: "/users", icon: UserCheck },
  { name: "Configurações", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isCleaner } = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);

  const displayName = user?.name || user?.email?.split("@")[0] || "Usuário";
  const roleLabel = user?.role
    ? ROLE_DEFINITIONS[user.role as keyof typeof ROLE_DEFINITIONS]?.name || user.role
    : "Membro";

  // Fecha o menu móvel ao mudar de rota
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    async function loadPending() {
      try {
        const res = await fetch("/api/v1/dashboard/metrics");
        if (res.ok) {
          const json = await res.json();
          const count = json.data?.pendingPayments?.count || 0;
          if (active) setPendingPaymentsCount(count);
        }
      } catch {}
    }
    loadPending();
    return () => {
      active = false;
    };
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
            role="dialog"
            aria-modal="true"
            aria-label="Mais funcionalidades"
            className="absolute bottom-16 left-0 right-0 bg-white border-t border-slate-200 rounded-t-2xl p-5 space-y-4 shadow-2xl max-h-[82vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-bold text-slate-900 text-sm">Mais Funcionalidades</span>
                <p className="text-[11px] text-slate-500">{displayName} • {roleLabel}</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Fechar menu"
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
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center justify-between p-3 rounded-xl text-xs font-semibold border transition-all ${
                      isActive
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs"
                        : "bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.href === "/payments" && pendingPaymentsCount > 0 && (
                        <StatusDot color="orange" />
                      )}
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? "text-indigo-600" : "text-slate-500"
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>

                    {item.href === "/payments" && pendingPaymentsCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        {pendingPaymentsCount}
                      </span>
                    )}
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
      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-200 backdrop-blur-xl md:hidden print:hidden px-3 py-2 shadow-lg"
      >
        {isCleaner ? (
          <div className="flex items-center justify-around">
            <Link
              href="/cleaner"
              aria-current={pathname === "/cleaner" ? "page" : undefined}
              className={`flex flex-col items-center justify-center py-1 px-4 rounded-xl transition-all ${
                pathname === "/cleaner"
                  ? "text-teal-600 font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Sparkles className={`w-5 h-5 ${pathname === "/cleaner" ? "text-teal-600" : "text-slate-400"}`} />
              <span className="text-[10px] mt-1">Minhas Casas</span>
            </Link>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex flex-col items-center justify-center py-1 px-4 rounded-xl text-rose-600 font-semibold transition-all cursor-pointer"
            >
              {loggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
              <span className="text-[10px] mt-1">Sair</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-around">
            {primaryNavItems.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
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
              aria-expanded={isOpen}
              aria-haspopup="dialog"
              aria-label="Mais opções de navegação"
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
        )}
      </nav>
    </>
  );
}
