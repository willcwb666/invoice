"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

export function ViewAsBanner() {
  const router = useRouter();
  const { user, refresh } = useCurrentUser();

  if (!user?.viewingAsCompany) return null;

  const handleExit = async () => {
    await fetch("/api/v1/admin/view-as", { method: "DELETE" });
    await refresh();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-xs font-bold print:hidden">
      <span className="flex items-center gap-1.5">
        <Eye className="w-3.5 h-3.5" />
        Visualizando como: {user.viewingAsCompany.name}
      </span>
      <button
        onClick={handleExit}
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 transition-colors cursor-pointer"
      >
        <X className="w-3 h-3" />
        Sair
      </button>
    </div>
  );
}
