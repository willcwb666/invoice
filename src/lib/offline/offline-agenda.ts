"use client";

/**
 * Offline Agenda & Sync Manager - Renata Matos Cleaning Services
 * Permite que a equipe consulte, crie e altere agendamentos em áreas sem cobertura de internet
 * (porões, estradas rurais do Colorado, etc.), sincronizando automaticamente com o backend
 * assim que o sinal for restabelecido.
 */

const STORAGE_KEYS = {
  APPOINTMENTS: "rm_offline_appointments",
  CLIENTS: "rm_offline_clients",
  SYNC_QUEUE: "rm_offline_sync_queue",
  LAST_CACHED_AT: "rm_offline_last_cached_at",
};

export interface QueuedSyncItem {
  id: string; // ID da fila
  tempId?: string; // ID temporário do appointment se foi criado offline
  appointmentId?: string; // ID do appointment no backend se for UPDATE
  action: "CREATE" | "UPDATE" | "DELETE";
  payload: any;
  createdAt: string;
  attempts?: number; // Nº de tentativas de sync que já falharam com erro do servidor (5xx)
}

const MAX_SERVER_ERROR_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// 1. Armazenamento Local de Agendamentos e Clientes
// ---------------------------------------------------------------------------

// Janela de retenção do cache offline: contas antigas acumulam milhares de
// agendamentos históricos, e sobrescrever a lista inteira a cada atualização
// cresce sem limite até esgotar a cota do localStorage num aparelho com pouco
// espaço. Mantém só o que é relevante para trabalho em campo: passado recente
// + futuro próximo.
const CACHE_PAST_DAYS = 14;
const CACHE_FUTURE_DAYS = 90;
const CACHE_HARD_CAP = 500;

function withinCacheWindow(appt: any): boolean {
  const raw = appt?.date || appt?.startTime;
  if (!raw) return true; // sem data identificável — mantém por segurança
  const d = new Date(raw).getTime();
  if (Number.isNaN(d)) return true;
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  return d >= now - CACHE_PAST_DAYS * DAY && d <= now + CACHE_FUTURE_DAYS * DAY;
}

/**
 * Tenta gravar no localStorage; se a cota for excedida, reduz o array pela
 * metade e tenta de novo (até esgotar as tentativas) em vez de perder a
 * escrita em silêncio. Retorna se a gravação (completa ou reduzida) deu certo.
 */
function writeArraySafely(key: string, items: any[]): boolean {
  let data = items;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (err) {
      const isQuotaError =
        err instanceof DOMException &&
        (err.name === "QuotaExceededError" || err.code === 22);
      if (!isQuotaError || data.length <= 1) {
        console.warn(`Falha ao salvar "${key}" no cache local:`, err);
        return false;
      }
      data = data.slice(0, Math.ceil(data.length / 2));
    }
  }
  return false;
}

export function saveCachedAppointments(appointments: any[]): boolean {
  if (typeof window === "undefined") return false;
  const bounded = appointments.filter(withinCacheWindow).slice(0, CACHE_HARD_CAP);
  const ok = writeArraySafely(STORAGE_KEYS.APPOINTMENTS, bounded);
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_CACHED_AT, new Date().toISOString());
  } catch {}
  return ok;
}

export function getCachedAppointments(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Falha ao ler agendamentos do cache local:", err);
    return [];
  }
}

export function saveCachedClients(clients: any[]): boolean {
  if (typeof window === "undefined") return false;
  return writeArraySafely(STORAGE_KEYS.CLIENTS, clients);
}

export function getCachedClients(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 2. Fila de Sincronização Offline (Sync Queue)
// ---------------------------------------------------------------------------

export function getOfflineSyncQueue(): QueuedSyncItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToOfflineSyncQueue(
  action: "CREATE" | "UPDATE" | "DELETE",
  payload: any,
  appointmentId?: string
): QueuedSyncItem {
  const queue = getOfflineSyncQueue();
  const tempId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const item: QueuedSyncItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tempId: action === "CREATE" ? tempId : undefined,
    appointmentId,
    action,
    payload,
    createdAt: new Date().toISOString(),
  };

  queue.push(item);
  try {
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
  } catch (e) {
    console.error("Erro ao salvar fila offline:", e);
  }

  // Atualiza também o cache local imediatamente para refletir na interface sem delay
  const cached = getCachedAppointments();
  if (action === "CREATE") {
    const newLocalAppt = {
      ...payload,
      id: tempId,
      isOfflinePending: true,
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
    };
    saveCachedAppointments([newLocalAppt, ...cached]);
  } else if (action === "UPDATE" && appointmentId) {
    const updated = cached.map((a) =>
      a.id === appointmentId ? { ...a, ...payload, isOfflinePending: true } : a
    );
    saveCachedAppointments(updated);
  }

  return item;
}

export function removeOfflineSyncItem(id: string): void {
  const queue = getOfflineSyncQueue().filter((item) => item.id !== id);
  try {
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
  } catch (e) {
    console.error("Erro ao atualizar fila offline:", e);
  }
}

function incrementOfflineSyncAttempts(id: string): number {
  const queue = getOfflineSyncQueue();
  let attempts = 0;
  const updated = queue.map((item) => {
    if (item.id !== id) return item;
    attempts = (item.attempts || 0) + 1;
    return { ...item, attempts };
  });
  try {
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(updated));
  } catch (e) {
    console.error("Erro ao atualizar fila offline:", e);
  }
  return attempts;
}

export function clearOfflineSyncQueue(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
  } catch {}
}

// ---------------------------------------------------------------------------
// 3. Executor da Sincronização com o Backend
// ---------------------------------------------------------------------------

export interface DiscardedSyncItem {
  title: string;
  reason: string;
}

export async function processOfflineSyncQueue(): Promise<{
  successCount: number;
  failedCount: number;
  rejectedCount: number;
  discarded: DiscardedSyncItem[];
}> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { successCount: 0, failedCount: 0, rejectedCount: 0, discarded: [] };
  }

  const queue = getOfflineSyncQueue();
  if (queue.length === 0) return { successCount: 0, failedCount: 0, rejectedCount: 0, discarded: [] };

  let successCount = 0;
  let failedCount = 0;
  let rejectedCount = 0;
  const discarded: DiscardedSyncItem[] = [];
  const itemTitle = (item: QueuedSyncItem) => item.payload?.title || "Agendamento sem título";

  for (const item of queue) {
    try {
      let url = "/api/v1/appointments";
      let method = "POST";

      if (item.action === "UPDATE" && item.appointmentId) {
        url = `/api/v1/appointments/${item.appointmentId}`;
        method = "PATCH";
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });

      if (res.ok) {
        removeOfflineSyncItem(item.id);
        successCount++;
      } else if (res.status >= 400 && res.status < 500) {
        // Erro do cliente (validação, referência inválida, etc.) nunca vai
        // ter sucesso em uma nova tentativa — manter na fila só a mantém
        // presa aqui para sempre. Descarta e reporta como rejeitado.
        const json = await res.json().catch(() => null);
        removeOfflineSyncItem(item.id);
        rejectedCount++;
        discarded.push({ title: itemTitle(item), reason: json?.error || `Rejeitado pelo servidor (HTTP ${res.status})` });
      } else {
        // Erro do servidor (5xx) pode ser transitório — tenta de novo até
        // um limite, depois desiste e reporta como rejeitado.
        const attempts = incrementOfflineSyncAttempts(item.id);
        if (attempts >= MAX_SERVER_ERROR_ATTEMPTS) {
          removeOfflineSyncItem(item.id);
          rejectedCount++;
          discarded.push({
            title: itemTitle(item),
            reason: `Erro persistente do servidor após ${attempts} tentativas (HTTP ${res.status})`,
          });
        } else {
          failedCount++;
        }
      }
    } catch {
      failedCount++;
      // Sem internet real, para o loop e aguarda próxima tentativa
      break;
    }
  }

  return { successCount, failedCount, rejectedCount, discarded };
}
