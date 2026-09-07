"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { FileText, Plus, Search, ArrowUpRight, CheckCircle2, Clock } from "lucide-react";

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
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none shadow-2xs"
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Fatura</span>
            </Link>
          </div>
        </div>

        {/* Invoices List */}
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Nenhuma fatura encontrada.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-600">
                          {inv.invoiceNumber}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">
                          {inv.client?.name}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1 font-medium">
                        <span>
                          Emitida: {new Date(inv.issueDate).toLocaleDateString("pt-BR")}
                        </span>
                        <span>•</span>
                        <span>
                          Vencimento: {new Date(inv.dueDate).toLocaleDateString("pt-BR")}
                        </span>
                        {inv.client?.address && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px] text-slate-600">
                              {inv.client.address}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <span className="font-black text-slate-900 text-base block">
                        ${Number(inv.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                          inv.status === "PAID"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : inv.status === "OVERDUE"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>

                    <ArrowUpRight className="w-4 h-4 text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
