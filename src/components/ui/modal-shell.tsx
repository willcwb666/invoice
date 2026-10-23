"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * Shared chrome for the app's create/edit dialogs (client, service,
 * estimate, appointment, payment, send) — the AnimatePresence + backdrop +
 * panel + icon/title/close-button header that was previously copy-pasted
 * into each one. The six modals never fully agreed on exact spacing/sizing
 * (payment/send use a smaller title and no header divider, appointment
 * scrolls its body internally instead of the whole panel), so every visual
 * detail is a prop with the most common values as defaults — each caller
 * passes only what actually differs from its neighbors, and the visual
 * output for existing callers is unchanged from before this component
 * existed.
 */
export interface ModalShellProps {
  isOpen: boolean;
  /** Called when the close (X) button is clicked. Wrap it yourself if the caller also needs to reset form state. */
  onClose: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;

  /** Outer fixed-position backdrop. */
  backdropClassName?: string;
  /** The animated white panel itself. */
  panelClassName?: string;
  /** Row containing the icon+title group and the close button. */
  headerRowClassName?: string;
  /** Wraps the icon box + title/subtitle stack. */
  headerLeftClassName?: string;
  /** The colored icon box. */
  iconWrapperClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  closeButtonClassName?: string;
  closeIconClassName?: string;
}

const DEFAULTS = {
  backdrop:
    "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto",
  panel:
    "w-full max-w-xl sm:max-w-2xl md:max-w-3xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200/90 my-8 space-y-6",
  headerRow: "flex items-center justify-between border-b border-slate-100 pb-4",
  headerLeft: "flex items-center gap-3",
  iconWrapper: "p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80",
  title: "text-base font-bold text-slate-900",
  subtitle: "text-xs text-slate-500",
  closeButton: "p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer",
  closeIcon: "w-5 h-5",
};

export function ModalShell({
  isOpen,
  onClose,
  icon,
  title,
  subtitle,
  children,
  backdropClassName = DEFAULTS.backdrop,
  panelClassName = DEFAULTS.panel,
  headerRowClassName = DEFAULTS.headerRow,
  headerLeftClassName = DEFAULTS.headerLeft,
  iconWrapperClassName = DEFAULTS.iconWrapper,
  titleClassName = DEFAULTS.title,
  subtitleClassName = DEFAULTS.subtitle,
  closeButtonClassName = DEFAULTS.closeButton,
  closeIconClassName = DEFAULTS.closeIcon,
}: ModalShellProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className={backdropClassName}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className={panelClassName}
          >
            <div className={headerRowClassName}>
              <div className={headerLeftClassName}>
                <div className={iconWrapperClassName}>{icon}</div>
                <div>
                  <h3 className={titleClassName}>{title}</h3>
                  {subtitle && <p className={subtitleClassName}>{subtitle}</p>}
                </div>
              </div>

              <button type="button" onClick={onClose} className={closeButtonClassName}>
                <X className={closeIconClassName} />
              </button>
            </div>

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
