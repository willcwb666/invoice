"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import {
  Users,
  Plus,
  Search,
  Navigation,
  ArrowUpRight,
  Phone,
  Mail,
  MapPin,
  Receipt,
  FileText,
} from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ActionButton } from "@/components/ui/action-button";
import { ClientModal } from "@/components/ui/client-modal";
import { motion } from "framer-motion";

export default function ClientsListPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [billingFilter, setBillingFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/clients");
      if (res.ok) {
        const json = await res.json();
        setClients(json.data || []);
      }
    } catch (e) {
      console.error("Erro ao buscar clientes:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        c.name.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q));

      const matchBilling =
        billingFilter === "ALL" || c.billingType === billingFilter;

      return matchSearch && matchBilling;
    });
  }, [clients, search, billingFilter]);



  const columns: ColumnDef<any>[] = [
    {
      key: "name",
      header: "Cliente",
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
            {c.name ? c.name.charAt(0).toUpperCase() : "C"}
          </div>
          <div>
            <Link
              href={`/clients/${c.id}`}
              className="font-bold text-slate-900 text-xs hover:text-indigo-600 transition-colors block"
            >
              {c.name}
            </Link>
            {c.city && (
              <span className="text-[11px] text-slate-400 font-medium">
                {c.city}, {c.state || "CO"}
              </span>
            )}
          </div>
        </div>
      ),
      sortValue: (c) => c.name,
    },
    {
      key: "contact",
      header: "Contato",
      sortable: false,
      render: (c) => (
        <div className="space-y-0.5 text-xs">
          {c.phone ? (
            <div className="flex items-center gap-1.5 text-slate-800 font-mono text-[11px]">
              <Phone className="w-3 h-3 text-emerald-600" />
              <span>{c.phone}</span>
            </div>
          ) : (
            <span className="text-slate-400 text-[11px]">-</span>
          )}
          {c.email && (
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] truncate max-w-[180px]">
              <Mail className="w-3 h-3 text-indigo-500 shrink-0" />
              <span className="truncate">{c.email}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "address",
      header: "Endereço (GPS)",
      sortable: true,
      render: (c) => (
        <div className="max-w-[220px]">
          <div className="flex items-center gap-1 text-slate-700 font-mono text-[11px] truncate">
            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
            <span className="truncate">{c.address}</span>
          </div>
          {c.zipCode && (
            <span className="text-[10px] text-slate-400 block font-mono pl-4">
              CEP: {c.zipCode}
            </span>
          )}
        </div>
      ),
      sortValue: (c) => c.address || "",
    },
    {
      key: "billingType",
      header: "Faturamento",
      sortable: true,
      render: (c) => {
        const isMonthly = c.billingType === "CONSOLIDATED_MONTHLY";
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              isMonthly
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {isMonthly ? "Mensal Consolidado" : "Por Faxina / Trabalho"}
          </span>
        );
      },
      sortValue: (c) => c.billingType || "",
    },
    {
      key: "invoicesCount",
      header: "Faturas",
      sortable: true,
      className: "text-center",
      render: (c) => (
        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-lg bg-slate-100 text-slate-800 font-bold text-xs font-mono">
          {c._count?.invoices || 0}
        </span>
      ),
      sortValue: (c) => c._count?.invoices || 0,
    },
    {
      key: "actions",
      header: "Ações & Rotas",
      sortable: false,
      className: "w-44 text-right",
      render: (c) => (
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Apple Maps */}
          {c.address && (
            <ActionButton
              icon={<Navigation className="w-3.5 h-3.5" />}
              tooltip="Navegar no Apple Maps"
              hoverColor="blue"
              href={`https://maps.apple.com/?daddr=${encodeURIComponent(
                `${c.address}, ${c.city || "Greeley"}, ${c.state || "CO"}`
              )}`}
            />
          )}

          {/* Google Maps */}
          {c.address && (
            <ActionButton
              icon={<Navigation className="w-3.5 h-3.5 text-emerald-600" />}
              tooltip="Navegar no Google Maps"
              hoverColor="green"
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                `${c.address}, ${c.city || "Greeley"}, ${c.state || "CO"}`
              )}`}
            />
          )}

          {/* Ver Ficha Completa */}
          <ActionButton
            icon={<ArrowUpRight className="w-3.5 h-3.5" />}
            tooltip="Ver Ficha Completa do Cliente"
            hoverColor="purple"
            href={`/clients/${c.id}`}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Clientes & Navegação GPS"
        subtitle="Contatos, faturamento e cálculo de rotas para Apple e Google Maps"
        onRefresh={fetchClients}
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
                placeholder="Buscar por cliente, endereço, telefone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
              />
            </div>

            <select
              value={billingFilter}
              onChange={(e) => {
                setBillingFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="ALL">Todos os tipos</option>
              <option value="PER_JOB">Por Faxina</option>
              <option value="CONSOLIDATED_MONTHLY">Mensal Consolidado</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsClientModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Cliente</span>
            </button>
          </div>
        </div>

        {/* Standardized DataTable */}
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
            defaultSortKey="name"
            defaultSortDir="asc"
            keyExtractor={(item) => item.id}
            emptyMessage={
              loading
                ? "Carregando clientes..."
                : "Nenhum cliente encontrado com os filtros selecionados."
            }
          />
        </motion.div>

        {/* Reusable Pagination */}
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

      {/* Client Modal */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSuccess={() => {
          fetchClients();
        }}
      />
    </div>
  );
}
