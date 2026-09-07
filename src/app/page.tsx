"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  FileText,
  Users,
  DollarSign,
  Plus,
  ArrowUpRight,
  Lock,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Database,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  createdAt: string;
  _count?: { invoices: number };
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: "DRAFT" | "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
  totalAmount: string | number;
  dueDate: string;
  client: { name: string; email: string | null };
  items: InvoiceItem[];
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"invoices" | "clients" | "security" | "mobile">("invoices");
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);

  // Form states
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientDoc, setNewClientDoc] = useState("");
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Invoice Form states
  const [selectedClientId, setSelectedClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-4)}`);
  const [invoiceItemDesc, setInvoiceItemDesc] = useState("Desenvolvimento de Software / Consultoria");
  const [invoiceItemQty, setInvoiceItemQty] = useState(1);
  const [invoiceItemPrice, setInvoiceItemPrice] = useState(1500);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resClients, resInvoices] = await Promise.all([
        fetch("/api/v1/clients"),
        fetch("/api/v1/invoices"),
      ]);

      if (resClients.ok) {
        const json = await resClients.json();
        setClients(json.data || []);
      }
      if (resInvoices.ok) {
        const json = await resInvoices.json();
        setInvoices(json.data || []);
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSubmitting(true);

    try {
      const res = await fetch("/api/v1/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClientName,
          email: newClientEmail || undefined,
          document: newClientDoc || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha na validação dos dados.");
      }

      setShowNewClientModal(false);
      setNewClientName("");
      setNewClientEmail("");
      setNewClientDoc("");
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSubmitting(true);

    if (!selectedClientId) {
      setFormError("Por favor, selecione um cliente cadastrado.");
      setFormSubmitting(false);
      return;
    }

    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 15);

      const res = await fetch("/api/v1/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          invoiceNumber,
          dueDate: dueDate.toISOString(),
          status: "PENDING",
          items: [
            {
              description: invoiceItemDesc,
              quantity: Number(invoiceItemQty),
              unitPrice: Number(invoiceItemPrice),
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao criar fatura.");
      }

      setShowNewInvoiceModal(false);
      setInvoiceNumber(`INV-${Date.now().toString().slice(-4)}`);
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Calcular métricas
  const totalPaid = invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((acc, inv) => acc + Number(inv.totalAmount), 0);

  const totalPending = invoices
    .filter((inv) => inv.status === "PENDING")
    .reduce((acc, inv) => acc + Number(inv.totalAmount), 0);

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-20">
      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-40 bg-[#090D16]/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-[#090D16] rounded-[10px] flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white tracking-tight">Invoice System</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Supabase Live
                </span>
              </div>
              <p className="text-xs text-slate-400">Next.js 16 • Prisma 7 • Vercel Ready</p>
            </div>
          </motion.div>

          {/* Quick Security Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="hidden md:flex items-center gap-4 text-xs"
          >
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>SQL Injection Protected</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zod & Rate Limit Active</span>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {[
            {
              title: "Total Recebido",
              value: `R$ ${totalPaid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
              icon: DollarSign,
              color: "text-emerald-400",
              bgColor: "bg-emerald-500/10",
              borderColor: "border-emerald-500/20",
            },
            {
              title: "Pendente / A Receber",
              value: `R$ ${totalPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
              icon: AlertCircle,
              color: "text-amber-400",
              bgColor: "bg-amber-500/10",
              borderColor: "border-amber-500/20",
            },
            {
              title: "Total de Faturas",
              value: invoices.length,
              icon: FileText,
              color: "text-indigo-400",
              bgColor: "bg-indigo-500/10",
              borderColor: "border-indigo-500/20",
            },
            {
              title: "Clientes Cadastrados",
              value: clients.length,
              icon: Users,
              color: "text-purple-400",
              bgColor: "bg-purple-500/10",
              borderColor: "border-purple-500/20",
            },
          ].map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`p-5 rounded-2xl bg-slate-900/60 border ${item.borderColor} backdrop-blur-sm relative overflow-hidden shadow-xl`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{item.title}</span>
                <div className={`p-2 rounded-xl ${item.bgColor}`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">{item.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Tab Buttons & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
            {[
              { id: "invoices", label: "Faturas", icon: FileText },
              { id: "clients", label: "Clientes", icon: Users },
              { id: "mobile", label: "Mobile Ready (iOS/Android)", icon: Smartphone },
              { id: "security", label: "Arquitetura & Segurança", icon: ShieldCheck },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors"
              title="Recarregar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowNewClientModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
            >
              <Users className="w-4 h-4 text-purple-400" />
              <span>Novo Cliente</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowNewInvoiceModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Fatura</span>
            </motion.button>
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "invoices" && (
            <motion.div
              key="invoices"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">Todas as Faturas</h3>
                  <p className="text-xs text-slate-400">Totalmente sincronizadas com o banco PostgreSQL no Supabase</p>
                </div>
              </div>

              {invoices.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">Nenhuma fatura cadastrada ainda</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                    Cadastre um cliente e crie sua primeira fatura para testar as transações atômicas com o Prisma.
                  </p>
                  <button
                    onClick={() => setShowNewInvoiceModal(true)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Criar Primeira Fatura
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4">Fatura</th>
                        <th className="px-6 py-4">Cliente</th>
                        <th className="px-6 py-4">Vencimento</th>
                        <th className="px-6 py-4">Valor Total</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-mono font-medium text-indigo-400">{inv.invoiceNumber}</td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white">{inv.client?.name || "Sem cliente"}</div>
                            <div className="text-[11px] text-slate-400">{inv.client?.email || "Sem e-mail"}</div>
                          </td>
                          <td className="px-6 py-4 text-slate-300">
                            {new Date(inv.dueDate).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-6 py-4 font-bold text-white">
                            R$ {Number(inv.totalAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                inv.status === "PAID"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : inv.status === "PENDING"
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "clients" && (
            <motion.div
              key="clients"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">Clientes Cadastrados</h3>
                  <p className="text-xs text-slate-400">Proteção de dados contra vazamento (Isolamento por Usuário)</p>
                </div>
              </div>

              {clients.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">Nenhum cliente cadastrado</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                    Cadastre um cliente para associar a novas faturas.
                  </p>
                  <button
                    onClick={() => setShowNewClientModal(true)}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Cadastrar Cliente
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4">Nome</th>
                        <th className="px-6 py-4">E-mail</th>
                        <th className="px-6 py-4">Documento / CPF / CNPJ</th>
                        <th className="px-6 py-4">Faturas Vinculadas</th>
                        <th className="px-6 py-4">Cadastro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {clients.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-bold text-white">{c.name}</td>
                          <td className="px-6 py-4 text-slate-300">{c.email || "Não informado"}</td>
                          <td className="px-6 py-4 font-mono text-slate-400">{c.document || "-"}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                              {c._count?.invoices || 0} faturas
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400">
                            {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "mobile" && (
            <motion.div
              key="mobile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Arquitetura Mobile-Ready (iOS & Android)</h3>
                    <p className="text-xs text-slate-400">Como o app mobile se comunica com este backend</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  A estrutura que preparamos utiliza o padrão <strong>API-First</strong>. Toda a lógica de criação de clientes, faturas, cálculos matemáticos e validações está isolada em rotas REST e Services.
                </p>

                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs">
                    <div className="font-semibold text-emerald-400 mb-1">✓ Endpoints Universais</div>
                    <p className="text-slate-400">Tanto o frontend Web quanto o app em React Native / Expo consomem <code>/api/v1/clients</code> e <code>/api/v1/invoices</code> com respostas JSON idênticas.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs">
                    <div className="font-semibold text-indigo-400 mb-1">✓ Autenticação Compartilhada</div>
                    <p className="text-slate-400">O Supabase Auth fornece SDK oficial para React Native (com SecureStore/AsyncStorage). Um mesmo login funcionará na Web, iPhone e Android.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs">
                    <div className="font-semibold text-purple-400 mb-1">✓ Tipos e Schemas Zod Reutilizáveis</div>
                    <p className="text-slate-400">O arquivo <code>src/lib/validations/</code> pode ser exportado diretamente para o repositório mobile, validando formulários antes mesmo do envio.</p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-4">
                <h3 className="font-bold text-white text-sm">Endpoints REST Disponíveis</h3>
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-black/40 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-emerald-400 font-bold mr-2">GET</span>
                      <span className="text-slate-200">/api/v1/invoices</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Listar Faturas</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-indigo-400 font-bold mr-2">POST</span>
                      <span className="text-slate-200">/api/v1/invoices</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Criar Fatura (Zod)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-emerald-400 font-bold mr-2">GET</span>
                      <span className="text-slate-200">/api/v1/clients</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Listar Clientes</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-indigo-400 font-bold mr-2">POST</span>
                      <span className="text-slate-200">/api/v1/clients</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Criar Cliente (Zod)</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "security" && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Defesas Ativas Implementadas</h3>
                    <p className="text-xs text-slate-400">Proteção total dos dados dos seus clientes</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
                    <span className="font-bold text-white block mb-1">1. Prevenção Total a SQL Injection</span>
                    <p className="text-slate-400">Todas as consultas passam pelo Prisma ORM com queries estritamente parametrizadas. Nenhuma query SQL crua ou concatenação de strings é executada.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
                    <span className="font-bold text-white block mb-1">2. Validação Rigorosa com Zod</span>
                    <p className="text-slate-400">Todos os payloads recebidos (nomes, telefones, valores, itens) são parseados com Zod. Se houver caracteres inesperados ou formato inválido, a requisição é rejeitada antes de tocar no banco.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
                    <span className="font-bold text-white block mb-1">3. Rate Limiting por IP</span>
                    <p className="text-slate-400">Protege suas rotas contra scripts automatizados, força bruta e raspagem de dados (scraping).</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
                    <span className="font-bold text-white block mb-1">4. Headers HTTP de Segurança (next.config)</span>
                    <p className="text-slate-400">Configurados: HSTS, X-Frame-Options (DENY para anti-clickjacking), X-Content-Type-Options (nosniff) e Referrer-Policy restrita.</p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Status da Conexão</h3>
                    <p className="text-xs text-slate-400">Supabase Cloud PostgreSQL</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-slate-800 font-mono text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Host do Banco:</span>
                    <span className="text-slate-200">db.pgcyybkwtsykmgsxvnnn.supabase.co</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Versão do Engine:</span>
                    <span className="text-emerald-400">PostgreSQL 17.6</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Driver Adapter:</span>
                    <span className="text-indigo-400">@prisma/adapter-pg (Prisma 7)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Deploy Target:</span>
                    <span className="text-white">Vercel Edge & Serverless</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modal: Novo Cliente */}
      <AnimatePresence>
        {showNewClientModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base">Cadastrar Novo Cliente</h3>
                <button
                  onClick={() => setShowNewClientModal(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateClient} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Ex: Empresa Acme LTDA"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">E-mail</label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="financeiro@acme.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Documento (CPF / CNPJ)</label>
                  <input
                    type="text"
                    value={newClientDoc}
                    onChange={(e) => setNewClientDoc(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewClientModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md disabled:opacity-50"
                  >
                    {formSubmitting ? "Salvando..." : "Salvar Cliente"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Nova Fatura */}
      <AnimatePresence>
        {showNewInvoiceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base">Criar Nova Fatura</h3>
                <button
                  onClick={() => setShowNewInvoiceModal(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateInvoice} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Número da Fatura *</label>
                    <input
                      type="text"
                      required
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Cliente *</label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Selecione um cliente...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
                  <span className="font-semibold text-slate-300 block">Item da Fatura</span>
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Descrição</label>
                    <input
                      type="text"
                      required
                      value={invoiceItemDesc}
                      onChange={(e) => setInvoiceItemDesc(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        value={invoiceItemQty}
                        onChange={(e) => setInvoiceItemQty(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Valor Unitário (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        value={invoiceItemPrice}
                        onChange={(e) => setInvoiceItemPrice(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono"
                      />
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 pt-1">
                    Total do Item: <span className="font-bold text-white">R$ {(invoiceItemQty * invoiceItemPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewInvoiceModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold shadow-md disabled:opacity-50"
                  >
                    {formSubmitting ? "Emitindo..." : "Emitir Fatura"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
