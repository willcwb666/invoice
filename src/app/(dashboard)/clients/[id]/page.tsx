"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
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
} from "lucide-react";

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const clientId = resolvedParams.id;

  const [client, setClient] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [resClients, resInvoices, resAppts] = await Promise.all([
          fetch("/api/v1/clients"),
          fetch("/api/v1/invoices"),
          fetch("/api/v1/appointments"),
        ]);

        if (resClients.ok) {
          const clients = (await resClients.json()).data || [];
          const found = clients.find((c: any) => c.id === clientId);
          setClient(found);
        }

        if (resInvoices.ok) {
          const allInvoices = (await resInvoices.json()).data || [];
          setInvoices(allInvoices.filter((inv: any) => inv.client?.name === client?.name || inv.clientId === clientId));
        }

        if (resAppts.ok) {
          const allAppts = (await resAppts.json()).data || [];
          setAppointments(allAppts.filter((a: any) => a.client?.name === client?.name || a.clientId === clientId));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [clientId, client?.name]);

  if (loading) {
    return (
      <div>
        <Header title="Carregando cliente..." />
        <div className="p-12 text-center text-xs text-slate-400">Carregando ficha do cliente...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div>
        <Header title="Cliente não encontrado" />
        <div className="p-12 text-center space-y-4">
          <p className="text-xs text-slate-400">Este cliente não existe ou foi removido.</p>
          <Link href="/clients" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold inline-block">
            Voltar para Lista
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={client.name}
        subtitle={`Ficha do Cliente • ${client.billingType}`}
      />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Link
          href="/clients"
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Lista de Clientes</span>
        </Link>

        {/* Profile Card & GPS Routing */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">{client.name}</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-medium">
              {client.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{client.email}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span className="font-mono text-slate-700">{client.address}</span>
              </div>
            </div>
          </div>

          {/* Botões Grandes de GPS para a Rua */}
          <div className="flex items-center gap-2">
            <a
              href={`https://maps.apple.com/?daddr=${encodeURIComponent(client.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold shadow-xs flex items-center gap-2 border border-indigo-200 transition-colors"
            >
              <Navigation className="w-4 h-4" />
              <span>Apple Maps</span>
            </a>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(client.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-2 transition-colors"
            >
              <Navigation className="w-4 h-4 text-emerald-600" />
              <span>Google Maps</span>
            </a>
          </div>
        </div>

        {/* Faturas deste Cliente */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
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
            <p className="text-xs text-slate-400 py-3">Nenhuma fatura registrada para este cliente.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-indigo-600 font-bold text-xs">{inv.invoiceNumber}</span>
                    <span className="text-xs text-slate-500 font-medium">
                      {new Date(inv.issueDate).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 text-xs">
                      ${Number(inv.totalAmount).toFixed(2)}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        inv.status === "PAID"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
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
      </div>
    </div>
  );
}
