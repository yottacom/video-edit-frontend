'use client';

import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react';

type ToastVariant = 'error' | 'success' | 'info';

interface ToastProps {
  open: boolean;
  variant?: ToastVariant;
  title?: string;
  message: string;
  onClose: () => void;
}

const variantStyles: Record<ToastVariant, string> = {
  error: 'border-red-500/30 bg-red-500/12 text-red-100',
  success: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-100',
  info: 'border-violet-500/30 bg-violet-500/12 text-violet-100',
};

const iconStyles: Record<ToastVariant, string> = {
  error: 'text-red-300',
  success: 'text-emerald-300',
  info: 'text-violet-300',
};

function getToastIcon(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return <CheckCircle2 className={`h-5 w-5 ${iconStyles[variant]}`} />;
    case 'info':
      return <Info className={`h-5 w-5 ${iconStyles[variant]}`} />;
    case 'error':
    default:
      return <AlertCircle className={`h-5 w-5 ${iconStyles[variant]}`} />;
  }
}

export function Toast({
  open,
  variant = 'info',
  title,
  message,
  onClose,
}: ToastProps) {
  return (
    <div
      className={`pointer-events-none fixed right-4 top-4 z-[80] transition-all duration-300 sm:right-6 sm:top-6 ${
        open ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={`pointer-events-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border shadow-2xl backdrop-blur-xl ${variantStyles[variant]}`}
        role={variant === 'error' ? 'alert' : 'status'}
      >
        <div className="flex items-start gap-3 p-4">
          <div className="mt-0.5 flex-shrink-0">
            {getToastIcon(variant)}
          </div>

          <div className="min-w-0 flex-1">
            {title ? (
              <p className="text-sm font-semibold text-white">{title}</p>
            ) : null}
            <p className={`text-sm ${title ? 'mt-1' : ''}`}>{message}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
