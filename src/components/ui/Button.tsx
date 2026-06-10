'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variants = {
  primary:
    'bg-violet-600 hover:bg-violet-500 text-white ring-1 ring-inset ring-white/10 shadow-sm shadow-violet-950/40',
  secondary:
    'bg-white/[0.06] hover:bg-white/[0.1] text-white ring-1 ring-inset ring-white/10',
  outline:
    'ring-1 ring-inset ring-white/15 hover:bg-white/[0.05] text-slate-200',
  ghost: 'hover:bg-white/[0.06] text-slate-300',
  danger: 'bg-red-600 hover:bg-red-500 text-white ring-1 ring-inset ring-white/10',
};

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center gap-2 rounded-xl font-medium tracking-tight
          transition-all duration-200 ease-out select-none
          active:scale-[0.98]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0d]
          disabled:opacity-50 disabled:pointer-events-none
          ${variants[variant]}
          ${sizes[size]}
          ${className}
        `}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
