"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { AddressNormalizer } from "@/lib/address-normalizer";
import { SmartNavigationButton } from "@/components/ui/smart-navigation-button";
import {
  Users,
  ArrowLeft,
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
  Save,
  RotateCcw,
  Loader2,
  Building,
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

  // Form de edição dos dados cadastrais do cliente
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    billingType: "PER_JOB" as "PER_JOB" | "CONSOLIDATED_MONTHLY",
    notes: "",
    bedrooms: "" as number | "",
    bathrooms: "" as number | "",
    squareFeet: "" as number | "",
    propertyType: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

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

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || "",
        phone: client.phone || "",
        email: client.email || "",
        address: client.address || "",
        city: client.city || "Greeley",
        state: client.state || "CO",
        zipCode: client.zipCode || "",
        billingType: client.billingType || "PER_JOB",
        notes: client.notes || "",
        bedrooms: client.bedrooms ?? "",
        bathrooms: client.bathrooms ?? "",
        squareFeet: client.squareFeet ?? "",
        propertyType: client.propertyType || "",
      });
      setIsDirty(false);
    }
  }, [client]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSaveClient = async () => {
    if (!formData.name.trim()) {
      showToast("O nome do cliente é obrigatório.", "warning", 4000);
      return;
    }
    if (!formData.address.trim()) {
      showToast("O endereço do cliente é obrigatório.", "warning", 4000);
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim(),
        city: formData.city.trim() || "Greeley",
        state: formData.state.trim().toUpperCase() || "CO",
        zipCode: formData.zipCode.trim() || null,
        billingType: formData.billingType,
        notes: formData.notes.trim() || null,
        bedrooms: formData.bedrooms === "" ? null : Number(formData.bedrooms),
        bathrooms: formData.bathrooms === "" ? null : Number(formData.bathrooms),
        squareFeet: formData.squareFeet === "" ? null : Number(formData.squareFeet),
        propertyType: formData.propertyType.trim() || null,
      };

      const res = await fetch(`/api/v1/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Erro ao salvar alterações do cliente.", "error", 4000);
        return;
      }

      const updated = json.data || { ...client, ...payload };
      setClient(updated);
      setIsDirty(false);
      showToast("✓ Cadastro do cliente atualizado com sucesso!", "success", 4000);
    } catch (err) {
      console.error("Erro ao salvar cadastro:", err);
      showToast("Erro de comunicação ao salvar.", "error", 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (client) {
      setFormData({
        name: client.name || "",
        phone: client.phone || "",
        email: client.email || "",
        address: client.address || "",
        city: client.city || "Greeley",
        state: client.state || "CO",
        zipCode: client.zipCode || "",
        billingType: client.billingType || "PER_JOB",
        notes: client.notes || "",
        bedrooms: client.bedrooms ?? "",
        bathrooms: client.bathrooms ?? "",
        squareFeet: client.squareFeet ?? "",
        propertyType: client.propertyType || "",
      });
      setIsDirty(false);
      showToast("Alterações descartadas.", "info", 3000);
    }
  };

  const handleRefreshRentCast = async () => {
    const addressToQuery = formData.address || client?.address;
    if (!addressToQuery) return;
    setIsRefreshingRentCast(true);
    showToast("Consultando dados atualizados na RentCast...", "info", 4000);

    try {
      const norm = AddressNormalizer.normalize(
        addressToQuery,
        formData.city || client.city,
        formData.state || client.state,
        formData.zipCode || client.zipCode
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
          setFormData((prev: any) => ({
            ...prev,
            bedrooms: prop.bedrooms ?? "",
            bathrooms: prop.bathrooms ?? "",
            squareFeet: prop.squareFeet ?? "",
            propertyType: prop.propertyType ?? "",
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            href="/clients"
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Lista de Clientes</span>
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Navegação GPS Unificada */}
            {(formData.address || client.address) && (
              <SmartNavigationButton
                address={formData.address || client.address}
                city={formData.city || client.city}
                state={formData.state || client.state}
                variant="full"
              />
            )}

            <button
              onClick={() => setIsEstimateModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Novo Orçamento</span>
            </button>
            <Link
              href="/invoices/new"
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Fatura</span>
            </Link>
          </div>
        </div>

        {/* Card de Cadastro Editável do Cliente */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 font-black text-lg flex items-center justify-center shrink-0">
                {formData.name ? formData.name.charAt(0).toUpperCase() : "C"}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900">
                    {formData.name || "Novo Cliente"}
                  </h2>
                  {isDirty && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                      Alterações não salvas
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Editar cadastro, contatos, endereço e modelo de cobrança
                </p>
              </div>
            </div>

            {/* Ações de Salvar e Cancelar */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={!isDirty || isSaving}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>

              <button
                type="button"
                onClick={handleSaveClient}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Grid de Campos Editáveis */}
          <div className="space-y-4">
            {/* Linha 1: Nome, Telefone, Email */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="Nome do cliente"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 text-xs font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  Telefone
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange("phone", e.target.value)}
                    placeholder="(970) 555-0199"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 text-xs font-mono font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 text-xs font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Linha 2: Endereço, Cidade, Estado, CEP */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  Endereço Residencial (GPS) *
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleFieldChange("address", e.target.value)}
                    placeholder="3068 Aries Drive"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 text-xs font-mono font-medium"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  Cidade
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleFieldChange("city", e.target.value)}
                  placeholder="Loveland"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 text-xs font-medium"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  UF
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={formData.state}
                  onChange={(e) => handleFieldChange("state", e.target.value.toUpperCase())}
                  placeholder="CO"
                  className="w-full px-2 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 text-xs text-center font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  CEP / Zip
                </label>
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => handleFieldChange("zipCode", e.target.value)}
                  placeholder="80538"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 text-xs font-mono font-medium"
                />
              </div>
            </div>

            {/* Linha 3: Modelo de Faturamento & Notas de Acesso */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  Modelo de Cobrança / Faturamento
                </label>
                <select
                  value={formData.billingType}
                  onChange={(e) => handleFieldChange("billingType", e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:outline-none focus:border-indigo-500 text-xs cursor-pointer"
                >
                  <option value="PER_JOB">Cobrança por Faxina / Trabalho</option>
                  <option value="CONSOLIDATED_MONTHLY">Faturamento Mensal Consolidado</option>
                </select>
              </div>

              <div className="sm:col-span-8">
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  Notas de Acesso / Instruções Internas (Portão, Pet, etc.)
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => handleFieldChange("notes", e.target.value)}
                  placeholder="Código do portão, animais de estimação, alarmes, detalhes específicos..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 text-xs font-medium"
                />
              </div>
            </div>
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
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-slate-500 font-medium block">Quartos</span>
                <input
                  type="number"
                  min="0"
                  value={formData.bedrooms}
                  onChange={(e) => handleFieldChange("bedrooms", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Ex: 3"
                  className="w-full font-bold text-sm text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 focus:outline-none font-mono py-0.5"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Bath className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-slate-500 font-medium block">Banheiros</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.bathrooms}
                  onChange={(e) => handleFieldChange("bathrooms", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Ex: 2.5"
                  className="w-full font-bold text-sm text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 focus:outline-none font-mono py-0.5"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Maximize2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-slate-500 font-medium block">Área (sqft)</span>
                <input
                  type="number"
                  min="0"
                  value={formData.squareFeet}
                  onChange={(e) => handleFieldChange("squareFeet", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Ex: 2400"
                  className="w-full font-bold text-sm text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 focus:outline-none font-mono py-0.5"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Building className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-slate-500 font-medium block">Tipo</span>
                <input
                  type="text"
                  value={formData.propertyType}
                  onChange={(e) => handleFieldChange("propertyType", e.target.value)}
                  placeholder="Single Family"
                  className="w-full font-bold text-xs text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 focus:outline-none py-0.5"
                />
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
