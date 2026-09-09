"use client";

import { useState, useEffect, useCallback } from "react";
import { Role, UserStatus } from "@/lib/security/rbac";

export interface CurrentUserData {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  companyId?: string | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUserData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/me");
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setUser(json.data);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar usuário atual:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    loading,
    refresh: fetchUser,
    isAdmin: user?.role === "ADMIN",
    isFinancial: user?.role === "FINANCIAL",
    isOperator: user?.role === "OPERATOR",
    isViewer: user?.role === "VIEWER",
    isActive: user?.status === "ACTIVE",
    isPending: user?.status === "PENDING_APPROVAL",
    isSuspended: user?.status === "SUSPENDED",
  };
}
