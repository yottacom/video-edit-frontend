'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-slate-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full h-11 px-4 rounded-xl
            bg-white/[0.03] border border-white/[0.08]
            text-white placeholder-slate-500
            transition-all duration-200 ease-out
            focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 focus:bg-white/[0.05]
            ${error ? 'border-red-500/70 focus:border-red-500/70 focus:ring-red-500/20' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
