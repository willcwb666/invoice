"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { Receipt, Plus, ArrowUpRight, CheckCircle2, Clock } from "lucide-react";

export default function EstimatesListPage() {
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/estimates");
      if (res.ok) {
        const json = await res.json();
        setEstimates(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstimates();
  }, []);

  return (
    <div>
      <Header
        title="Orçamentos (Estimates)"
        subtitle="Emita orçamentos rápidos e converta em faturas em 1 clique"
        onRefresh={fetchEstimates}
        loading={loading}
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Orçamentos emitidos para potenciais clientes de limpeza residencial e comercial.
          </p>
        </div>

        {estimates.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
            <Receipt className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white mb-1">Nenhum orçamento emitido ainda</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Quando um cliente solicitar orçamento na rua, envie um link direto para ele aprovar online.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden shadow-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Orçamento</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Validade</th>
                  <th className="px-6 py-4">Valor Total</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {estimates.map((est) => (
                  <tr key={est.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-indigo-400">
                      <Link href={`/estimates/${est.id}`} className="hover:underline">
                        {est.estimateNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-bold text-white">{est.client?.name}</td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(est.validUntil).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      ${Number(est.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {est.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/estimates/${est.id}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <span>Detalhes</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
