"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/dashboard/header";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { ROLE_DEFINITIONS, Role } from "@/lib/security/rbac";
import { Tooltip } from "@/components/ui/tooltip";
import { StatusDot } from "@/components/ui/status-dot";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Building2,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  LogOut,
  Loader2,
  Lock,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const { user, refresh } = useCurrentUser();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"FEMALE" | "MALE">("FEMALE");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
      if (user.gender === "MALE" || user.gender === "FEMALE") {
        setGender(user.gender);
      }
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/v1/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, gender }),
      });

      const json = await res.json();
      if (res.ok) {
        setSaveSuccess(true);
        refresh();
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setErrorMessage(json.error || "Não foi possível salvar os dados.");
      }
    } catch {
      setErrorMessage("Erro de rede ao salvar alterações.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Continue
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const roleDef = user ? ROLE_DEFINITIONS[user.role as Role] : null;
  const displayName = user?.name || "Funcionário";
  const displayEmail = user?.email || "";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Outubro de 2026";

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Perfil do Funcionário"
        subtitle="Dados cadastrais, cargo, credenciais e permissões de acesso"
      />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Card Principal: Banner do Perfil */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-xs relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-md shadow-indigo-200 select-none shrink-0">
                {initials}
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {displayName}
                  </h1>

                  {/* Bolinha de Status com Tooltip */}
                  <StatusDot color="emerald" tooltip="Status: Ativo e Verificado" />

                  {roleDef && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleDef.badgeColor}`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{roleDef.name}</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 flex items-center gap-1.5 font-mono">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{displayEmail}</span>
                </p>

                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Empresa:{" "}
                    <strong className="text-slate-700">
                      {user?.company?.name || "Renata Matos de Oliveira"}
                    </strong>
                  </span>
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100 flex flex-col sm:items-end justify-center">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                Membro Desde
              </span>
              <span className="text-xs font-semibold text-slate-700 mt-0.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{memberSince}</span>
              </span>
            </div>
          </div>
        </motion.div>

        {/* Duas Colunas: Formulário de Dados & Informações de Acesso */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Esquerda: Edição de Dados Cadastrais */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-6"
          >
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900">Dados do Funcionário</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Atualize suas informações pessoais de contato utilizadas nos relatórios operacionais.
              </p>
            </div>

            {saveSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Dados atualizados com sucesso!</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nome Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    placeholder="Seu nome completo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  E-mail de Acesso (Google OAuth / SSO)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    disabled
                    value={displayEmail}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-mono cursor-not-allowed select-none"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  O e-mail é vinculado à sua conta do Google e não pode ser alterado diretamente.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Telefone / WhatsApp de Contato
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono"
                    placeholder="Ex: (970) 412-9406"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Sexo / Gênero (Avatar do Painel)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Define qual ilustração (masculina ou feminina) será exibida na saudação do painel de controle.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGender("FEMALE")}
                    className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      gender === "FEMALE"
                        ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-xs ring-1 ring-indigo-500"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100/70"
                    }`}
                  >
                    <span className="text-base">👩</span>
                    <span>Feminino (Avatar Mulher)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGender("MALE")}
                    className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      gender === "MALE"
                        ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-xs ring-1 ring-indigo-500"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100/70"
                    }`}
                  >
                    <span className="text-base">👨</span>
                    <span>Masculino (Avatar Homem)</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{saving ? "Salvando..." : "Salvar Alterações"}</span>
                </button>
              </div>
            </form>
          </motion.div>

          {/* Coluna Direita: Escopo do Cargo & Segurança */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-6"
          >
            {/* Cargo e Permissões */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Cargo & Acessos RBAC</h3>
              </div>

              <div className="space-y-2">
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-800">
                    Escopo Autorizado
                  </span>
                  <p className="text-xs font-bold text-indigo-950">
                    {roleDef?.name || "Administrador"}
                  </p>
                  <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                    {roleDef?.description || "Acesso aos recursos administrativos do sistema."}
                  </p>
                </div>

                <div className="text-[11px] text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
                  <p className="font-semibold text-slate-800">Áreas de Atuação:</p>
                  <p className="text-slate-600 leading-relaxed">
                    {roleDef?.scope || "Gestão Total, Configurações, Usuários & Aprovações"}
                  </p>
                </div>
              </div>
            </div>

            {/* Segurança & Sessão */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <KeyRound className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Segurança da Sessão</h3>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Você está conectado com proteção de sessão ativa e autenticação RBAC verificada.
              </p>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100/70 text-rose-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {loggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                <span>{loggingOut ? "Encerrando sessão..." : "Encerrar Sessão"}</span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
