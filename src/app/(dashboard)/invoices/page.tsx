"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { FileText, Plus, Search, Filter, ArrowUpRight, CheckCircle2, Clock } from "lucide-react";

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/invoices");
      if (res.ok) {
        const json = await res.json();
        setInvoices(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const filtered = invoices.filter((inv) => {
    const matchSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.client?.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <Header
        title="Faturas (Invoices)"
        subtitle="Controle de faturamento mensal e avulso"
        onRefresh={fetchInvoices}
        loading={loading}
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por número ou cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">Todos os status</option>
              <option value="PAID">Pagas</option>
              <option value="PENDING">Pendentes</option>
              <option value="OVERDUE">Vencidas</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/invoices/new"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Fatura</span>
            </Link>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden shadow-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Fatura</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Endereço de Emissão</th>
                <th className="px-6 py-4">Vencimento</th>
                <th className="px-6 py-4">Valor Total</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Nenhuma fatura encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-indigo-400">
                      <Link href={`/invoices/${inv.id}`} className="hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{inv.client?.name}</div>
                      <div className="text-[11px] text-slate-400">{inv.client?.phone || inv.client?.email}</div>
                    </td>
                    <td className="px-6 py-4 text-[11px] font-mono text-slate-400">
                      {inv.providerAddress || "Evans, CO"}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {new Date(inv.dueDate).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      ${Number(inv.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          inv.status === "PAID"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <span>Abrir</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
