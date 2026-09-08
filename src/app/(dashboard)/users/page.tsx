"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/dashboard/header";
import {
  Users,
  ShieldCheck,
  Clock,
  AlertTriangle,
  UserPlus,
  Search,
  Check,
  X,
  Edit2,
  Trash2,
  Save,
  UserCheck,
  Shield,
  Eye,
  Receipt,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  SYSTEM_SCREENS,
  SYSTEM_ACTIONS,
  ROLE_DEFINITIONS,
  DEFAULT_ROLE_PERMISSIONS,
  Role,
  UserStatus,
  ScreenId,
  ActionId,
  RolePermissionsMatrix,
} from "@/lib/security/rbac";
import { motion, AnimatePresence } from "framer-motion";

interface UserItem {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  status: UserStatus;
  emailVerified: string | null;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_ADMIN_EMAIL = "renatamatoz@gmail.com";

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "matrix">("users");

  // Filter & search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Modals state
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  // New user form state
  const [newForm, setNewForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "OPERATOR" as Role,
    status: "ACTIVE" as UserStatus,
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit user form state
  const [editForm, setEditForm] = useState<{
    role: Role;
    status: UserStatus;
    name: string;
    phone: string;
  }>({
    role: "OPERATOR",
    status: "ACTIVE",
    name: "",
    phone: "",
  });
  const [updatingUser, setUpdatingUser] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // RBAC Matrix state
  const [matrix, setMatrix] = useState<RolePermissionsMatrix>(DEFAULT_ROLE_PERMISSIONS);
  const [matrixSaving, setMatrixSaving] = useState(false);
  const [matrixSuccess, setMatrixSuccess] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/users");
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || []);
      }
    } catch (e) {
      console.error("Erro ao buscar usuários:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatrix = async () => {
    try {
      const res = await fetch("/api/v1/roles");
      if (res.ok) {
        const json = await res.json();
        if (json.data?.matrix) {
          setMatrix(json.data.matrix);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar matriz de permissões:", e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchMatrix();
  }, []);

  // Quick Approval Handler
  const handleApproveUser = async (id: string, assignedRole?: Role) => {
    try {
      const payload: { status: string; role?: Role } = { status: "ACTIVE" };
      if (assignedRole) payload.role = assignedRole;

      const res = await fetch(`/api/v1/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao aprovar usuário.");
      }
    } catch (e) {
      console.error("Erro ao aprovar:", e);
    }
  };

  // Suspend or Reactivate Toggle
  const handleToggleStatus = async (user: UserItem) => {
    if (user.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
      alert("A conta administradora principal não pode ser alterada.");
      return;
    }

    const nextStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao alterar status.");
      }
    } catch (e) {
      console.error("Erro:", e);
    }
  };

  // Delete User Handler
  const handleDeleteUser = async (user: UserItem) => {
    if (user.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
      alert("A administradora mestre Renata Matos não pode ser excluída.");
      return;
    }

    if (!confirm(`Deseja realmente remover o acesso de ${user.name || user.email}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao excluir usuário.");
      }
    } catch (e) {
      console.error("Erro ao excluir usuário:", e);
    }
  };

  // Create User Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Falha ao cadastrar usuário.");
        setCreatingUser(false);
        return;
      }

      setIsNewUserModalOpen(false);
      setNewForm({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "OPERATOR",
        status: "ACTIVE",
      });
      fetchUsers();
    } catch {
      setCreateError("Erro de conexão ao criar usuário.");
    } finally {
      setCreatingUser(false);
    }
  };

  // Edit User Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUpdatingUser(true);
    setUpdateError(null);

    try {
      const res = await fetch(`/api/v1/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setUpdateError(data.error || "Falha ao atualizar usuário.");
        setUpdatingUser(false);
        return;
      }

      setEditingUser(null);
      fetchUsers();
    } catch {
      setUpdateError("Erro ao salvar alterações.");
    } finally {
      setUpdatingUser(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (user: UserItem) => {
    setEditingUser(user);
    setEditForm({
      role: user.role,
      status: user.status,
      name: user.name || "",
      phone: user.phone || "",
    });
    setUpdateError(null);
  };

  // Save Permissions Matrix Submit
  const handleSaveMatrix = async () => {
    setMatrixSaving(true);
    try {
      const res = await fetch("/api/v1/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix }),
      });

      if (res.ok) {
        setMatrixSuccess(true);
        setTimeout(() => setMatrixSuccess(false), 3000);
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao atualizar permissões.");
      }
    } catch (e) {
      console.error("Erro ao salvar matriz:", e);
    } finally {
      setMatrixSaving(false);
    }
  };

  const togglePermission = (role: Role, screen: ScreenId, action: ActionId) => {
    if (role === "ADMIN") return; // Admin is always fully enabled
    setMatrix((prev) => {
      const rolePerms = prev[role] || ({} as Record<ScreenId, Record<ActionId, boolean>>);
      const screenPerms = rolePerms[screen] || ({} as Record<ActionId, boolean>);
      const current = Boolean(screenPerms[action]);

      return {
        ...prev,
        [role]: {
          ...rolePerms,
          [screen]: {
            ...screenPerms,
            [action]: !current,
          },
        },
      };
    });
  };

  // Derived statistics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "ACTIVE").length;
    const pending = users.filter((u) => u.status === "PENDING_APPROVAL").length;
    const admins = users.filter((u) => u.role === "ADMIN").length;
    return { total, active, pending, admins };
  }, [users]);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const q = search.toLowerCase();
      const matchSearch =
        user.name?.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.phone?.toLowerCase().includes(q);

      const matchStatus = statusFilter === "ALL" || user.status === statusFilter;
      const matchRole = roleFilter === "ALL" || user.role === roleFilter;

      return matchSearch && matchStatus && matchRole;
    });
  }, [users, search, statusFilter, roleFilter]);

  // Pending users specifically
  const pendingUsers = useMemo(() => {
    return users.filter((u) => u.status === "PENDING_APPROVAL");
  }, [users]);

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ShieldCheck className="w-3 h-3 text-indigo-600" />
            <span>Admin</span>
          </span>
        );
      case "FINANCIAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Receipt className="w-3 h-3 text-emerald-600" />
            <span>Financeiro</span>
          </span>
        );
      case "OPERATOR":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span>Operador</span>
          </span>
        );
      case "VIEWER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Eye className="w-3 h-3 text-slate-600" />
            <span>Visualizador</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ativo</span>
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Pendente</span>
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>Suspenso</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Usuários & Permissões (RBAC)"
        subtitle="Gestão de colaboradores, liberação de cadastros e matriz de permissões por tela"
        onRefresh={fetchUsers}
        loading={loading}
        actionSlot={
          <button
            onClick={() => setIsNewUserModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Colaborador</span>
          </button>
        }
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Total de Usuários</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{stats.total}</p>
            <p className="text-[11px] text-slate-400 mt-1">Colaboradores registrados</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold">
              <span>Usuários Ativos</span>
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-600 mt-2">{stats.active}</p>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">Com acesso liberado</p>
          </div>

          <div
            className={`p-4 rounded-2xl border shadow-xs transition-colors ${
              stats.pending > 0
                ? "bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/30"
                : "bg-white border-slate-200/80"
            }`}
          >
            <div className="flex items-center justify-between text-amber-700 text-xs font-bold">
              <span>Aguardando Aprovação</span>
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
            </div>
            <p className="text-2xl font-black text-amber-700 mt-2">{stats.pending}</p>
            <p className="text-[11px] text-amber-800 font-medium mt-1">
              {stats.pending > 0 ? "Ação necessária abaixo" : "Nenhum pendente"}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-indigo-600 text-xs font-semibold">
              <span>Administradores</span>
              <Shield className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-indigo-600 mt-2">{stats.admins}</p>
            <p className="text-[11px] text-slate-400 mt-1">Acesso total irrestrito</p>
          </div>
        </div>

        {/* Pending Approvals Section Banner */}
        {pendingUsers.length > 0 && (
          <div className="p-5 rounded-2xl bg-amber-50/90 border border-amber-300 shadow-sm space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-200 text-amber-900">
                  <AlertTriangle className="w-5 h-5 text-amber-800" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-amber-900">
                    Cadastros Pendentes de Liberação ({pendingUsers.length})
                  </h3>
                  <p className="text-xs text-amber-800">
                    Novos usuários se cadastraram pelo Google ou credenciais e estão aguardando liberação de acesso.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {pendingUsers.map((pending) => (
                <div
                  key={pending.id}
                  className="p-4 rounded-xl bg-white border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">
                      {pending.name || "Sem Nome"}
                    </span>
                    <span className="text-xs text-slate-500 font-mono block">
                      {pending.email}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Cadastrado em: {new Date(pending.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveUser(pending.id, "OPERATOR")}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Aprovar Operador</span>
                    </button>

                    <button
                      onClick={() => openEditModal(pending)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                      title="Escolher outra função"
                    >
                      <span>Outro Cargo</span>
                    </button>

                    <button
                      onClick={() => handleDeleteUser(pending)}
                      className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                      title="Recusar cadastro"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "users"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Colaboradores Cadastrados ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("matrix")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "matrix"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Matriz de Permissões RBAC</span>
          </button>
        </div>

        {/* Tab 1: Users List */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nome, e-mail ou telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none shadow-2xs cursor-pointer"
                >
                  <option value="ALL">Todos os status</option>
                  <option value="ACTIVE">Ativos</option>
                  <option value="PENDING_APPROVAL">Pendentes</option>
                  <option value="SUSPENDED">Suspensos</option>
                </select>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none shadow-2xs cursor-pointer"
                >
                  <option value="ALL">Todas as funções</option>
                  <option value="ADMIN">Administrador</option>
                  <option value="FINANCIAL">Financeiro</option>
                  <option value="OPERATOR">Operador</option>
                  <option value="VIEWER">Visualizador</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-5">Colaborador</th>
                      <th className="py-3 px-4">Função / Cargo</th>
                      <th className="py-3 px-4">Status de Acesso</th>
                      <th className="py-3 px-4">Telefone</th>
                      <th className="py-3 px-4">Cadastro</th>
                      <th className="py-3 px-5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                          {loading ? "Carregando usuários..." : "Nenhum usuário encontrado."}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const isPrimary =
                          user.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase();

                        return (
                          <tr
                            key={user.id}
                            className="hover:bg-slate-50/60 transition-colors"
                          >
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center font-black text-indigo-700 text-xs shrink-0 shadow-2xs">
                                  {(user.name || user.email)
                                    .split(" ")
                                    .slice(0, 2)
                                    .map((p) => p[0])
                                    .join("")
                                    .toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                                    {user.name || "Usuário"}
                                    {isPrimary && (
                                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                                        Principal
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-slate-500 text-[11px] font-mono block">
                                    {user.email}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">{getRoleBadge(user.role)}</td>

                            <td className="py-3.5 px-4">{getStatusBadge(user.status)}</td>

                            <td className="py-3.5 px-4 text-slate-600 font-mono">
                              {user.phone || "-"}
                            </td>

                            <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                              {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                            </td>

                            <td className="py-3.5 px-5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {user.status === "PENDING_APPROVAL" && (
                                  <button
                                    onClick={() => handleApproveUser(user.id)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-bold transition-colors cursor-pointer"
                                  >
                                    Aprovar
                                  </button>
                                )}

                                <button
                                  onClick={() => openEditModal(user)}
                                  className="p-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
                                  title="Editar perfil e função"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {!isPrimary && (
                                  <button
                                    onClick={() => handleToggleStatus(user)}
                                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                      user.status === "ACTIVE"
                                        ? "bg-slate-50 hover:bg-amber-50 border-slate-200 hover:border-amber-200 text-slate-600 hover:text-amber-600"
                                        : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700"
                                    }`}
                                    title={
                                      user.status === "ACTIVE"
                                        ? "Suspender acesso"
                                        : "Reativar acesso"
                                    }
                                  >
                                    {user.status === "ACTIVE" ? (
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}

                                {!isPrimary && (
                                  <button
                                    onClick={() => handleDeleteUser(user)}
                                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Excluir usuário"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: RBAC Matrix */}
        {activeTab === "matrix" && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <span>Matriz de Controle de Acessos por Função (RBAC)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Configure quais telas e ações cada papel de usuário tem permissão para acessar no sistema.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {matrixSuccess && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    <span>Permissões Salvas!</span>
                  </span>
                )}
                <button
                  onClick={handleSaveMatrix}
                  disabled={matrixSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-60"
                >
                  {matrixSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Salvar Matriz</span>
                </button>
              </div>
            </div>

            {/* Matrix Role Cards Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {(Object.keys(ROLE_DEFINITIONS) as Role[]).map((rKey) => {
                const def = ROLE_DEFINITIONS[rKey];
                return (
                  <div
                    key={rKey}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{def.name}</span>
                      {getRoleBadge(rKey)}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      {def.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4 font-bold">Tela do Sistema</th>
                    <th className="py-3 px-3 font-bold text-center">Visualizar (Read)</th>
                    <th className="py-3 px-3 font-bold text-center">Criar (Create)</th>
                    <th className="py-3 px-3 font-bold text-center">Editar (Update)</th>
                    <th className="py-3 px-3 font-bold text-center">Excluir (Delete)</th>
                    <th className="py-3 px-3 font-bold text-center">Exportar / Imprimir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {SYSTEM_SCREENS.map((screen) => (
                    <React.Fragment key={screen.id}>
                      <tr className="bg-slate-100/60 font-bold text-slate-800 text-xs">
                        <td colSpan={6} className="py-2.5 px-4">
                          <div className="flex items-center justify-between">
                            <span className="text-indigo-900 font-bold">{screen.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              {screen.route} • {screen.description}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {(["FINANCIAL", "OPERATOR", "VIEWER"] as Role[]).map((rKey) => {
                        const rolePerms = matrix[rKey] || ({} as Record<ScreenId, Record<ActionId, boolean>>);
                        const screenPerms = rolePerms[screen.id] || ({} as Record<ActionId, boolean>);

                        return (
                          <tr key={`${screen.id}-${rKey}`} className="hover:bg-slate-50/50">
                            <td className="py-2 px-4 pl-8 text-slate-600 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                              <span className="font-medium text-[11px]">
                                {ROLE_DEFINITIONS[rKey].name}
                              </span>
                            </td>

                            {SYSTEM_ACTIONS.map((action) => {
                              const checked = Boolean(screenPerms[action.id]);

                              return (
                                <td key={action.id} className="py-2 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      togglePermission(rKey, screen.id, action.id)
                                    }
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Novo Usuário */}
      <AnimatePresence>
        {isNewUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Novo Colaborador</h3>
                    <p className="text-xs text-slate-500">Cadastre e defina o perfil de acesso</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={newForm.name}
                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                    placeholder="Ex: Carlos Oliveira"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">E-mail</label>
                  <input
                    type="email"
                    required
                    value={newForm.email}
                    onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                    placeholder="colaborador@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Telefone</label>
                  <input
                    type="tel"
                    value={newForm.phone}
                    onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                    placeholder="9704129406"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Senha Inicial (Opcional)
                  </label>
                  <input
                    type="password"
                    value={newForm.password}
                    onChange={(e) => setNewForm({ ...newForm, password: e.target.value })}
                    placeholder="Deixe em branco para senha padrão Mudar@1234"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Função (Role)</label>
                    <select
                      value={newForm.role}
                      onChange={(e) => setNewForm({ ...newForm, role: e.target.value as Role })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="OPERATOR">Operador</option>
                      <option value="FINANCIAL">Financeiro</option>
                      <option value="VIEWER">Visualizador</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Status</label>
                    <select
                      value={newForm.status}
                      onChange={(e) =>
                        setNewForm({ ...newForm, status: e.target.value as UserStatus })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="ACTIVE">Ativo (Liberado)</option>
                      <option value="PENDING_APPROVAL">Pendente de Aprovação</option>
                      <option value="SUSPENDED">Suspenso</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsNewUserModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {creatingUser && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Cadastrar Usuário</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Editar Usuário */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Editar Colaborador</h3>
                    <p className="text-xs text-slate-500">{editingUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingUser(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {updateError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {updateError}
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Nome</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Telefone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Função (Role)</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                      disabled={
                        editingUser.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:bg-slate-100"
                    >
                      <option value="OPERATOR">Operador</option>
                      <option value="FINANCIAL">Financeiro</option>
                      <option value="VIEWER">Visualizador</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) =>
                        setEditForm({ ...editForm, status: e.target.value as UserStatus })
                      }
                      disabled={
                        editingUser.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:bg-slate-100"
                    >
                      <option value="ACTIVE">Ativo (Liberado)</option>
                      <option value="PENDING_APPROVAL">Pendente</option>
                      <option value="SUSPENDED">Suspenso</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={updatingUser}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {updatingUser && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Salvar Alterações</span>
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
