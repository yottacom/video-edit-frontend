'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Scissors, Check } from 'lucide-react';

function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40">
        <Scissors className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-[#0a0a0d]" />
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-white">
        neural<span className="text-violet-400">Cut</span>
      </span>
    </Link>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#0a0a0d] lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden border-r border-white/[0.06] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-600/15 blur-[120px]" />
          <div className="absolute right-10 top-1/3 h-72 w-72 rounded-full bg-amber-500/[0.07] blur-[110px]" />
        </div>

        <div className="relative">
          <Brand />
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-white">
            From raw clips to{' '}
            <span className="bg-gradient-to-r from-violet-300 to-amber-200 bg-clip-text text-transparent">
              scroll-stopping
            </span>{' '}
            shorts &amp; ads.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-400">
            The AI-native video studio for brands and studios. Edit, caption, and
            ship in minutes — not days.
          </p>
          <ul className="mt-8 space-y-3">
            {['AI shorts & ad drafts', 'Frame-perfect subtitles', 'Smart B-roll & scene detection'].map((t) => (
              <li key={t} className="flex items-center gap-3 text-slate-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-sm text-slate-600">© 2026 neuralCut. Crafted for the cut.</div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="pointer-events-none absolute inset-0 lg:hidden">
          <div className="absolute left-1/4 top-0 h-80 w-80 rounded-full bg-violet-600/15 blur-[120px]" />
        </div>

        <div className="relative w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="mt-1.5 text-slate-400">{subtitle}</p>

          <div className="mt-8">{children}</div>

          <div className="mt-7 text-center text-sm text-slate-400">{footer}</div>
        </div>
      </div>
    </div>
  );
}
