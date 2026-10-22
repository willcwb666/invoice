"use client";

import React, { useState } from "react";
import { Bell, BellOff, BellRing, CheckCircle2, AlertTriangle, Smartphone, Send, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/lib/hooks/use-push-notifications";
import { useToast } from "@/components/ui/toast";

export function PushPermissionCard() {
  const { isSupported, isSubscribed, permission, loading, error, subscribe, unsubscribe } =
    usePushNotifications();
  const { showToast } = useToast();
  const [testing, setTesting] = useState(false);

  const handleToggle = async () => {
    if (isSubscribed) {
      const ok = await unsubscribe();
      if (ok) {
        showToast("Notificações push desativadas neste aparelho.", "info");
      }
    } else {
      const ok = await subscribe();
      if (ok) {
        showToast("Notificações push ativadas com sucesso!", "success");
      }
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      if ("serviceWorker" in navigator && isSubscribed) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("Teste de Notificação Push", {
          body: "As notificações do Renata Matos Cleaning Services estão funcionando perfeitamente!",
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-72x72.png",
          data: { url: "/agenda" },
        });
        showToast("Notificação de teste exibida!", "success");
      } else {
        showToast("Ative as notificações antes de testar.", "warning");
      }
    } catch (err: any) {
      showToast(err?.message || "Erro ao exibir notificação de teste.", "error");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex items-center justify-center space-x-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
        <span>Verificando suporte a notificações push...</span>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-6 text-amber-900">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-base text-amber-950">Notificações Push não suportadas</h3>
            <p className="text-sm text-amber-800 mt-1 leading-relaxed">
              Este navegador ou dispositivo não possui suporte à API de Web Push. Se você estiver usando um
              iPhone/iPad (iOS), adicione este sistema à sua <strong>Tela de Início</strong> (toque no botão
              Compartilhar e selecione &quot;Adicionar à Tela de Início&quot;) para liberar as notificações.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center space-x-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isSubscribed ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
              }`}
            >
              {isSubscribed ? <BellRing className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-slate-900">Notificações Push no Celular</h3>
                {isSubscribed && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Ativo
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {isSubscribed
                  ? "Este aparelho está registrado para receber avisos da rotina em campo."
                  : "Ative para receber avisos de agenda, horários e alertas de saída."}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isSubscribed && (
              <button
                type="button"
                onClick={handleTestNotification}
                disabled={testing}
                className="inline-flex items-center px-3.5 py-2 border border-slate-200 text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm"
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-1.5 text-slate-500" />
                )}
                Testar
              </button>
            )}

            <button
              type="button"
              onClick={handleToggle}
              disabled={permission === "denied"}
              className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-xl shadow-sm transition ${
                isSubscribed
                  ? "border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100"
                  : "border-transparent text-white bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {isSubscribed ? (
                <>
                  <BellOff className="w-4 h-4 mr-1.5" /> Desativar
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 mr-1.5" /> Ativar Push
                </>
              )}
            </button>
          </div>
        </div>

        {permission === "denied" && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>
              As notificações estão bloqueadas nas configurações do seu navegador. Para reativar, clique no cadeado
              na barra de endereço e permita o envio de notificações.
            </span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
            {error}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center space-x-2 text-indigo-600 font-semibold text-sm">
              <span className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-xs">
                6h
              </span>
              <span>Resumo Matinal</span>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Receba pontualmente às 6:00 da manhã a lista de atendimentos do dia, cliente inicial e cidade.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center space-x-2 text-emerald-600 font-semibold text-sm">
              <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-xs">
                ⚡
              </span>
              <span>Alterações em Tempo Real</span>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Notificação imediata se um cliente reagendar o horário, novo serviço for adicionado ou cancelado.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center space-x-2 text-amber-600 font-semibold text-sm">
              <span className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-xs">
                30m
              </span>
              <span>Alerta de Deslocamento</span>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Calcula o trajeto e avisa 30 minutos antes do momento ideal de saída para o próximo cliente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
