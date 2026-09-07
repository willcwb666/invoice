"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { Receipt, ArrowUpRight } from "lucide-react";

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
          <p className="text-xs text-slate-500">
            Orçamentos emitidos para potenciais clientes de limpeza residencial e comercial.
          </p>
        </div>

        {estimates.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 shadow-xs">
            <Receipt className="w-10 h-10 text-amber-500 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-900 mb-1">Nenhum orçamento emitido ainda</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Quando um cliente solicitar orçamento na rua, envie um link direto para ele aprovar online.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Orçamento</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Validade</th>
                  <th className="px-6 py-4">Valor Total</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {estimates.map((est) => (
                  <tr key={est.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-indigo-600">
                      <Link href={`/estimates/${est.id}`} className="hover:underline">
                        {est.estimateNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">{est.client?.name}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(est.validUntil).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      ${Number(est.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                        {est.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/estimates/${est.id}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
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
