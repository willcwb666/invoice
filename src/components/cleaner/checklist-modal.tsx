"use client";

import React, { useState, useEffect } from "react";
import { X, CheckCircle2, Circle, Plus, Sparkles, Loader2 } from "lucide-react";

interface ChecklistItem {
  id: string;
  room: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
}

interface ChecklistModalProps {
  appointmentId: string;
  clientName: string;
  onClose: () => void;
}

export function ChecklistModal({ appointmentId, clientName, onClose }: ChecklistModalProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("Todos");
  const [newTitle, setNewTitle] = useState("");
  const [newRoom, setNewRoom] = useState("Cozinha");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    async function loadChecklist() {
      try {
        const res = await fetch(`/api/v1/appointments/${appointmentId}/checklists`);
        if (res.ok) {
          const json = await res.json();
          setItems(json.data || []);
        }
      } catch (err) {
        console.error("Erro ao carregar checklist:", err);
      } finally {
        setLoading(false);
      }
    }
    loadChecklist();
  }, [appointmentId]);

  const toggleItem = async (item: ChecklistItem) => {
    const nextCompleted = !item.completed;
    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, completed: nextCompleted, completedAt: nextCompleted ? new Date().toISOString() : null }
          : i
      )
    );

    try {
      await fetch(`/api/v1/appointments/${appointmentId}/checklists`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, completed: nextCompleted }),
      });
    } catch (err) {
      console.error("Erro ao alternar item:", err);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/v1/appointments/${appointmentId}/checklists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: newRoom, title: newTitle.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        setItems((prev) => [...prev, json.data]);
        setNewTitle("");
      }
    } catch (err) {
      console.error("Erro ao adicionar item:", err);
    } finally {
      setAdding(false);
    }
  };

  const rooms = ["Todos", ...Array.from(new Set(items.map((i) => i.room)))];
  const filtered = activeTab === "Todos" ? items : items.filter((i) => i.room === activeTab);
  const completedCount = items.filter((i) => i.completed).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <h2 className="font-bold text-slate-900 text-base">Checklist por Cômodo</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{clientName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-5 py-3 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className="text-slate-600">
              Progresso ({completedCount} de {items.length} itens)
            </span>
            <span className="text-teal-600 font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Room Filter Pills */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-slate-50/40">
          {rooms.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setActiveTab(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === r
                  ? "bg-teal-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              <span className="text-xs">Carregando tarefas...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Nenhuma tarefa cadastrada neste cômodo.
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleItem(item)}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  item.completed
                    ? "bg-teal-50/50 border-teal-200/80 text-teal-900"
                    : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                }`}
              >
                <div className="mt-0.5">
                  {item.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-teal-600 fill-teal-100 shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 shrink-0" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {item.room}
                    </span>
                  </div>
                  <p
                    className={`text-xs mt-1 font-medium leading-relaxed ${
                      item.completed ? "line-through text-slate-400" : "text-slate-800"
                    }`}
                  >
                    {item.title}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Item Form */}
        <form onSubmit={handleAddItem} className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center gap-2">
          <select
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
            className="text-xs font-semibold px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 shrink-0"
          >
            <option value="Cozinha">Cozinha</option>
            <option value="Banheiros">Banheiros</option>
            <option value="Quartos">Quartos</option>
            <option value="Sala / Geral">Sala / Geral</option>
            <option value="Outro">Outro</option>
          </select>
          <input
            type="text"
            placeholder="Nova tarefa (ex: Limpar espelho)..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-teal-500"
          />
          <button
            type="submit"
            disabled={adding || !newTitle.trim()}
            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shrink-0 transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
          >
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>Adicionar</span>
          </button>
        </form>
      </div>
    </div>
  );
}
