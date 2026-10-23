"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { ModalShell } from "@/components/ui/modal-shell";
import { useToast } from "@/components/ui/toast";
import {
  Award,
  Plus,
  Edit3,
  Trash2,
  Percent,
  DollarSign,
  Phone,
  Mail,
  Check,
  Sparkles,
  Users,
  ShieldCheck,
  ArrowRight,
  Loader2,
  CalendarClock,
  History,
} from "lucide-react";
import type {
  CleaningCommissionCategory,
  CommissionApplyMode,
  CommissionMode,
  ProfessionalRecord,
} from "@/services/professional-service";

const CLEANING_TYPES: {
  key: CleaningCommissionCategory;
  label: string;
  desc: string;
}[] = [
  {
    key: "STANDARD",
    label: "Standard Cleaning (Regular)",
    desc: "Limpeza de manutenção recorrente (Semanal, Quinzenal, Mensal)",
  },
  {
    key: "DEEP",
    label: "Deep Cleaning (Pesada)",
    desc: "Limpeza detalhada / primeira limpeza profunda",
  },
  {
    key: "MOVE_IN_OUT",
    label: "Move-In / Move-Out",
    desc: "Limpeza de mudança com imóvel vazio / entrega",
  },
  {
    key: "CUSTOM",
    label: "Limpeza Parcial / Outros",
    desc: "Serviços avulsos, porão, janelas ou escopo personalizado",
  },
];

const COLOR_OPTIONS = [
  { value: "indigo", label: "Índigo (Azul)", bg: "bg-indigo-600", light: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "rose", label: "Rosa (Rose)", bg: "bg-rose-500", light: "bg-rose-50 text-rose-700 border-rose-200" },
  { value: "emerald", label: "Esmeralda (Verde)", bg: "bg-emerald-600", light: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "amber", label: "Âmbar (Dourado)", bg: "bg-amber-500", light: "bg-amber-50 text-amber-800 border-amber-200" },
  { value: "violet", label: "Violeta (Roxo)", bg: "bg-violet-600", light: "bg-violet-50 text-violet-700 border-violet-200" },
];

function getTomorrowIsoDate(): string {
  const d = new Date(Date.now() + 86400000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatEffectiveDatePt(ymd: string): string {
  if (!ymd || ymd <= "2000-01-01") return "Histórico Base (Desde o início)";
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `A partir de ${d}/${m}/${y}`;
}

export default function ProfessionalsPage() {
  const { showToast } = useToast();
  const [professionals, setProfessionals] = useState<ProfessionalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState("Profissional de Limpeza");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState("indigo");
  const [active, setActive] = useState(true);
  const [applyMode, setApplyMode] = useState<CommissionApplyMode>("FROM_TOMORROW");
  const [effectiveFrom, setEffectiveFrom] = useState<string>(getTomorrowIsoDate);
  const [commissions, setCommissions] = useState<
    Record<CleaningCommissionCategory, { mode: CommissionMode; value: number }>
  >({
    STANDARD: { mode: "PERCENTAGE", value: 50 },
    DEEP: { mode: "PERCENTAGE", value: 50 },
    MOVE_IN_OUT: { mode: "PERCENTAGE", value: 50 },
    CUSTOM: { mode: "PERCENTAGE", value: 50 },
  });

  const fetchProfessionals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/professionals", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setProfessionals(json.data || []);
      }
    } catch (e) {
      console.error("Erro ao carregar profissionais:", e);
      showToast("Erro ao carregar profissionais.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfessionals();
  }, []);

  const openNewModal = () => {
    setEditingId(null);
    setName("");
    setRole("Profissional de Limpeza");
    setPhone("");
    setEmail("");
    setColor("emerald");
    setActive(true);
    setApplyMode("RETROACTIVE");
    setEffectiveFrom(getTomorrowIsoDate());
    setCommissions({
      STANDARD: { mode: "PERCENTAGE", value: 30 },
      DEEP: { mode: "PERCENTAGE", value: 35 },
      MOVE_IN_OUT: { mode: "FIXED", value: 80 },
      CUSTOM: { mode: "PERCENTAGE", value: 30 },
    });
    setIsModalOpen(true);
  };

  const openEditModal = (prof: ProfessionalRecord) => {
    setEditingId(prof.id);
    setName(prof.name);
    setRole(prof.role);
    setPhone(prof.phone || "");
    setEmail(prof.email || "");
    setColor(prof.color || "indigo");
    setActive(prof.active !== false);
    setApplyMode("FROM_TOMORROW");
    setEffectiveFrom(getTomorrowIsoDate());
    setCommissions({
      STANDARD: prof.commissions?.STANDARD || { mode: "PERCENTAGE", value: 50 },
      DEEP: prof.commissions?.DEEP || { mode: "PERCENTAGE", value: 50 },
      MOVE_IN_OUT: prof.commissions?.MOVE_IN_OUT || { mode: "PERCENTAGE", value: 50 },
      CUSTOM: prof.commissions?.CUSTOM || { mode: "PERCENTAGE", value: 50 },
    });
    setIsModalOpen(true);
  };

  const handleRuleChange = (
    cat: CleaningCommissionCategory,
    field: "mode" | "value",
    val: CommissionMode | number
  ) => {
    setCommissions((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        [field]: val,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/v1/professionals", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId || undefined,
          name: name.trim(),
          role: role.trim(),
          phone: phone.trim(),
          email: email.trim(),
          color,
          active,
          commissions,
          applyMode: editingId ? applyMode : "RETROACTIVE",
          effectiveFrom:
            applyMode === "CUSTOM_DATE" ? effectiveFrom : undefined,
        }),
      });

      if (res.ok) {
        showToast(
          editingId
            ? applyMode === "RETROACTIVE"
              ? "Comissões atualizadas retroativamente em todo o histórico!"
              : "Nova vigência de comissão salva! Comissões anteriores foram preservadas."
            : "Profissional cadastrado com sucesso!",
          "success"
        );
        setIsModalOpen(false);
        fetchProfessionals();
      } else {
        const j = await res.json();
        showToast(j.error?.message || "Erro ao salvar profissional.", "error");
      }
    } catch {
      showToast("Falha de conexão ao salvar profissional.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (prof: ProfessionalRecord) => {
    if (prof.id === "prof-willians" || prof.id === "prof-renata") {
      showToast("Os titulares Willians e Renata não podem ser excluídos.", "error");
      return;
    }
    if (!window.confirm(`Deseja realmente remover o profissional ${prof.name}?`)) return;

    try {
      const res = await fetch(`/api/v1/professionals?id=${encodeURIComponent(prof.id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("Profissional removido.", "success");
        fetchProfessionals();
      }
    } catch {
      showToast("Erro ao remover profissional.", "error");
    }
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Gestão de Profissionais & Regras de Comissão"
        subtitle="Cadastro da equipe operacional (Willians, Renata e colaboradores) e parametrização de comissão com preservação de histórico"
        onRefresh={fetchProfessionals}
        loading={loading}
        actionSlot={
          <div className="flex items-center gap-2">
            <Link
              href="/commissions"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs transition-all"
            >
              <Percent className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ver Relatório de Comissões</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <button
              onClick={openNewModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Profissional</span>
            </button>
          </div>
        }
      />

      <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Info Banner */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200/80 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-sm">
                  Escala Automática com o iPhone & Histórico de Vigência Ativos
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Willians & Renata vinculados automaticamente</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Quando você altera a comissão de um profissional (ex: de <strong>30% até hoje</strong>{" "}
                para <strong>50% a partir de amanhã</strong>), o sistema preserva automaticamente os
                30% nos trabalhos passados e aplica 50% apenas da data escolhida em diante.
              </p>
            </div>
          </div>
        </div>

        {/* Professionals Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {professionals.map((prof) => {
            const colorInfo =
              COLOR_OPTIONS.find((c) => c.value === prof.color) || COLOR_OPTIONS[0];
            const isOwner = prof.id === "prof-willians" || prof.id === "prof-renata";
            const historyList = prof.commissionHistory || [];

            return (
              <div
                key={prof.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between gap-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-12 h-12 rounded-2xl ${colorInfo.bg} text-white flex items-center justify-center font-black text-lg shadow-sm`}
                      >
                        {prof.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-base text-slate-900">{prof.name}</h3>
                          {isOwner && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Titular
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              prof.active
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                          >
                            {prof.active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">{prof.role}</p>
                        {(prof.phone || prof.email) && (
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                            {prof.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {prof.phone}
                              </span>
                            )}
                            {prof.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                {prof.email}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(prof)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar & Comissões</span>
                      </button>
                      {!isOwner && (
                        <button
                          onClick={() => handleDelete(prof)}
                          className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
                          title="Excluir profissional"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Commission Rules Table per Cleaning Type */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Tabela Vigente de Comissões por Modalidade</span>
                      </span>
                      {historyList.length > 1 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <History className="w-3 h-3" />
                          <span>{historyList.length} faixas de vigência salvas</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {CLEANING_TYPES.map((ct) => {
                        const rule = prof.commissions?.[ct.key] || {
                          mode: "PERCENTAGE",
                          value: 0,
                        };
                        return (
                          <div
                            key={ct.key}
                            className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 block truncate">
                                {ct.label}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {rule.mode === "PERCENTAGE"
                                  ? "Porcentagem sobre o trabalho"
                                  : "Valor fixo por limpeza"}
                              </span>
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-xl text-xs font-black shrink-0 border ${
                                rule.mode === "PERCENTAGE"
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}
                            >
                              {rule.mode === "PERCENTAGE"
                                ? `${rule.value}%`
                                : `$${Number(rule.value).toFixed(2)}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Timeline of effective dates if > 1 */}
                    {historyList.length > 1 && (
                      <div className="mt-3 p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                          <History className="w-3 h-3" />
                          <span>Histórico de Vigência Registrado (Preservação de Comissões)</span>
                        </span>
                        <div className="space-y-1">
                          {historyList.map((h) => (
                            <div
                              key={h.id}
                              className="flex items-center justify-between text-[11px] text-slate-700 bg-white/80 px-2.5 py-1 rounded-lg border border-indigo-100/80"
                            >
                              <span className="font-bold text-slate-800">
                                {formatEffectiveDatePt(h.effectiveFrom)}
                              </span>
                              <span className="text-slate-600 font-semibold">
                                Std:{" "}
                                {h.commissions?.STANDARD?.mode === "PERCENTAGE"
                                  ? `${h.commissions?.STANDARD?.value}%`
                                  : `$${h.commissions?.STANDARD?.value}`}{" "}
                                • Deep:{" "}
                                {h.commissions?.DEEP?.mode === "PERCENTAGE"
                                  ? `${h.commissions?.DEEP?.value}%`
                                  : `$${h.commissions?.DEEP?.value}`}{" "}
                                • Move:{" "}
                                {h.commissions?.MOVE_IN_OUT?.mode === "PERCENTAGE"
                                  ? `${h.commissions?.MOVE_IN_OUT?.value}%`
                                  : `$${h.commissions?.MOVE_IN_OUT?.value}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Criar / Editar Profissional + Regras de Comissão */}
      <ModalShell
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        icon={<Award className="w-5 h-5" />}
        title={editingId ? "Editar Profissional & Comissões" : "Cadastrar Novo Profissional"}
        subtitle="Defina os dados do profissional e configure se cada limpeza paga Porcentagem (%) ou Valor Fixo ($)"
        backdropClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        panelClassName="w-full max-w-2xl sm:max-w-3xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col"
        iconWrapperClassName="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600"
        closeButtonClassName="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto pt-4 space-y-5 pr-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Nome do Profissional *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Willians, Renata, Maria..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">Função / Cargo</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ex: Proprietário & Profissional"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">Telefone (Opcional)</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(970) 000-0000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Cor de Identificação na Agenda
              </label>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {COLOR_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vigência da Alteração de Comissão (Preservação de Histórico) */}
          {editingId && (
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-3">
              <div>
                <h4 className="font-black text-indigo-950 text-xs flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-indigo-600" />
                  <span>Vigência da Alteração de Comissão (Preservar Comissões Anteriores)</span>
                </h4>
                <p className="text-[11px] text-indigo-900/80 mt-0.5">
                  Se o funcionário recebia 30% até hoje e passará a receber 50% a partir de amanhã,
                  escolha abaixo como aplicar a mudança:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setApplyMode("FROM_TOMORROW")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    applyMode === "FROM_TOMORROW"
                      ? "bg-white border-indigo-600 ring-2 ring-indigo-600/15 shadow-2xs"
                      : "bg-white/70 border-slate-200 hover:bg-white"
                  }`}
                >
                  <span className="font-black text-slate-900 block text-xs">
                    A partir de amanhã (Recomendado)
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Preserva as comissões de todos os trabalhos realizados até hoje.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setApplyMode("FROM_TODAY")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    applyMode === "FROM_TODAY"
                      ? "bg-white border-indigo-600 ring-2 ring-indigo-600/15 shadow-2xs"
                      : "bg-white/70 border-slate-200 hover:bg-white"
                  }`}
                >
                  <span className="font-black text-slate-900 block text-xs">
                    A partir de hoje
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Preserva comissões até ontem e aplica a nova regra de hoje em diante.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setApplyMode("CUSTOM_DATE")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    applyMode === "CUSTOM_DATE"
                      ? "bg-white border-indigo-600 ring-2 ring-indigo-600/15 shadow-2xs"
                      : "bg-white/70 border-slate-200 hover:bg-white"
                  }`}
                >
                  <span className="font-black text-slate-900 block text-xs">
                    Escolher data de início...
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Define o dia exato em que a nova comissão passa a valer.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setApplyMode("RETROACTIVE")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    applyMode === "RETROACTIVE"
                      ? "bg-amber-50 border-amber-500 ring-2 ring-amber-500/15 shadow-2xs"
                      : "bg-white/70 border-slate-200 hover:bg-white"
                  }`}
                >
                  <span className="font-black text-amber-950 block text-xs">
                    Retroativo em tudo (Modo Teste)
                  </span>
                  <span className="text-[10px] text-amber-800/80 block mt-0.5">
                    Recalcula todos os trabalhos passados e futuros com a nova regra.
                  </span>
                </button>
              </div>

              {applyMode === "CUSTOM_DATE" && (
                <div className="pt-1 flex items-center gap-3">
                  <label className="font-bold text-indigo-950 text-xs">
                    Nova comissão válida a partir de:
                  </label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-indigo-300 text-slate-900 font-bold text-xs focus:outline-none focus:border-indigo-600"
                  />
                </div>
              )}
            </div>
          )}

          {/* Regras de Comissão por Tipo de Limpeza */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3.5">
            <div>
              <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-indigo-600" />
                <span>Parametrização de Comissões por Tipo de Limpeza</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Cada modalidade de limpeza pode ter comissão em{" "}
                <strong>Porcentagem (%)</strong> ou <strong>Valor Fixo ($ USD)</strong>.
              </p>
            </div>

            <div className="space-y-2.5">
              {CLEANING_TYPES.map((ct) => {
                const rule = commissions[ct.key] || { mode: "PERCENTAGE", value: 0 };
                return (
                  <div
                    key={ct.key}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">{ct.label}</span>
                      <span className="text-[10px] text-slate-400">{ct.desc}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Toggle Mode: % vs $ Fixo */}
                      <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleRuleChange(ct.key, "mode", "PERCENTAGE")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            rule.mode === "PERCENTAGE"
                              ? "bg-indigo-600 text-white shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <Percent className="w-3 h-3" />
                          <span>%</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRuleChange(ct.key, "mode", "FIXED")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            rule.mode === "FIXED"
                              ? "bg-emerald-600 text-white shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <DollarSign className="w-3 h-3" />
                          <span>Fixo ($)</span>
                        </button>
                      </div>

                      {/* Numeric Value */}
                      <div className="relative w-28">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={rule.value}
                          onChange={(e) =>
                            handleRuleChange(ct.key, "value", Number(e.target.value))
                          }
                          className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-black text-right pr-7 focus:bg-white focus:outline-none focus:border-indigo-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                          {rule.mode === "PERCENTAGE" ? "%" : "$"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvar Profissional & Comissões</span>
                </>
              )}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
