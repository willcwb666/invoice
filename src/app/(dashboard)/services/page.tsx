"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/dashboard/header";
import { Plus, Wrench, Pencil, Trash2, Clock, Sparkles, Layers } from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ActionButton } from "@/components/ui/action-button";
import { ServiceModal, ServiceRecord } from "@/components/ui/service-modal";
import { useToast } from "@/components/ui/toast";

export default function ServicesPage() {
  const { showToast, confirmDelete } = useToast();
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/services");
      if (res.ok) {
        const json = await res.json();
        setServices(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleDelete = (service: ServiceRecord) => {
    confirmDelete(`Excluindo "${service.name}"...`, async () => {
      try {
        const res = await fetch(`/api/v1/services/${service.id}`, { method: "DELETE" });
        const json = await res.json();
        if (!res.ok) {
          showToast(json.error || "Não foi possível excluir o serviço.", "error");
          return;
        }
        showToast("Serviço excluído com sucesso.", "success");
        fetchServices();
      } catch (e) {
        showToast("Erro ao excluir serviço.", "error");
      }
    });
  };

  const stats = useMemo(() => {
    const standard = services.filter((s) => s.type === "STANDARD").length;
    const extra = services.filter((s) => s.type === "EXTRA").length;
    return { total: services.length, standard, extra };
  }, [services]);

  const columns: ColumnDef<ServiceRecord>[] = [
    {
      key: "name",
      header: "Serviço",
      sortable: true,
      render: (s) => (
        <div>
          <span className="font-bold text-slate-900 text-xs block">{s.name}</span>
          {s.description && (
            <span className="text-slate-500 text-[11px] block truncate max-w-[280px]">
              {s.description}
            </span>
          )}
        </div>
      ),
      sortValue: (s) => s.name,
    },
    {
      key: "type",
      header: "Tipo",
      sortable: true,
      render: (s) => (
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
            s.type === "STANDARD"
              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
        >
          {s.type === "STANDARD" ? "Standard" : "Extra"}
        </span>
      ),
      sortValue: (s) => s.type,
    },
    {
      key: "basePrice",
      header: "Preço Base ($)",
      sortable: true,
      className: "text-right",
      render: (s) => (
        <span className="font-mono font-bold text-emerald-600 text-xs block text-right">
          ${Number(s.basePrice).toFixed(2)}
        </span>
      ),
      sortValue: (s) => Number(s.basePrice),
    },
    {
      key: "defaultDurationMinutes",
      header: "Duração",
      sortable: true,
      className: "text-right",
      render: (s) => (
        <span className="text-slate-600 text-[11px] font-mono flex items-center justify-end gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          {s.defaultDurationMinutes} min
        </span>
      ),
      sortValue: (s) => s.defaultDurationMinutes,
    },
    {
      key: "actions",
      header: "Ações",
      sortable: false,
      className: "w-24 text-right",
      render: (s) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <ActionButton
            icon={<Pencil className="w-3.5 h-3.5" />}
            tooltip="Editar serviço"
            hoverColor="blue"
            onClick={() => {
              setEditingService(s);
              setIsModalOpen(true);
            }}
          />
          <ActionButton
            icon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />}
            tooltip="Excluir serviço"
            hoverColor="red"
            onClick={() => handleDelete(s)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Serviços"
        subtitle="Catálogo de serviços Standard e Extra usados nos agendamentos"
        onRefresh={fetchServices}
        loading={loading}
        actionSlot={
          <button
            onClick={() => {
              setEditingService(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Serviço</span>
          </button>
        }
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Total de Serviços</span>
              <Wrench className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{stats.total}</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-indigo-600 text-xs font-semibold">
              <span>Standard</span>
              <Layers className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-indigo-600 mt-2">{stats.standard}</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-amber-600 text-xs font-semibold">
              <span>Extra</span>
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-black text-amber-600 mt-2">{stats.extra}</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={services}
          currentPage={currentPage}
          pageSize={pageSize}
          defaultSortKey="name"
          defaultSortDir="asc"
          keyExtractor={(item) => item.id}
          emptyMessage={
            loading ? "Carregando serviços..." : "Nenhum serviço cadastrado ainda."
          }
        />

        {services.length > 0 && (
          <Pagination
            totalItems={services.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => setPageSize(size)}
            pageSizeOptions={[10, 20, 30, 50]}
          />
        )}
      </div>

      <ServiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        service={editingService}
        onSuccess={() => {
          showToast(
            editingService ? "Serviço atualizado com sucesso." : "Serviço cadastrado com sucesso.",
            "success"
          );
          fetchServices();
        }}
      />
    </div>
  );
}
