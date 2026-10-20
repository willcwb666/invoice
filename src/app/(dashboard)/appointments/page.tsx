"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Rota legada de atendimentos: Redireciona automaticamente para a tela canônica /agenda,
 * evitando duplicação de interface e garantindo que o operador utilize a visualização
 * integrada em tempo real com o iCloud e equipe.
 */
export default function AppointmentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/agenda");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      <p className="text-xs font-semibold">Redirecionando para a Agenda...</p>
    </div>
  );
}
