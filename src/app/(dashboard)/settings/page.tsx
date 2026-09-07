"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/dashboard/header";
import { Settings, MapPin, DollarSign, ShieldCheck, CheckCircle2, Phone, Mail } from "lucide-react";

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/dashboard/metrics")
      .then((r) => r.json())
      .then(() => {
        setProfile({
          name: "Renata Matos de Oliveira",
          email: "renatamatoz@gmail.com",
          phone: "970 412 9406",
          monthlyGoal: 6000,
          zelle: "9704129406",
          venmo: "@RenataMatoz",
          check: "Renata Matos de Oliveira",
          addresses: [
            {
              id: "1",
              label: "Evans (Atual / Vigente)",
              address: "4172 MeadowView - Evans, CO - 80620",
              isDefault: true,
            },
            {
              id: "2",
              label: "Greeley (Histórico)",
              address: "1705 30th St., #104 - Greeley, CO - 80631",
              isDefault: false,
            },
          ],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Header
        title="Configurações da Empresa"
        subtitle="Endereços, pagamentos e meta mensal de faturamento"
      />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Dados Gerais & Meta de Faturamento */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 shadow-xl">
          <h3 className="font-bold text-white text-sm">Dados da Empresa & Meta Mensal</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Nome Profissional</label>
              <input
                type="text"
                disabled
                value={profile?.name || ""}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white font-semibold"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Telefone Principal (Zelle / WhatsApp)</label>
              <input
                type="text"
                disabled
                value={profile?.phone || ""}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white font-semibold"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">E-mail de Contato & Notificações</label>
              <input
                type="text"
                disabled
                value={profile?.email || ""}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white font-semibold"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Meta Mensal de Faturamento ($)</label>
              <input
                type="text"
                disabled
                value={`$${profile?.monthlyGoal?.toFixed(2) || "6,000.00"}`}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-emerald-400 font-bold font-mono"
              />
            </div>
          </div>
        </div>

        {/* Gerenciamento dos Dois Endereços (Evans e Greeley) */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-white text-sm">Endereços Cadastrados no Banco de Dados</h3>
          </div>
          <p className="text-xs text-slate-400">
            O endereço atual é aplicado em novas faturas. O endereço anterior é preservado para faturas históricas.
          </p>

          <div className="space-y-3 pt-2">
            {profile?.addresses?.map((addr: any) => (
              <div
                key={addr.id}
                className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
                  addr.isDefault
                    ? "bg-slate-800/80 border-emerald-500/40"
                    : "bg-slate-900/40 border-slate-800"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-white">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                        Padrão Atual
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-slate-300">{addr.address}</p>
                </div>
                {addr.isDefault && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Formas de Pagamento Configuradas */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 shadow-xl">
          <h3 className="font-bold text-white text-sm">Formas de Pagamento Exibidas nos Invoices</h3>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex justify-between">
              <span className="text-slate-400">Zelle:</span>
              <span className="font-bold text-white font-mono">{profile?.zelle}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex justify-between">
              <span className="text-slate-400">Venmo:</span>
              <span className="font-bold text-white font-mono">{profile?.venmo}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex justify-between">
              <span className="text-slate-400">Cheque Nominal:</span>
              <span className="font-bold text-white">{profile?.check}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
