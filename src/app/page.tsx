"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  FileText,
  Users,
  DollarSign,
  Plus,
  Navigation,
  Calendar,
  Lock,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Receipt,
  Sparkles,
  RefreshCw,
  Fuel,
  Wrench,
  Check,
  ExternalLink,
  Clock,
  MapPin,
  Flame,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  billingType: string;
  _count?: { invoices: number; appointments: number };
}

interface InvoiceItem {
  id: string;
  serviceDate: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: "DRAFT" | "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
  issueDate: string;
  dueDate: string;
  providerAddress: string;
  subtotal: number;
  totalAmount: number;
  client: { name: string; email: string | null; phone: string | null; address: string };
  items: InvoiceItem[];
}

interface Appointment {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  price: number;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  origin: "INTERNAL" | "ICLOUD_SYNC" | "PUBLIC_BOOKING";
  invoiced: boolean;
  client: { name: string; phone: string | null; address: string };
  service?: { name: string };
}

interface Expense {
  id: string;
  category: "FUEL" | "CLEANING_SUPPLIES" | "VEHICLE_MAINTENANCE" | "EQUIPMENT" | "MEALS" | "OTHER";
  description: string;
  amount: number;
  date: string;
}

interface Estimate {
  id: string;
  estimateNumber: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "CONVERTED";
  validUntil: string;
  totalAmount: number;
  client: { name: string; email: string | null };
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
}

interface DashboardMetrics {
  goal: {
    monthlyGoal: number;
    currentBilled: number;
    paidAmount: number;
    remaining: number;
    progressPercent: number;
    projectedFromAgenda: number;
    totalProjected: number;
    projectedProgressPercent: number;
    isGoalReached: boolean;
  };
  invoices: {
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
    totalInvoices: number;
    clientCount: number;
    totalExpenses: number;
    netProfit: number;
  };
  financial: {
    totalBilled: number;
    totalReceived: number;
    totalPending: number;
    totalExpenses: number;
    netProfit: number;
    expensesByCategory: Record<string, number>;
  };
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<
    "agenda" | "invoices" | "estimates" | "clients" | "expenses" | "security"
  >("agenda");

  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Modais
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [showNewApptModal, setShowNewApptModal] = useState(false);
  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false);

  // Form states
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Appointment Form states
  const [apptClientId, setApptClientId] = useState("");
  const [apptTitle, setApptTitle] = useState("Limpeza Padrão");
  const [apptPrice, setApptPrice] = useState(130);
  const [apptDate, setApptDate] = useState(new Date().toISOString().slice(0, 10));
  const [apptStartTime, setApptStartTime] = useState("09:00");
  const [apptEndTime, setApptEndTime] = useState("11:30");

  // Expense Form states
  const [expCategory, setExpCategory] = useState<"FUEL" | "CLEANING_SUPPLIES" | "VEHICLE_MAINTENANCE">("FUEL");
  const [expDescription, setExpDescription] = useState("");
  const [expAmount, setExpAmount] = useState(45);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resClients, resInvoices, resAppts, resExpenses, resEstimates, resMetrics] =
        await Promise.all([
          fetch("/api/v1/clients"),
          fetch("/api/v1/invoices"),
          fetch("/api/v1/appointments"),
          fetch("/api/v1/expenses"),
          fetch("/api/v1/estimates"),
          fetch("/api/v1/dashboard/metrics"),
        ]);

      if (resClients.ok) setClients((await resClients.json()).data || []);
      if (resInvoices.ok) setInvoices((await resInvoices.json()).data || []);
      if (resAppts.ok) setAppointments((await resAppts.json()).data || []);
      if (resExpenses.ok) setExpenses((await resExpenses.json()).data || []);
      if (resEstimates.ok) setEstimates((await resEstimates.json()).data || []);
      if (resMetrics.ok) setMetrics((await resMetrics.json()).data || null);
    } catch (err) {
      console.error("Erro ao sincronizar dados:", err);
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
          phone: newClientPhone || undefined,
          address: newClientAddress,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erro ao salvar cliente.");
      setShowNewClientModal(false);
      setNewClientName("");
      setNewClientEmail("");
      setNewClientPhone("");
      setNewClientAddress("");
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSubmitting(true);
    try {
      const startDateTime = new Date(`${apptDate}T${apptStartTime}:00Z`).toISOString();
      const endDateTime = new Date(`${apptDate}T${apptEndTime}:00Z`).toISOString();

      const res = await fetch("/api/v1/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: apptClientId,
          title: apptTitle,
          date: new Date(`${apptDate}T12:00:00Z`).toISOString(),
          startTime: startDateTime,
          endTime: endDateTime,
          price: Number(apptPrice),
          origin: "INTERNAL",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erro ao agendar.");
      setShowNewApptModal(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSubmitting(true);
    try {
      const res = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: expCategory,
          description: expDescription,
          amount: Number(expAmount),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erro ao registrar despesa.");
      setShowNewExpenseModal(false);
      setExpDescription("");
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const goal = metrics?.goal;
  const financial = metrics?.financial;

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
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-[#090D16] rounded-[10px] flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white tracking-tight">Renata Matos de Oliveira</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Evans, CO • 970 412 9406
                </span>
              </div>
              <p className="text-xs text-slate-400">Field Service & Invoicing • Next.js 16 • Supabase Live</p>
            </div>
          </motion.div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>RBAC & Audit Ativo</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Banner de Meta Mensal ($6,000) e Projeção da Agenda */}
        {goal && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-2xl relative overflow-hidden"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Flame className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Meta de Faturamento Mensal
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white">
                  ${goal.currentBilled.toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
                  <span className="text-sm font-medium text-slate-400">
                    de ${goal.monthlyGoal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </h2>
                <p className="text-xs text-slate-300">
                  {goal.isGoalReached ? (
                    <span className="text-emerald-400 font-bold">🎉 Parabéns! Meta mensal atingida com sucesso!</span>
                  ) : (
                    <span>
                      Faltam apenas{" "}
                      <strong className="text-amber-300">
                        ${goal.remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </strong>{" "}
                      para bater o objetivo do mês.
                    </span>
                  )}
                </p>
              </div>

              {/* Projeção futura com base na Agenda */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-indigo-500/20 text-xs min-w-[280px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 font-medium">Projeção com a Agenda:</span>
                  <span className="font-bold text-emerald-400">
                    ${goal.totalProjected.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${goal.progressPercent}%` }}
                    transition={{ duration: 1 }}
                    className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-2.5 rounded-full"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 mt-2">
                  <span>Progresso: {goal.progressPercent}%</span>
                  <span>Previsto: {goal.projectedProgressPercent}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {[
            {
              title: "Recebido (Pago)",
              value: `$${(financial?.totalReceived || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
              icon: DollarSign,
              color: "text-emerald-400",
              bgColor: "bg-emerald-500/10",
              borderColor: "border-emerald-500/20",
            },
            {
              title: "Pendente / A Receber",
              value: `$${(financial?.totalPending || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
              icon: AlertCircle,
              color: "text-amber-400",
              bgColor: "bg-amber-500/10",
              borderColor: "border-amber-500/20",
            },
            {
              title: "Despesas Operacionais",
              value: `$${(financial?.totalExpenses || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
              icon: Fuel,
              color: "text-rose-400",
              bgColor: "bg-rose-500/10",
              borderColor: "border-rose-500/20",
            },
            {
              title: "Lucro Líquido Real",
              value: `$${(financial?.netProfit || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
              icon: TrendingUp,
              color: "text-indigo-400",
              bgColor: "bg-indigo-500/10",
              borderColor: "border-indigo-500/20",
            },
          ].map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              whileHover={{ y: -4 }}
              className={`p-5 rounded-2xl bg-slate-900/60 border ${item.borderColor} backdrop-blur-sm relative shadow-xl`}
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
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
          <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
            {[
              { id: "agenda", label: "Agenda (iPhone / iCloud)", icon: Calendar },
              { id: "invoices", label: "Faturas (Invoices)", icon: FileText },
              { id: "estimates", label: "Orçamentos (Estimates)", icon: Receipt },
              { id: "clients", label: "Clientes & Rotas", icon: Users },
              { id: "expenses", label: "Despesas", icon: Fuel },
              { id: "security", label: "Multi-Endereço & Segurança", icon: ShieldCheck },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowNewApptModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span>Novo Agendamento</span>
            </button>
            <button
              onClick={() => setShowNewClientModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Users className="w-4 h-4 text-purple-400" />
              <span>Novo Cliente</span>
            </button>
            <button
              onClick={() => setShowNewExpenseModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Fuel className="w-4 h-4 text-rose-400" />
              <span>Lançar Despesa</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* TAB 1: AGENDA INTELIGENTE */}
          {activeTab === "agenda" && (
            <motion.div
              key="agenda"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden shadow-2xl space-y-4 p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div>
                  <h3 className="font-semibold text-white">Agenda de Atendimentos</h3>
                  <p className="text-xs text-slate-400">
                    Sincronizável com o calendário do iPhone da sua esposa via feed WebCal / iCloud
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                    Feed iCal: webcal://invoice.local/feed.ics
                  </span>
                </div>
              </div>

              {appointments.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">Nenhum agendamento futuro</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                    Adicione um atendimento para visualizar a rota no Maps e a previsão de faturamento.
                  </p>
                  <button
                    onClick={() => setShowNewApptModal(true)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Criar Agendamento
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {appointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold text-indigo-400 block">{appt.title}</span>
                          <h4 className="font-bold text-white text-sm">{appt.client?.name}</h4>
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {new Date(appt.date).toLocaleDateString("pt-BR")} •{" "}
                              {new Date(appt.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black text-emerald-400 block">
                            ${Number(appt.price).toFixed(2)}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                            {appt.status}
                          </span>
                        </div>
                      </div>

                      {/* Botão de Rota GPS no Maps */}
                      {appt.location && (
                        <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-slate-300 text-xs truncate max-w-[200px]">
                            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span className="truncate">{appt.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://maps.apple.com/?daddr=${encodeURIComponent(appt.location)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] font-semibold text-white flex items-center gap-1"
                            >
                              <Navigation className="w-3 h-3 text-indigo-400" />
                              <span>Apple Maps</span>
                            </a>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(appt.location)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] font-semibold text-white flex items-center gap-1"
                            >
                              <Navigation className="w-3 h-3 text-emerald-400" />
                              <span>Google Maps</span>
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: FATURAS (INVOICES) */}
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
                  <p className="text-xs text-slate-400">
                    Faturas consolidadas mensais e avulsas gravadas no PostgreSQL
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Fatura</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Endereço de Emissão (Snapshot)</th>
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
                          <div className="font-semibold text-white">{inv.client?.name}</div>
                          <div className="text-[11px] text-slate-400">{inv.client?.email || inv.client?.address}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-[11px] font-mono">
                          {inv.providerAddress || "Evans, CO"}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {new Date(inv.dueDate).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-6 py-4 font-bold text-white">
                          ${Number(inv.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              inv.status === "PAID"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
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
            </motion.div>
          )}

          {/* TAB 3: ORÇAMENTOS (ESTIMATES) */}
          {activeTab === "estimates" && (
            <motion.div
              key="estimates"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden shadow-2xl p-6"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div>
                  <h3 className="font-semibold text-white">Orçamentos (Estimates)</h3>
                  <p className="text-xs text-slate-400">
                    Envie orçamentos profissionais para clientes e converta em faturas em 1 clique
                  </p>
                </div>
              </div>

              {estimates.length === 0 ? (
                <div className="p-12 text-center">
                  <Receipt className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-white mb-1">Nenhum orçamento cadastrado</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Crie orçamentos rápidos na rua para novos clientes de Move-out ou faxina padrão.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {estimates.map((est) => (
                    <div
                      key={est.id}
                      className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono text-indigo-400 font-bold mr-2">{est.estimateNumber}</span>
                        <span className="font-semibold text-white">{est.client?.name}</span>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Válido até {new Date(est.validUntil).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-white text-base">
                          ${Number(est.totalAmount).toFixed(2)}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {est.status}
                        </span>
                        <button className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
                          Converter em Invoice
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 4: CLIENTES & ROTAS */}
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
                  <p className="text-xs text-slate-400">
                    Com endereço pronto para cálculo de rotas no Apple Maps / Google Maps
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Nome</th>
                      <th className="px-6 py-4">Telefone / E-mail</th>
                      <th className="px-6 py-4">Endereço (GPS)</th>
                      <th className="px-6 py-4">Tipo de Cobrança</th>
                      <th className="px-6 py-4">Navegação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {clients.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-white">{c.name}</td>
                        <td className="px-6 py-4">
                          <div className="text-slate-200">{c.phone || "-"}</div>
                          <div className="text-slate-400 text-[11px]">{c.email || "-"}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-300">{c.address}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-[10px]">
                            {c.billingType}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <a
                            href={`https://maps.apple.com/?daddr=${encodeURIComponent(c.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 font-semibold inline-flex items-center gap-1 mr-2"
                          >
                            <Navigation className="w-3 h-3" />
                            Apple
                          </a>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-semibold inline-flex items-center gap-1"
                          >
                            <Navigation className="w-3 h-3" />
                            Google
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* TAB 5: DESPESAS */}
          {activeTab === "expenses" && (
            <motion.div
              key="expenses"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden shadow-2xl p-6"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div>
                  <h3 className="font-semibold text-white">Despesas Operacionais</h3>
                  <p className="text-xs text-slate-400">
                    Controle de custos de combustível, manutenção do carro e produtos de limpeza
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
                        {exp.category === "FUEL" ? (
                          <Fuel className="w-5 h-5" />
                        ) : (
                          <Wrench className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-white text-sm block">{exp.description}</span>
                        <span className="text-[11px] text-slate-400">
                          {exp.category} • {new Date(exp.date).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold text-rose-400">
                        -${Number(exp.amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 6: MULTI-ENDEREÇO & SEGURANÇA */}
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
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Endereços Cadastrados da Empresa</h3>
                    <p className="text-xs text-slate-400">Integridade histórica e faturas ativas</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-emerald-500/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white">4172 MeadowView - Evans, CO - 80620</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold uppercase text-[10px]">
                        Atual / Vigente
                      </span>
                    </div>
                    <p className="text-slate-400">
                      Endereço padrão aplicado automaticamente em todas as novas faturas e orçamentos emitidos.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-300">1705 30th St., #104 - Greeley, CO - 80631</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 font-bold uppercase text-[10px]">
                        Histórico
                      </span>
                    </div>
                    <p className="text-slate-400">
                      Preservado no banco para garantir que faturas antigas (ex: Marie Warren 05-2026) continuem idênticas ao original.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Controle de Acesso & Auditoria (RBAC)</h3>
                    <p className="text-xs text-slate-400">Aprovação obrigatória de novos usuários</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-slate-800 font-mono text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Admin Principal:</span>
                    <span className="text-white">renatamatoz@gmail.com</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status Novos Cadastros:</span>
                    <span className="text-amber-400">PENDING_APPROVAL (Bloqueado)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Validade do Token:</span>
                    <span className="text-slate-200">7 dias</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Auditoria de Logs:</span>
                    <span className="text-emerald-400">Tabela audit_logs Ativa</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* MODAL: NOVO CLIENTE */}
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
                <button onClick={() => setShowNewClientModal(false)} className="text-slate-400 hover:text-white">
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
                  <label className="block text-slate-300 font-medium mb-1">Nome do Cliente / Empresa *</label>
                  <input
                    type="text"
                    required
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Ex: Holland Law Office"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Telefone (para WhatsApp/iMessage)</label>
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="970 555 0199"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">E-mail (para envio de faturas)</label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="contact@client.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Endereço Completo (para GPS) *</label>
                  <input
                    type="text"
                    required
                    value={newClientAddress}
                    onChange={(e) => setNewClientAddress(e.target.value)}
                    placeholder="5652 McWhinney Blvd - Loveland - CO"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewClientModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                  >
                    {formSubmitting ? "Salvando..." : "Salvar Cliente"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: NOVO AGENDAMENTO */}
      <AnimatePresence>
        {showNewApptModal && (
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
                <h3 className="font-bold text-white text-base">Novo Agendamento</h3>
                <button onClick={() => setShowNewApptModal(false)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateAppointment} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Cliente *</label>
                  <select
                    required
                    value={apptClientId}
                    onChange={(e) => setApptClientId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  >
                    <option value="">Selecione o cliente...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.address})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Título do Atendimento *</label>
                  <input
                    type="text"
                    required
                    value={apptTitle}
                    onChange={(e) => setApptTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Data *</label>
                    <input
                      type="date"
                      required
                      value={apptDate}
                      onChange={(e) => setApptDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Valor Negociado ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={apptPrice}
                      onChange={(e) => setApptPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Início</label>
                    <input
                      type="time"
                      value={apptStartTime}
                      onChange={(e) => setApptStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Término</label>
                    <input
                      type="time"
                      value={apptEndTime}
                      onChange={(e) => setApptEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewApptModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                  >
                    {formSubmitting ? "Agendando..." : "Confirmar Agendamento"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: NOVA DESPESA */}
      <AnimatePresence>
        {showNewExpenseModal && (
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
                <h3 className="font-bold text-white text-base">Lançar Nova Despesa</h3>
                <button onClick={() => setShowNewExpenseModal(false)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Categoria *</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  >
                    <option value="FUEL">Gasolina / Combustível</option>
                    <option value="CLEANING_SUPPLIES">Produtos de Limpeza</option>
                    <option value="VEHICLE_MAINTENANCE">Manutenção Veicular</option>
                    <option value="EQUIPMENT">Equipamentos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Descrição *</label>
                  <input
                    type="text"
                    required
                    value={expDescription}
                    onChange={(e) => setExpDescription(e.target.value)}
                    placeholder="Ex: Abastecimento posto Shell"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Valor ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewExpenseModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                  >
                    {formSubmitting ? "Lançando..." : "Salvar Despesa"}
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
