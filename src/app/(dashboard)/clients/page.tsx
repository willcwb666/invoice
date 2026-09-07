"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { Users, Plus, Search, Navigation, ArrowUpRight } from "lucide-react";

export default function ClientsListPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/clients");
      if (res.ok) {
        const json = await res.json();
        setClients(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.address && c.address.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <Header
        title="Clientes & Navegação GPS"
        subtitle="Endereços com cálculo de rota para Apple Maps e Google Maps"
        onRefresh={fetchClients}
        loading={loading}
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome do cliente ou endereço..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden shadow-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Endereço (GPS)</th>
                <th className="px-6 py-4">Tipo de Cobrança</th>
                <th className="px-6 py-4">Faturas</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-white">
                    <Link href={`/clients/${c.id}`} className="hover:text-indigo-400">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-200">{c.phone || "-"}</div>
                    <div className="text-slate-400 text-[11px]">{c.email || "-"}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-300">{c.address}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-semibold">
                      {c.billingType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-white">{c._count?.invoices || 0}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/clients/${c.id}`}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <span>Ver Ficha</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
