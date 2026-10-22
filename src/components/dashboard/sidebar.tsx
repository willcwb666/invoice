"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StatusDot } from "@/components/ui/status-dot";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
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
  UserCheck,
  Wrench,
  Wallet,
  Landmark,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Percent,
  Briefcase,
  Award,
  FileSpreadsheet,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: any;
}

// Categoria 1: Visão Geral & Agenda Operacional
const operationNavItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: TrendingUp },
  { name: "Agenda", href: "/agenda", icon: Calendar },
];

// Categoria 2: Comercial & Faturamento (Orçamentos, Faturas e Clientes juntos)
const commercialNavItems: NavItem[] = [
  { name: "Orçamentos", href: "/estimates", icon: Receipt },
  { name: "Faturas (Invoices)", href: "/invoices", icon: FileText },
  { name: "Clientes & GPS", href: "/clients", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isSuperAdmin } = useCurrentUser();
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);

  const isFinancialActive =
    pathname === "/financeiro" ||
    pathname.startsWith("/payments") ||
    pathname.startsWith("/expenses") ||
    pathname.startsWith("/commissions");

  const isGestaoActive =
    pathname.startsWith("/professionals") ||
    pathname.startsWith("/services") ||
    pathname.startsWith("/users");

  const [isFinancialOpen, setIsFinancialOpen] = useState(isFinancialActive);
  const [isGestaoOpen, setIsGestaoOpen] = useState(isGestaoActive);

  useEffect(() => {
    if (isFinancialActive) {
      setIsFinancialOpen(true);
    }
  }, [isFinancialActive]);

  useEffect(() => {
    if (isGestaoActive) {
      setIsGestaoOpen(true);
    }
  }, [isGestaoActive]);

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
      } catch {
        // silent
      }
    }
    loadPending();
    return () => {
      active = false;
    };
  }, [pathname]);

  const hasFinancialPending = pendingPaymentsCount > 0;

  const renderNavLink = (item: NavItem) => {
    const isActive =
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.name}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
          isActive
            ? "bg-indigo-50 text-indigo-700 shadow-xs border border-indigo-100/60"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon
            className={`w-4 h-4 shrink-0 ${
              isActive ? "text-indigo-600" : "text-slate-400"
            }`}
          />
          <span className="truncate font-bold">{item.name}</span>
        </div>
      </Link>
    );
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

        {/* Navigation - Categorias separadas por linha divisória */}
        <nav aria-label="Navegação principal" className="p-4 space-y-3">
          {/* CATEGORIA 1: Operação (Dashboard & Agenda) */}
          <div className="space-y-1">
            <span className="px-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Operação
            </span>
            {operationNavItems.map(renderNavLink)}
          </div>

          <div className="border-t border-slate-200/80" />

          {/* CATEGORIA 2: Comercial & Faturamento (Orçamentos, Faturas e Clientes) */}
          <div className="space-y-1">
            <span className="px-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Comercial & Faturamento
            </span>
            {commercialNavItems.map(renderNavLink)}
          </div>

          <div className="border-t border-slate-200/80" />

          {/* CATEGORIA 3: Módulos de Controle (Financeiro & Gestão) */}
          <div className="space-y-1">
            <span className="px-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Módulos de Gestão
            </span>

            {/* Menu Dropdown: Financeiro (Visão Geral, Pagamentos, Despesas, Comissões) */}
            <div>
              <div
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
                  pathname === "/financeiro"
                    ? "bg-indigo-50 text-indigo-700 shadow-xs border border-indigo-100/60"
                    : isFinancialActive
                    ? "text-indigo-700 bg-indigo-50/40"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                <Link
                  href="/financeiro"
                  onClick={() => setIsFinancialOpen(true)}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <div className="relative">
                    <Landmark
                      className={`w-4 h-4 shrink-0 ${
                        isFinancialActive ? "text-indigo-600" : "text-slate-400"
                      }`}
                    />
                    {!isFinancialOpen && hasFinancialPending && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </div>
                  <span className="truncate font-bold">Financeiro</span>
                </Link>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFinancialOpen((prev) => !prev);
                  }}
                  className="p-1 -mr-1 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={isFinancialOpen ? "Recolher menu" : "Expandir menu"}
                  aria-expanded={isFinancialOpen}
                  aria-label={isFinancialOpen ? "Recolher menu Financeiro" : "Expandir menu Financeiro"}
                >
                  {isFinancialOpen ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {isFinancialOpen && (
                <div className="mt-1 ml-4 pl-3 border-l-2 border-indigo-100 space-y-1 py-1">
                  <Link
                    href="/financeiro"
                    aria-current={pathname === "/financeiro" ? "page" : undefined}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      pathname === "/financeiro"
                        ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100/80"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BarChart3
                        className={`w-3.5 h-3.5 shrink-0 ${
                          pathname === "/financeiro" ? "text-indigo-600" : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">Visão Geral</span>
                    </div>
                  </Link>

                  <Link
                    href="/payments"
                    aria-current={pathname.startsWith("/payments") ? "page" : undefined}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      pathname.startsWith("/payments")
                        ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100/80"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {hasFinancialPending && (
                        <StatusDot
                          color="orange"
                          tooltip={`${pendingPaymentsCount} pagamento(s) pendente(s)`}
                        />
                      )}
                      <Wallet
                        className={`w-3.5 h-3.5 shrink-0 ${
                          pathname.startsWith("/payments") ? "text-indigo-600" : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">Pagamentos</span>
                    </div>

                    {hasFinancialPending && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        {pendingPaymentsCount}
                      </span>
                    )}
                  </Link>

                  <Link
                    href="/expenses"
                    aria-current={pathname.startsWith("/expenses") ? "page" : undefined}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      pathname.startsWith("/expenses")
                        ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100/80"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Fuel
                        className={`w-3.5 h-3.5 shrink-0 ${
                          pathname.startsWith("/expenses") ? "text-indigo-600" : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">Despesas</span>
                    </div>
                  </Link>

                  <Link
                    href="/commissions"
                    aria-current={pathname.startsWith("/commissions") ? "page" : undefined}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      pathname.startsWith("/commissions")
                        ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100/80"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Percent
                        className={`w-3.5 h-3.5 shrink-0 ${
                          pathname.startsWith("/commissions") ? "text-indigo-600" : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">Comissões</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* Menu Dropdown: Gestão (Profissionais, Serviços, Usuários & RBAC) */}
            <div>
              <button
                type="button"
                onClick={() => setIsGestaoOpen((prev) => !prev)}
                aria-expanded={isGestaoOpen}
                aria-label={isGestaoOpen ? "Recolher menu Gestão" : "Expandir menu Gestão"}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
                  isGestaoActive
                    ? "text-indigo-700 bg-indigo-50/60 border border-indigo-100/60"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Briefcase
                    className={`w-4 h-4 shrink-0 ${
                      isGestaoActive ? "text-indigo-600" : "text-slate-400"
                    }`}
                  />
                  <span className="truncate font-bold">Gestão</span>
                </div>

                {isGestaoOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                )}
              </button>

              {isGestaoOpen && (
                <div className="mt-1 ml-4 pl-3 border-l-2 border-indigo-100 space-y-1 py-1">
                  <Link
                    href="/professionals"
                    aria-current={pathname.startsWith("/professionals") ? "page" : undefined}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      pathname.startsWith("/professionals")
                        ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100/80"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Award
                        className={`w-3.5 h-3.5 shrink-0 ${
                          pathname.startsWith("/professionals")
                            ? "text-indigo-600"
                            : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">Profissionais</span>
                    </div>
                  </Link>

                  <Link
                    href="/services"
                    aria-current={pathname.startsWith("/services") ? "page" : undefined}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      pathname.startsWith("/services")
                        ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100/80"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Wrench
                        className={`w-3.5 h-3.5 shrink-0 ${
                          pathname.startsWith("/services")
                            ? "text-indigo-600"
                            : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">Serviços</span>
                    </div>
                  </Link>

                  <Link
                    href="/users"
                    aria-current={pathname.startsWith("/users") ? "page" : undefined}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      pathname.startsWith("/users")
                        ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100/80"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserCheck
                        className={`w-3.5 h-3.5 shrink-0 ${
                          pathname.startsWith("/users") ? "text-indigo-600" : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">Usuários & RBAC</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200/80" />

          {/* CATEGORIA 4: Relatórios */}
          <div className="space-y-1">
            <span className="px-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Relatórios & Análise
            </span>
            {renderNavLink({ name: "Relatórios", href: "/reports", icon: FileSpreadsheet })}
          </div>

          <div className="border-t border-slate-200/80" />

          {/* CATEGORIA 5: Sistema */}
          <div className="space-y-1">
            {renderNavLink({ name: "Configurações", href: "/settings", icon: Settings })}
            {isSuperAdmin &&
              renderNavLink({ name: "Super-Admin: Empresas", href: "/admin/companies", icon: ShieldCheck })}
          </div>
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
