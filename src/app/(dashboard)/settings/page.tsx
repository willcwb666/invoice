"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Header } from "@/components/dashboard/header";
import {
  Building2,
  MapPin,
  Calendar,
  Save,
  CheckCircle2,
  Plus,
  Upload,
  Image as ImageIcon,
  PenTool,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Smartphone,
  X,
  AlertCircle,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { SignatureDisplay } from "@/components/ui/signature-display";
import { motion, AnimatePresence } from "framer-motion";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"geral" | "endereco" | "sincronizacao">("geral");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Original profile & current edited profile
  const [initialData, setInitialData] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "Renata Matos de Oliveira",
    email: "renatamatoz@gmail.com",
    phone: "9704129406",
    monthlyRevenueGoal: 6000,
    paymentMethods:
      "Zelle: 9704129406\nVenmo: @RenataMatoz\nCheck payable to: Renata Matos de Oliveira",
    terms:
      "Payment is due within 7 days of invoice date. Late payments are subject to a 1.5% monthly finance charge.",
    signatureUrl: "/signatures/renata-signature.svg",
    logoUrl: "",
    icloudCalendarUrl: "",
    icloudSyncWindowDays: 60,
  });

  const [addresses, setAddresses] = useState<any[]>([]);

  // Modals & UI states
  const [isNewAddressModalOpen, setIsNewAddressModalOpen] = useState(false);
  const [copiedFeed, setCopiedFeed] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [calendarSyncInfo, setCalendarSyncInfo] = useState<{
    configured: boolean;
    syncedCount: number;
    lastSyncedAt: string | null;
  }>({
    configured: true,
    syncedCount: 0,
    lastSyncedAt: null,
  });
  // Webcal token comes only from the authenticated /api/v1/agenda/sync
  // response — never hardcoded, since it doubles as an unauthenticated
  // bypass secret for the outbound calendar feed.
  const [webcalToken, setWebcalToken] = useState<string | null>(null);

  // New address form
  const [newAddressForm, setNewAddressForm] = useState({
    label: "",
    street: "",
    city: "",
    state: "CO",
    zipCode: "",
    isDefault: false,
  });

  const fileInputLogoRef = useRef<HTMLInputElement>(null);
  const fileInputSigRef = useRef<HTMLInputElement>(null);

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch("/api/v1/agenda/sync");
      if (res.ok) {
        const data = await res.json();
        setCalendarSyncInfo({
          configured: Boolean(data.configured),
          syncedCount: data.syncedCount || 0,
          lastSyncedAt: data.lastSyncedAt || null,
        });
        setWebcalToken(data.webcalToken || null);
        if (data.configured) {
          setSyncStatus(`✓ Sincronizado (${data.syncedCount || 0} eventos importados do iPhone)`);
        }
      }
    } catch (e) {
      console.error("Erro ao consultar status da sincronização:", e);
    }
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/company");
      if (res.ok) {
        const json = await res.json();
        const comp = json.data;
        if (comp) {
          const loaded = {
            name: comp.name || "Renata Matos de Oliveira",
            email: comp.email || "renatamatoz@gmail.com",
            phone: comp.phone || "9704129406",
            monthlyRevenueGoal: Number(comp.monthlyRevenueGoal) || 6000,
            paymentMethods:
              comp.paymentMethods ||
              "Zelle: 9704129406\nVenmo: @RenataMatoz\nCheck payable to: Renata Matos de Oliveira",
            terms:
              comp.terms ||
              "Payment is due within 7 days of invoice date. Late payments are subject to a 1.5% monthly finance charge.",
            signatureUrl: comp.signatureUrl || "/signatures/renata-signature.svg",
            logoUrl: comp.logoUrl || "",
            icloudCalendarUrl: comp.icloudCalendarUrl || "",
            icloudSyncWindowDays: Number(comp.icloudSyncWindowDays) || 60,
          };
          setFormData(loaded);
          setInitialData(loaded);
          setAddresses(comp.addresses || []);
        }
      }
      await fetchSyncStatus();
    } catch (e) {
      console.error("Erro ao carregar dados da empresa:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Check if form has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!initialData) return false;
    return (
      formData.name !== initialData.name ||
      formData.email !== initialData.email ||
      formData.phone !== initialData.phone ||
      Number(formData.monthlyRevenueGoal) !== Number(initialData.monthlyRevenueGoal) ||
      formData.paymentMethods !== initialData.paymentMethods ||
      formData.terms !== initialData.terms ||
      formData.signatureUrl !== initialData.signatureUrl ||
      formData.logoUrl !== initialData.logoUrl ||
      formData.icloudCalendarUrl !== initialData.icloudCalendarUrl ||
      Number(formData.icloudSyncWindowDays) !== Number(initialData.icloudSyncWindowDays)
    );
  }, [formData, initialData]);

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const json = await res.json();
        setInitialData({ ...formData });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Erro ao salvar dados:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "signature"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (type === "logo") {
        setFormData((prev) => ({ ...prev, logoUrl: base64 }));
      } else {
        setFormData((prev) => ({ ...prev, signatureUrl: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/company/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAddressForm),
      });
      if (res.ok) {
        setIsNewAddressModalOpen(false);
        setNewAddressForm({
          label: "",
          street: "",
          city: "",
          state: "CO",
          zipCode: "",
          isDefault: false,
        });
        fetchProfile();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      const res = await fetch("/api/v1/company/address", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressId, isDefault: true }),
      });
      if (res.ok) {
        fetchProfile();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSyncCalendarNow = async () => {
    setSyncingCalendar(true);
    setSyncStatus(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
    try {
      const res = await fetch("/api/v1/agenda/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icloudUrl: formData.icloudCalendarUrl }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      let json: { message?: string; error?: string } = {};
      try {
        json = await res.json();
      } catch {
        // Response may not be JSON
      }
      if (res.ok) {
        setSyncStatus(`✓ Sincronização concluída! ${json.message || "Eventos atualizados."}`);
        fetchSyncStatus();
      } else {
        setSyncStatus(`Aviso: ${json.error || "Não foi possível sincronizar no momento. Código: " + res.status}`);
      }
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof DOMException && err.name === "AbortError") {
        setSyncStatus("Aviso: A sincronização demorou mais de 30 segundos. Tente novamente.");
      } else {
        const message = err instanceof Error ? err.message : "verifique a URL e tente novamente.";
        setSyncStatus(`Aviso: Erro de rede ao sincronizar — ${message}`);
      }
    } finally {
      setSyncingCalendar(false);
    }
  };

  const currentDefaultAddress = addresses.find((a) => a.isDefault);
  const historicalAddresses = addresses.filter((a) => !a.isDefault);

  const webcalUrl =
    webcalToken && typeof window !== "undefined"
      ? `webcal://${window.location.host}/api/v1/agenda/feed.ics?token=${webcalToken}`
      : null;

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Configurações da Empresa"
        subtitle="Endereços, assinatura digital, logo e sincronização com iPhone"
        onRefresh={fetchProfile}
        loading={loading}
        actionSlot={
          hasUnsavedChanges ? (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleSaveChanges}
              disabled={saving}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </motion.button>
          ) : saveSuccess ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Salvo!</span>
            </span>
          ) : null
        }
      />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs max-w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("geral")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "geral"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Geral</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("endereco")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "endereco"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Endereço</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sincronizacao")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "sincronizacao"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Sincronização Agendas</span>
          </button>
        </div>

        {/* TAB 1: GERAL */}
        {activeTab === "geral" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Informações da Empresa e Meta */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-6">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Dados da Empresa & Faturamento</h3>
                <p className="text-xs text-slate-500">
                  Edite os dados principais exibidos no cabeçalho das faturas e relatórios
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">
                    Nome Profissional / Razão Social
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">
                    Telefone de Contato / Zelle
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">
                    E-mail Comercial
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">
                    Meta Mensal de Faturamento ($)
                  </label>
                  <input
                    type="number"
                    value={formData.monthlyRevenueGoal}
                    onChange={(e) =>
                      setFormData({ ...formData, monthlyRevenueGoal: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 font-mono font-bold focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Formas de Pagamento & Termos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">
                    Formas de Pagamento (Texto nos Invoices)
                  </label>
                  <textarea
                    rows={4}
                    value={formData.paymentMethods}
                    onChange={(e) => setFormData({ ...formData, paymentMethods: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">
                    Termos & Condições da Fatura
                  </label>
                  <textarea
                    rows={4}
                    value={formData.terms}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Seção de Assinatura & Logo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assinatura Digital */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                      <PenTool className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Assinatura Digital</h4>
                      <p className="text-[11px] text-slate-500">
                        Assinatura real da esposa nos PDFs de exemplo
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 flex items-center justify-center min-h-[120px]">
                  <SignatureDisplay
                    signatureUrl={formData.signatureUrl}
                    className="h-16 max-w-[220px]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputSigRef}
                    type="file"
                    accept="image/*,.svg"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "signature")}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputSigRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Fazer Upload de Nova Assinatura</span>
                  </button>

                  {formData.signatureUrl !== "/signatures/renata-signature.svg" && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          signatureUrl: "/signatures/renata-signature.svg",
                        })
                      }
                      className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
                    >
                      Restaurar Padrão
                    </button>
                  )}
                </div>
              </div>

              {/* Logo da Empresa */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Logo da Empresa</h4>
                      <p className="text-[11px] text-slate-500">
                        Pronto para exibição nas faturas e estimativas
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 flex items-center justify-center min-h-[120px]">
                  {formData.logoUrl ? (
                    <img
                      src={formData.logoUrl}
                      alt="Logo da Empresa"
                      className="max-h-20 max-w-full object-contain rounded-lg shadow-2xs"
                    />
                  ) : (
                    <div className="text-center text-slate-400 text-xs">
                      <Building2 className="w-8 h-8 mx-auto mb-1 opacity-40 text-indigo-500" />
                      <span>Nenhum logo configurado ainda.</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputLogoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "logo")}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputLogoRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload de Logo</span>
                  </button>

                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logoUrl: "" })}
                      className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold border border-rose-200 transition-colors"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: ENDEREÇO */}
        {activeTab === "endereco" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Endereço Atual */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Endereço Atual Vigente</h3>
                    <p className="text-xs text-slate-500">
                      Este endereço é aplicado automaticamente em todas as novas faturas
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsNewAddressModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Endereço</span>
                </button>
              </div>

              {currentDefaultAddress ? (
                <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900 text-sm">
                        {currentDefaultAddress.label}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        Ativo / Padrão
                      </span>
                    </div>
                    <p className="font-mono text-xs text-slate-700">
                      {currentDefaultAddress.street} - {currentDefaultAddress.city},{" "}
                      {currentDefaultAddress.state} - {currentDefaultAddress.zipCode}
                    </p>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                  Nenhum endereço padrão definido.
                </div>
              )}
            </div>

            {/* Histórico de Endereços Antigos */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Histórico de Endereços Anteriores</h3>
                <p className="text-xs text-slate-500">
                  Endereços históricos preservados para faturas antigas já emitidas
                </p>
              </div>

              <div className="space-y-3">
                {historicalAddresses.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 bg-slate-50 rounded-xl text-center">
                    Nenhum endereço antigo no histórico.
                  </p>
                ) : (
                  historicalAddresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-900 text-xs">{addr.label}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-medium">
                            Histórico
                          </span>
                        </div>
                        <p className="font-mono text-xs text-slate-600">
                          {addr.street} - {addr.city}, {addr.state} - {addr.zipCode}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSetDefaultAddress(addr.id)}
                        className="py-1.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors"
                      >
                        Definir como Atual
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 3: SINCRONIZAÇÃO AGENDAS */}
        {activeTab === "sincronizacao" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Rotina de 2 Vias (Projeto <-> iPhone) */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Sincronização Bidirecional (2 Vias) com iPhone
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tudo criado no iPhone sincroniza com o projeto, e tudo criado no projeto sincroniza com o iPhone.
                  </p>
                </div>
              </div>

              {/* Via 1: Projeto -> iPhone (Feed WebCal) */}
              <div className="p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">
                    Via 1: Do Projeto para o iPhone (Inscrição no Calendário)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                    WebCal .ICS
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Adicione este link no iPhone para que todos os agendamentos cadastrados no sistema apareçam automaticamente no aplicativo Calendário do iPhone:
                </p>
                {webcalUrl ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webcalUrl}
                      className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-900 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(webcalUrl);
                        setCopiedFeed(true);
                        setTimeout(() => setCopiedFeed(false), 2000);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-colors"
                    >
                      {copiedFeed ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedFeed ? "Copiado!" : "Copiar Link"}</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                    ⚠️ A variável de ambiente <code className="font-mono">WEBCAL_SECRET</code> ainda não está configurada no servidor. Configure-a para gerar o link de assinatura do calendário.
                  </p>
                )}
                <div className="text-[11px] text-slate-500 bg-white/70 p-3 rounded-xl border border-indigo-100/80">
                  💡 <strong>No iPhone:</strong> Ajustes &gt; Calendário &gt; Contas &gt; Adicionar Conta &gt; Outra &gt; Adicionar Calendário Assinado &gt; Cole o link acima.
                </div>
              </div>

              {/* Via 2: iPhone -> Projeto (Link do Calendário do iPhone) */}
              <div className="p-5 rounded-2xl bg-emerald-50/40 border border-emerald-200/80 space-y-3.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">
                      Via 2: Do iPhone para o Projeto (Link Público do iPhone)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                      iCloud Public Feed
                    </span>
                  </div>

                  {formData.icloudCalendarUrl && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-200 animate-pulse" />
                      <span>Sincronizado</span>
                      {calendarSyncInfo.syncedCount > 0 && (
                        <span className="bg-emerald-700/80 px-1.5 py-0.2 rounded-md text-[10px]">
                          {calendarSyncInfo.syncedCount} eventos
                        </span>
                      )}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600">
                  Link público do calendário do iPhone da esposa. Os eventos, horários, clientes e endereços criados no celular são lidos e sincronizados com a tabela de atendimentos:
                </p>

                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="webcal://pXX-caldav.icloud.com/published/2/... ou link público do iCloud"
                      value={formData.icloudCalendarUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, icloudCalendarUrl: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 pr-28 rounded-xl bg-white border border-emerald-300 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      iPhone Ativo
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSyncCalendarNow}
                      disabled={syncingCalendar}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingCalendar ? "animate-spin" : ""}`} />
                      <span>{syncingCalendar ? "Sincronizando..." : "Sincronizar Agora"}</span>
                    </button>

                    {syncStatus && (
                      <span className="text-xs font-semibold text-emerald-800 bg-emerald-100/70 px-3 py-1.5 rounded-xl border border-emerald-200">
                        {syncStatus}
                      </span>
                    )}

                    {calendarSyncInfo.lastSyncedAt && !syncStatus && (
                      <span className="text-[11px] text-slate-500">
                        Última sincronização: {new Date(calendarSyncInfo.lastSyncedAt).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Janela de Sincronização (dias a partir de hoje)
                  </label>
                  <div className="flex items-center gap-2 max-w-xs">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      step={1}
                      value={formData.icloudSyncWindowDays}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          icloudSyncWindowDays: Number(e.target.value) || 60,
                        })
                      }
                      className="w-24 px-3 py-2 rounded-xl bg-white border border-emerald-300 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                    <span className="text-xs text-slate-500">dias (padrão: 60, ~2 meses)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    A agenda nunca é editada em dias já passados, então o sync só olha de hoje até essa quantidade de dias à frente — deixa cada sincronização bem mais rápida.
                  </p>
                </div>

                <div className="text-[11px] text-slate-500 bg-white/80 p-3 rounded-xl border border-emerald-100/90 space-y-1">
                  <p>
                    📱 <strong>Link configurado do iPhone:</strong>
                  </p>
                  <p className="text-[10px] text-slate-600 font-mono truncate">
                    {formData.icloudCalendarUrl}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium">
                    ✓ Calendário público conectado com sucesso. Novos compromissos salvos no iPhone são importados automaticamente com rotas GPS para os atendimentos.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Modal: Novo Endereço */}
      <AnimatePresence>
        {isNewAddressModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Cadastrar Novo Endereço</h3>
                    <p className="text-xs text-slate-500">
                      Caso mude de endereço ou abra uma nova filial
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewAddressModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateAddress} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Identificação (Ex: Loveland Nova Sede)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Loveland (Nova Residência)"
                    value={newAddressForm.label}
                    onChange={(e) =>
                      setNewAddressForm({ ...newAddressForm, label: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Logradouro / Rua e Número
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 5652 McWhinney Blvd"
                    value={newAddressForm.street}
                    onChange={(e) =>
                      setNewAddressForm({ ...newAddressForm, street: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Cidade</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Loveland"
                      value={newAddressForm.city}
                      onChange={(e) =>
                        setNewAddressForm({ ...newAddressForm, city: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Estado</label>
                    <input
                      type="text"
                      required
                      placeholder="CO"
                      value={newAddressForm.state}
                      onChange={(e) =>
                        setNewAddressForm({ ...newAddressForm, state: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">CEP (Zip)</label>
                    <input
                      type="text"
                      required
                      placeholder="80538"
                      value={newAddressForm.zipCode}
                      onChange={(e) =>
                        setNewAddressForm({ ...newAddressForm, zipCode: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAddressForm.isDefault}
                    onChange={(e) =>
                      setNewAddressForm({ ...newAddressForm, isDefault: e.target.checked })
                    }
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                  <span className="font-semibold text-slate-800">
                    Definir este endereço como o novo padrão para faturas
                  </span>
                </label>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewAddressModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/20 transition-all"
                  >
                    Salvar Endereço
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
