"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckCircle2, XCircle, Info, X, Trash2, HelpCircle } from "lucide-react";

type ToastVariant = "success" | "error" | "info" | "confirm-delete" | "confirm-action";

interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  duration: number; // ms
  onConfirm?: () => void;
}

interface ToastContextValue {
  showToast: (message: string, variant?: "success" | "error" | "info", duration?: number) => void;
  /** Shows a toast with a shrinking countdown bar; if not cancelled before it runs out, calls onConfirm. */
  confirmDelete: (message: string, onConfirm: () => void, duration?: number) => void;
  /** Same countdown-and-cancel pattern as confirmDelete, for non-destructive but consequential actions. */
  confirmAction: (message: string, onConfirm: () => void, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de um ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: "success" | "error" | "info" = "info", duration = 4000) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, variant, message, duration }]);
    },
    []
  );

  const confirmDelete = useCallback(
    (message: string, onConfirm: () => void, duration = 5000) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, variant: "confirm-delete", message, duration, onConfirm }]);
    },
    []
  );

  const confirmAction = useCallback(
    (message: string, onConfirm: () => void, duration = 5000) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, variant: "confirm-action", message, duration, onConfirm }]);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast, confirmDelete, confirmAction }}>
      {children}
      <div className="fixed bottom-4 right-4 z-100 flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-full max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard toast={t} onDismiss={() => remove(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const VARIANT_STYLES: Record<
  ToastVariant,
  { bg: string; bar: string; icon: React.ElementType; iconColor: string }
> = {
  success: { bg: "bg-emerald-50 border-emerald-200 text-emerald-800", bar: "bg-emerald-500", icon: CheckCircle2, iconColor: "text-emerald-600" },
  error: { bg: "bg-rose-50 border-rose-200 text-rose-800", bar: "bg-rose-500", icon: XCircle, iconColor: "text-rose-600" },
  info: { bg: "bg-slate-50 border-slate-200 text-slate-800", bar: "bg-indigo-500", icon: Info, iconColor: "text-indigo-600" },
  "confirm-delete": { bg: "bg-white border-slate-200 text-slate-900", bar: "bg-rose-500", icon: Trash2, iconColor: "text-rose-600" },
  "confirm-action": { bg: "bg-white border-slate-200 text-slate-900", bar: "bg-indigo-500", icon: HelpCircle, iconColor: "text-indigo-600" },
};

const CONFIRM_VARIANTS: ToastVariant[] = ["confirm-delete", "confirm-action"];

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [progress, setProgress] = useState(100);
  const [paused, setPaused] = useState(false);
  const startRef = useRef(Date.now());
  const remainingRef = useRef(toast.duration);
  const confirmedRef = useRef(false);

  useEffect(() => {
    if (paused) return;
    startRef.current = Date.now();
    let raf: number;

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, remainingRef.current - elapsed);
      setProgress((remaining / toast.duration) * 100);

      if (remaining <= 0) {
        if (CONFIRM_VARIANTS.includes(toast.variant) && !confirmedRef.current) {
          confirmedRef.current = true;
          toast.onConfirm?.();
        }
        onDismiss();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const handleMouseEnter = () => {
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startRef.current));
    setPaused(true);
  };
  const handleMouseLeave = () => setPaused(false);

  const { bg, bar, icon: Icon, iconColor } = VARIANT_STYLES[toast.variant];

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-2xl border shadow-lg p-4 pr-3 ${bg}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-snug">{toast.message}</p>
          {CONFIRM_VARIANTS.includes(toast.variant) && (
            <button
              type="button"
              onClick={onDismiss}
              className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
            >
              Cancelar
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 shrink-0 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Countdown bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5">
        <div className={`h-full ${bar}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
