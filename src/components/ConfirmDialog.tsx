import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md surface-panel p-6"
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              destructive
                ? 'bg-rose-500/10 border-rose-500/25 text-rose-500'
                : 'bg-[#287BFF]/10 border-[#287BFF]/25 text-[#287BFF]'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-[#A7B4C7] leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-[#1E3554] text-sm font-medium text-slate-700 dark:text-[#A7B4C7] hover:bg-slate-100 dark:hover:bg-[#0D1B30] transition-colors whitespace-nowrap shrink-0"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0 ${
              destructive
                ? 'bg-rose-600 hover:bg-rose-700 disabled:opacity-60'
                : 'bg-[#287BFF] hover:bg-blue-600 disabled:opacity-60'
            }`}
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
