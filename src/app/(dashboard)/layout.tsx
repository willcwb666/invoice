import React from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background subtle light effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-[#f8fafc]">
        <div className="absolute -top-40 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      {/* Sidebar Fixa à Esquerda (oculta no mobile) */}
      <Sidebar />

      {/* Área Principal de Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden pb-20 md:pb-0">
        {children}
      </div>

      {/* Navegação Móvel Fixa no Rodapé (visível apenas no mobile) */}
      <MobileNav />
    </div>
  );
}
