"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { AddressNormalizer } from "@/lib/address-normalizer";
import {
  Users,
  ArrowLeft,
  Navigation,
  MapPin,
  Phone,
  Mail,
  FileText,
  Calendar,
  ArrowUpRight,
  Plus,
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSignature,
  Home,
  Bed,
  Bath,
  Maximize2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { EstimateModal } from "@/components/ui/estimate-modal";
import { useToast } from "@/components/ui/toast";

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const clientId = resolvedParams.id;
  const { showToast } = useToast();

  const [client, setClient] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [isRefreshingRentCast, setIsRefreshingRentCast] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch(`/api/v1/clients/${clientId}`);
      if (res.ok) {
        const json = await res.json();
        const c = json.data;
        if (c) {
          setClient(c);
          setInvoices(c.invoices || []);
          setAppointments(c.appointments || []);
          setEstimates(c.estimates || []);
          return;
        }
      }

      // Fallback
      const [resClients, resInvoices, resAppts, resEstimates] = await Promise.all([
        fetch("/api/v1/clients"),
        fetch("/api/v1/invoices"),
        fetch("/api/v1/appointments"),
        fetch("/api/v1/estimates"),
      ]);

      let currentClient: any = null;
      if (resClients.ok) {
        const clients = (await resClients.json()).data || [];
        currentClient = clients.find((c: any) => c.id === clientId);
        setClient(currentClient);
      }

      if (resInvoices.ok) {
        const allInvoices = (await resInvoices.json()).data || [];
        setInvoices(
          allInvoices.filter(
            (inv: any) =>
              inv.clientId === clientId ||
              (currentClient && inv.client?.name === currentClient.name)
          )
        );
      }

      if (resAppts.ok) {
        const allAppts = (await resAppts.json()).data || [];
        setAppointments(
          allAppts.filter(
            (app: any) =>
              app.clientId === clientId ||
              (currentClient && app.client?.name === currentClient.name)
          )
        );
      }

      if (resEstimates.ok) {
        const allEstimates = (await resEstimates.json()).data || [];
        setEstimates(
          allEstimates.filter(
            (est: any) =>
              est.clientId === clientId ||
              (currentClient && est.client?.name === currentClient.name)
          )
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clientId]);

  const handleRefreshRentCast = async () => {
    if (!client?.address) return;
    setIsRefreshingRentCast(true);
    showToast("Consultando dados atualizados na RentCast...", "info", 4000);

    try {
      const norm = AddressNormalizer.normalize(
        client.address,
        client.city,
        client.state,
        client.zipCode
      );
      const res = await fetch(`/api/v1/properties/lookup?address=${encodeURIComponent(norm.fullAddress)}`);
      const json = await res.json();

      if (json.error) {
        showToast(json.error, "warning", 5000);
        return;
      }

      if (json.success && json.found && json.data) {
        const prop = json.data;
        const patchRes = await fetch(`/api/v1/clients/${clientId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bedrooms: prop.bedrooms,
            bathrooms: prop.bathrooms,
            squareFeet: prop.squareFeet,
            propertyType: prop.propertyType,
          }),
        });

        if (patchRes.ok) {
          setClient((prev: any) => ({
            ...prev,
            bedrooms: prop.bedrooms,
            bathrooms: prop.bathrooms,
            squareFeet: prop.squareFeet,
            propertyType: prop.propertyType,
          }));
          showToast("✓ Dados do imóvel atualizados com sucesso!", "success", 4000);
        } else {
          showToast("Imóvel localizado, mas ocorreu um erro ao salvar.", "warning", 4000);
        }
      } else {
        showToast("Nenhum dado adicional encontrado na RentCast para este endereço.", "warning", 4000);
      }
    } catch (err) {
      console.error("Erro ao atualizar RentCast:", err);
      showToast("Erro de comunicação ao consultar RentCast.", "error", 4000);
    } finally {
      setIsRefreshingRentCast(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <Header title="Carregando cliente..." />
        <div className="p-12 text-center text-xs text-slate-400">Carregando ficha do cliente...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <Header title="Cliente não encontrado" />
        <div className="p-12 text-center space-y-4">
          <p className="text-xs text-slate-400">Este cliente não existe ou foi removido.</p>
          <Link
            href="/clients"
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold inline-block"
          >
            Voltar para Lista
          </Link>
        </div>
      </div>
    );
  }

  const isMonthly = client.billingType === "CONSOLIDATED_MONTHLY";

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title={client.name}
        subtitle={`Ficha do Cliente • ${
          isMonthly ? "Faturamento Mensal Consolidado" : "Cobrança por Faxina"
        }`}
      />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/clients"
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Lista de Clientes</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEstimateModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Novo Orçamento</span>
            </button>
            <Link
              href="/invoices/new"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Fatura</span>
            </Link>
          </div>
        </div>

        {/* Profile Card & GPS Routing */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 font-black text-lg flex items-center justify-center">
                {client.name ? client.name.charAt(0).toUpperCase() : "C"}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{client.name}</h2>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border mt-0.5 ${
                    isMonthly
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {isMonthly ? "Mensal Consolidado" : "Cobrança por Faxina"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-medium pt-1">
              {client.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-mono">{client.phone}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{client.email}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="font-mono text-slate-700 text-xs">
                  {AddressNormalizer.normalize(client.address, client.city, client.state, client.zipCode).fullAddress}
                </span>
              </div>
            </div>

            {client.notes && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700">
                <span className="font-bold text-slate-900 block mb-0.5">Notas de Acesso:</span>
                <p className="leading-relaxed">{client.notes}</p>
              </div>
            )}
          </div>

          {/* GPS Route Launchers */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            <a
              href={`https://maps.apple.com/?daddr=${encodeURIComponent(
                AddressNormalizer.normalize(client.address, client.city, client.state, client.zipCode).fullAddress
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold shadow-2xs flex items-center justify-center gap-2 border border-indigo-200 transition-colors"
            >
              <Navigation className="w-4 h-4" />
              <span>Rota no Apple Maps</span>
            </a>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                AddressNormalizer.normalize(client.address, client.city, client.state, client.zipCode).fullAddress
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center justify-center gap-2 transition-colors"
            >
              <Navigation className="w-4 h-4 text-emerald-600" />
              <span>Rota no Google Maps</span>
            </a>
          </div>
        </div>

        {/* Dimensões & Dados do Imóvel (RentCast) */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">Dimensões & Dados do Imóvel</h3>
            </div>
            <button
              onClick={handleRefreshRentCast}
              disabled={isRefreshingRentCast}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshingRentCast ? "animate-spin text-indigo-600" : ""}`}
              />
              <span>{isRefreshingRentCast ? "Consultando..." : "Consultar RentCast Agora"}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Bed className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Quartos</span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {client.bedrooms !== null && client.bedrooms !== undefined
                    ? `${client.bedrooms}`
                    : "-"}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Bath className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Banheiros</span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {client.bathrooms !== null && client.bathrooms !== undefined
                    ? `${client.bathrooms}`
                    : "-"}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Maximize2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Área Total</span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {client.squareFeet !== null && client.squareFeet !== undefined
                    ? `${client.squareFeet.toLocaleString()} sqft`
                    : "-"}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Home className="w-5 h-5" />
              </div>
              <div className="truncate">
                <span className="text-[11px] text-slate-500 font-medium block">Tipo</span>
                <span className="text-xs font-bold text-slate-900 truncate block">
                  {client.propertyType || "Não informado"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Faturas deste Cliente */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">Histórico de Faturas</h3>
            </div>
            <Link
              href="/invoices"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
            >
              <span>Ver todas</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {invoices.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Nenhuma fatura encontrada.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-indigo-600 font-bold text-xs">
                      {inv.invoiceNumber}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {new Date(inv.dueDate).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold font-mono text-slate-900 text-xs">
                      ${Number(inv.totalAmount).toFixed(2)}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
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
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Agendamentos deste Cliente */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">Histórico de Atendimentos</h3>
            </div>
            <Link
              href="/agenda"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
            >
              <span>Ver agenda</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {appointments.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Nenhum atendimento registrado.</p>
          ) : (
            <div className="space-y-2">
              {appointments.map((app) => (
                <Link
                  key={app.id}
                  href={`/agenda`}
                  className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-800">
                      {new Date(app.date).toLocaleDateString("pt-BR")}{" "}
                      {new Date(app.date).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-xs text-slate-500">
                      • {app.service?.name || "Serviço Padrão"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-700 text-xs font-medium">
                      ${Number(app.price || 0).toFixed(2)}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                        app.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : app.status === "CANCELLED"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-indigo-50 text-indigo-700 border-indigo-200"
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Orçamentos deste Cliente */}
        {estimates.length > 0 && (
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">Orçamentos Emitidos</h3>
              </div>
              <Link
                href="/estimates"
                className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
              >
                <span>Ver todos</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-2">
              {estimates.map((est) => (
                <Link
                  key={est.id}
                  href={`/estimates/${est.id}`}
                  className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-amber-700 font-bold text-xs">
                      {est.estimateNumber}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Validade: {new Date(est.validUntil).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold font-mono text-slate-900 text-xs">
                      ${Number(est.totalAmount).toFixed(2)}
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                      {est.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Estimate Modal */}
      <EstimateModal
        isOpen={isEstimateModalOpen}
        onClose={() => setIsEstimateModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
}
