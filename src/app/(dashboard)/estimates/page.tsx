"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import {
  Receipt,
  Plus,
  Search,
  ArrowUpRight,
  Printer,
  FileCheck2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ActionButton } from "@/components/ui/action-button";
import { EstimateModal } from "@/components/ui/estimate-modal";
import { useToast } from "@/components/ui/toast";
import { motion } from "framer-motion";

export default function EstimatesListPage() {
  const router = useRouter();
  const { showToast, confirmAction } = useToast();
  const [estimates, setEstimates] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/estimates");
      if (res.ok) {
        const json = await res.json();
        setEstimates(json.data || []);
      }
    } catch (e) {
      console.error("Erro ao buscar orçamentos:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstimates();
  }, []);

  const handleConvert = (estimateId: string) => {
    confirmAction("Convertendo orçamento em fatura oficial...", async () => {
      try {
        const res = await fetch(`/api/v1/estimates/${estimateId}/convert`, {
          method: "POST",
        });
        const json = await res.json();
        if (res.ok && json.data?.id) {
          router.push(`/invoices/${json.data.id}`);
        } else {
          showToast(json.error || "Erro ao converter orçamento.", "error");
        }
      } catch (e) {
        console.error("Erro na conversão:", e);
        showToast("Erro ao converter orçamento.", "error");
      }
    });
  };

  const filtered = useMemo(() => {
    return estimates.filter((est) => {
      const q = search.toLowerCase();
      const matchSearch =
        est.estimateNumber?.toLowerCase().includes(q) ||
        est.client?.name?.toLowerCase().includes(q) ||
        est.notes?.toLowerCase().includes(q);

      const matchStatus = statusFilter === "ALL" || est.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [estimates, search, statusFilter]);



  const columns: ColumnDef<any>[] = [
    {
      key: "estimateNumber",
      header: "Nº Orçamento",
      sortable: true,
      className: "w-32",
      render: (est) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
            <Receipt className="w-3.5 h-3.5" />
          </div>
          <Link
            href={`/estimates/${est.id}`}
            className="font-mono font-bold text-indigo-600 hover:text-indigo-700 text-xs"
          >
            {est.estimateNumber}
          </Link>
        </div>
      ),
      sortValue: (est) => est.estimateNumber,
    },
    {
      key: "client",
      header: "Cliente",
      sortable: true,
      render: (est) => (
        <div>
          <div className="font-bold text-slate-900 text-xs">{est.client?.name}</div>
          <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
            {est.client?.phone || est.client?.email || "Sem contato informado"}
          </div>
        </div>
      ),
      sortValue: (est) => est.client?.name || "",
    },
    {
      key: "issueDate",
      header: "Emissão",
      sortable: true,
      render: (est) => (
        <span className="text-slate-600 font-mono text-[11px]">
          {new Date(est.issueDate || est.createdAt).toLocaleDateString("pt-BR")}
        </span>
      ),
      sortValue: (est) => new Date(est.issueDate || est.createdAt),
    },
    {
      key: "validUntil",
      header: "Validade",
      sortable: true,
      render: (est) => {
        const isExpired = new Date(est.validUntil).getTime() < Date.now();
        return (
          <span
            className={`font-mono text-[11px] ${
              isExpired ? "text-rose-600 font-semibold" : "text-slate-600"
            }`}
          >
            {new Date(est.validUntil).toLocaleDateString("pt-BR")}
          </span>
        );
      },
      sortValue: (est) => new Date(est.validUntil),
    },
    {
      key: "totalAmount",
      header: "Valor Total",
      sortable: true,
      className: "text-right",
      render: (est) => (
        <span className="font-mono font-bold text-slate-900 text-xs block text-right">
          ${Number(est.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      ),
      sortValue: (est) => Number(est.totalAmount),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (est) => {
        const status = est.status;
        let badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
        let label = "Rascunho";
        let Icon = Clock;

        if (status === "SENT") {
          badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
          label = "Enviado";
        } else if (status === "ACCEPTED") {
          badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
          label = "Aceito";
          Icon = CheckCircle2;
        } else if (status === "CONVERTED") {
          badgeClass = "bg-purple-50 text-purple-700 border-purple-200";
          label = "Faturado";
          Icon = FileCheck2;
        } else if (status === "REJECTED") {
          badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
          label = "Recusado";
          Icon = XCircle;
        }

        return (
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeClass}`}
          >
            <Icon className="w-3 h-3" />
            <span>{label}</span>
          </span>
        );
      },
      sortValue: (est) => est.status,
    },
    {
      key: "actions",
      header: "Ações",
      sortable: false,
      className: "w-36 text-right",
      render: (est) => (
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Visualizar */}
          <ActionButton
            icon={<ArrowUpRight className="w-3.5 h-3.5" />}
            tooltip="Ver Orçamento Completo"
            hoverColor="blue"
            href={`/estimates/${est.id}`}
          />

          {/* Converter em Fatura Oficial */}
          {est.status !== "CONVERTED" && (
            <ActionButton
              icon={<FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />}
              tooltip="Converter em Fatura Oficial (1 Clique)"
              hoverColor="green"
              onClick={() => handleConvert(est.id)}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Orçamentos (Estimates)"
        subtitle="Emita orçamentos rápidos e converta em faturas em 1 clique"
        onRefresh={fetchEstimates}
        loading={loading}
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por número, cliente ou termos..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="ALL">Todos os status</option>
              <option value="DRAFT">Rascunho</option>
              <option value="SENT">Enviado</option>
              <option value="ACCEPTED">Aceito</option>
              <option value="CONVERTED">Faturado</option>
              <option value="REJECTED">Recusado</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEstimateModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Orçamento</span>
            </button>
          </div>
        </div>

        {/* Standardized Data Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <DataTable
            columns={columns}
            data={filtered}
            currentPage={currentPage}
            pageSize={pageSize}
            defaultSortKey="estimateNumber"
            defaultSortDir="desc"
            keyExtractor={(item) => item.id}
            emptyMessage={
              loading
                ? "Carregando orçamentos..."
                : "Nenhum orçamento encontrado com os filtros selecionados."
            }
          />
        </motion.div>

        {/* Reusable Pagination Component */}
        {filtered.length > 0 && (
          <Pagination
            totalItems={filtered.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => setPageSize(size)}
            pageSizeOptions={[10, 20, 30, 50, 100]}
          />
        )}
      </div>

      {/* Estimate Modal */}
      <EstimateModal
        isOpen={isEstimateModalOpen}
        onClose={() => setIsEstimateModalOpen(false)}
        onSuccess={() => {
          fetchEstimates();
        }}
      />
    </div>
  );
}
