"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Building2, Users, Calendar, Eye } from "lucide-react";

interface CompanyRow {
  id: string;
  name: string;
  ownerEmail: string;
  userCount: number;
  createdAt: string;
}

export default function AdminCompaniesPage() {
  const router = useRouter();
  const { user, loading: userLoading, isSuperAdmin } = useCurrentUser();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && user && !isSuperAdmin) {
      router.push("/");
    }
  }, [userLoading, user, isSuperAdmin, router]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/companies");
      if (res.ok) {
        const json = await res.json();
        setCompanies(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) fetchCompanies();
  }, [isSuperAdmin]);

  const handleViewAs = async (companyId: string) => {
    setSwitchingId(companyId);
    try {
      const res = await fetch(`/api/v1/admin/companies/${companyId}/view-as`, {
        method: "POST",
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      }
    } finally {
      setSwitchingId(null);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        title="Painel de Super-Admin"
        subtitle="Todas as empresas cadastradas na plataforma"
        onRefresh={fetchCompanies}
        loading={loading}
      />
      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
              <tr>
                <th className="text-left px-4 py-3">Empresa</th>
                <th className="text-left px-4 py-3">Dono</th>
                <th className="text-left px-4 py-3">Usuários</th>
                <th className="text-left px-4 py-3">Criada em</th>
                <th className="text-right px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.ownerEmail}</td>
                  <td className="px-4 py-3 text-slate-600 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {c.userCount}
                  </td>
                  <td className="px-4 py-3 text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleViewAs(c.id)}
                      disabled={switchingId === c.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Eye className="w-3 h-3" />
                      Ver como
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
