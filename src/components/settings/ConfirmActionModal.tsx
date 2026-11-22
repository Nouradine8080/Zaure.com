import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, ShieldAlert, X } from 'lucide-react';

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary' | 'warning';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export default function ConfirmActionModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
  children
}: ConfirmActionModalProps) {
  if (!isOpen) return null;

  const iconBg =
    tone === 'danger'
      ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
      : tone === 'warning'
      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
      : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400';

  const btnStyle =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : tone === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white';

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={() => !isLoading && onCancel()}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
            {tone === 'primary' ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-950 dark:text-white">
            {title}
          </h3>
          <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
            {description}
          </p>
        </div>

        {children}

        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`flex-1 min-h-[44px] px-4 py-2 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 ${btnStyle}`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
