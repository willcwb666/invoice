"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import {
  FileText,
  Plus,
  Search,
  ArrowUpRight,
  Printer,
  QrCode,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ActionButton } from "@/components/ui/action-button";
import { PaymentModal } from "@/components/ui/payment-modal";
import { SendModal } from "@/components/ui/send-modal";
import { motion } from "framer-motion";

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any>(null);
  const [selectedInvoiceForSend, setSelectedInvoiceForSend] = useState<any>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/invoices");
      if (res.ok) {
        const json = await res.json();
        setInvoices(json.data || []);
      }
    } catch (e) {
      console.error("Erro ao buscar faturas:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const matchSearch =
        inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        inv.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
        inv.client?.address?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "ALL" || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, search, statusFilter]);



  // Table columns definition
  const columns: ColumnDef<any>[] = [
    {
      key: "invoiceNumber",
      header: "Nº Fatura",
      sortable: true,
      className: "w-28",
      render: (inv) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono font-bold text-indigo-700 text-xs">
            {inv.invoiceNumber}
          </span>
        </div>
      ),
      sortValue: (inv) => inv.invoiceNumber,
    },
    {
      key: "client",
      header: "Cliente",
      sortable: true,
      render: (inv) => (
        <div>
          <div className="font-bold text-slate-900 text-xs">{inv.client?.name}</div>
          <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
            {inv.client?.address || "Endereço não informado"}
          </div>
        </div>
      ),
      sortValue: (inv) => inv.client?.name || "",
    },
    {
      key: "issueDate",
      header: "Emissão",
      sortable: true,
      render: (inv) => (
        <span className="text-slate-600 font-mono text-[11px]">
          {new Date(inv.issueDate).toLocaleDateString("pt-BR")}
        </span>
      ),
      sortValue: (inv) => new Date(inv.issueDate),
    },
    {
      key: "dueDate",
      header: "Vencimento",
      sortable: true,
      render: (inv) => (
        <span className="text-slate-600 font-mono text-[11px]">
          {new Date(inv.dueDate).toLocaleDateString("pt-BR")}
        </span>
      ),
      sortValue: (inv) => new Date(inv.dueDate),
    },
    {
      key: "totalAmount",
      header: "Valor Total",
      sortable: true,
      className: "text-right",
      render: (inv) => (
        <span className="font-mono font-bold text-slate-900 text-xs block text-right">
          ${Number(inv.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      ),
      sortValue: (inv) => Number(inv.totalAmount),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (inv) => {
        const isPaid = inv.status === "PAID";
        const isOverdue = inv.status === "OVERDUE";
        return (
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
              isPaid
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : isOverdue
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {isPaid ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            ) : isOverdue ? (
              <AlertCircle className="w-3 h-3 text-rose-600" />
            ) : (
              <Clock className="w-3 h-3 text-amber-600" />
            )}
            <span>{isPaid ? "Paga" : isOverdue ? "Vencida" : "Pendente"}</span>
          </span>
        );
      },
      sortValue: (inv) => inv.status,
    },
    {
      key: "actions",
      header: "Ações",
      sortable: false,
      className: "w-44 text-right",
      render: (inv) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Botão de Ver Fatura (setinha) */}
          <ActionButton
            icon={<ArrowUpRight className="w-3.5 h-3.5" />}
            tooltip="Visualizar Fatura Completa"
            hoverColor="blue"
            href={`/invoices/${inv.id}`}
          />

          {/* Botão de Imprimir Fatura (ícone impressora com tooltip) */}
          <ActionButton
            icon={<Printer className="w-3.5 h-3.5" />}
            tooltip="Imprimir / Salvar PDF"
            hoverColor="green"
            href={`/invoices/${inv.id}?print=true`}
          />

          {/* Botão de Gerar Link de Pagamento (Zelle / Venmo) */}
          <ActionButton
            icon={<QrCode className="w-3.5 h-3.5" />}
            tooltip="QR Code & Pagamento (Zelle / Venmo)"
            hoverColor="yellow"
            onClick={() => setSelectedInvoiceForPayment(inv)}
          />

          {/* Botão de Enviar (WhatsApp, SMS, Email) */}
          <ActionButton
            icon={<Send className="w-3.5 h-3.5" />}
            tooltip="Enviar Fatura (WhatsApp, SMS, E-mail)"
            hoverColor="purple"
            onClick={() => setSelectedInvoiceForSend(inv)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Faturas (Invoices)"
        subtitle="Gerenciamento e ordenação de faturas comerciais e residenciais"
        onRefresh={fetchInvoices}
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
                placeholder="Buscar por número, cliente ou endereço..."
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

        {/* Standardized Data Table with default sort by invoiceNumber */}
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
            defaultSortKey="invoiceNumber"
            defaultSortDir="desc"
            keyExtractor={(item) => item.id}
            emptyMessage={
              loading
                ? "Carregando faturas..."
                : "Nenhuma fatura encontrada com os filtros selecionados."
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

      {/* Payment Modal with Zelle / Venmo QR Code */}
      {selectedInvoiceForPayment && (
        <PaymentModal
          isOpen={!!selectedInvoiceForPayment}
          onClose={() => setSelectedInvoiceForPayment(null)}
          invoice={selectedInvoiceForPayment}
        />
      )}

      {/* Send Modal with WhatsApp / SMS / Email Checkboxes */}
      {selectedInvoiceForSend && (
        <SendModal
          isOpen={!!selectedInvoiceForSend}
          onClose={() => setSelectedInvoiceForSend(null)}
          invoice={selectedInvoiceForSend}
        />
      )}
    </div>
  );
}
