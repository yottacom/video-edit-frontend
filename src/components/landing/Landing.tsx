'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Scissors,
  Sparkles,
  Captions,
  Film,
  LayoutGrid,
  Music,
  Wand2,
  Play,
  Check,
  Star,
  MoveHorizontal,
  Heart,
  MessageCircle,
  Share2,
  Flame,
} from 'lucide-react';

/* ================================================================== */
/*  Hooks & primitives                                                */
/* ================================================================== */

/** Shared IntersectionObserver — adds `.nc-in` to every `.nc-reveal`. */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('.nc-reveal'));
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('nc-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('nc-in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

const d = (ms: number) => ({ '--nc-delay': `${ms}ms` } as CSSProperties);

/** A link that subtly leans toward the cursor. */
function Magnetic({
  href,
  className,
  children,
  strength = 0.2,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  strength?: number;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const move = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) * strength;
    const y = (e.clientY - (r.top + r.height / 2)) * strength * 1.4;
    el.style.transform = `translate(${x}px, ${y}px)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = '';
  };
  return (
    <Link
      ref={ref}
      href={href}
      onMouseMove={move}
      onMouseLeave={reset}
      className={className}
      style={{ transition: 'transform 0.25s cubic-bezier(0.2,0.8,0.2,1)' }}
    >
      {children}
    </Link>
  );
}

/* ================================================================== */
/*  Data                                                              */
/* ================================================================== */

const STUDIOS = [
  'NORTHWIND', 'Lumen Studios', 'OFFAXIS', 'Pixelhaus', 'VANTA',
  'Cabin Films', 'HALO/MEDIA', 'Greyscale', 'Æther', 'Studio Nine',
];

const FEATURES = [
  { icon: Sparkles, title: 'AI Ad Studio', tag: 'creative', body: 'Generate high-converting ad creatives from one brief — on-brand hooks, variations, and aspect ratios in a single pass.' },
  { icon: Captions, title: 'Frame-perfect Subtitles', tag: 'captions', body: 'Word-by-word captions with animated styles, brand fonts, and 50+ languages. Edit once, render everywhere.' },
  { icon: Film, title: 'Smart B-roll', tag: 'b-roll', body: 'neuralCut reads your script and weaves in relevant footage and cutaways at exactly the right beat.' },
  { icon: LayoutGrid, title: 'Scene Intelligence', tag: 'scenes', body: 'Automatic scene detection turns raw takes into a clean, navigable timeline you can reshape in seconds.' },
  { icon: Music, title: 'Sound & Score', tag: 'audio', body: 'Licensed music, auto-ducking, and AI sound design that sits perfectly under your voice — no keyframing.' },
];

const STEPS = [
  { n: '01', title: 'Upload your footage', body: 'Raw clips, screen recordings, podcasts, ad assets — anything. We ingest and analyze every frame.' },
  { n: '02', title: 'Let the AI cut', body: 'neuralCut drafts scenes, captions, B-roll, and a score. You direct from a full pro timeline.' },
  { n: '03', title: 'Publish everywhere', body: 'Render studio-grade shorts and ads in every aspect ratio, then ship straight to your channels.' },
];

const STATS = [
  { v: '10M+', l: 'videos rendered' },
  { v: '70%', l: 'faster to publish' },
  { v: '120+', l: 'studios on board' },
  { v: '4.9', l: 'average rating' },
];

const SHORTS = [
  { g: 'from-violet-600 via-fuchsia-600 to-indigo-800', handle: '@northwind', cap: ['this changed', 'everything'], hot: 5, likes: '128k', comments: '2.4k', time: '0:08', trending: true },
  { g: 'from-amber-500 via-orange-600 to-rose-700', handle: '@offaxis', cap: ['the secret', 'nobody tells you'], hot: 9, likes: '94k', comments: '1.1k', time: '0:15', trending: false },
  { g: 'from-indigo-600 via-violet-700 to-fuchsia-800', handle: '@lumen', cap: ['watch till', 'the end'], hot: 1, likes: '212k', comments: '5.6k', time: '0:30', trending: true },
  { g: 'from-emerald-600 via-teal-700 to-cyan-800', handle: '@vanta', cap: ['we tried it', 'so you don’t'], hot: 6, likes: '76k', comments: '880', time: '0:12', trending: false },
];

/* ================================================================== */
/*  Brand mark                                                        */
/* ================================================================== */

function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
        <Scissors className="h-4 w-4 text-white" strokeWidth={2.5} />
        <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-[#050506]" />
      </span>
      <span className="nc-display text-lg tracking-tight text-white">
        neural<span className="text-violet-400">Cut</span>
      </span>
    </span>
  );
}

/* ================================================================== */
/*  Hero editor mockup                                                */
/* ================================================================== */

function EditorMockup() {
  return (
    <div className="nc-float relative">
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b10]/90 backdrop-blur-xl"
        style={{ boxShadow: '0 40px 130px -30px rgba(99,102,241,0.5)' }}
      >
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]/80" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]/80" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]/80" />
          <span className="nc-mono ml-3 text-[11px] text-white/40">brand_launch_v4.ncut</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1">
            <span className="nc-pulse h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="nc-mono text-[10px] uppercase tracking-wider text-amber-300">rendering</span>
          </span>
        </div>

        {/* preview canvas */}
        <div className="relative aspect-[16/9] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(139,92,246,0.45),transparent_55%),radial-gradient(circle_at_78%_82%,rgba(245,178,90,0.32),transparent_55%)]" />
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {['hook detected', 'face-track', 'beat sync'].map((t) => (
              <span key={t} className="nc-mono rounded-md border border-violet-400/30 bg-violet-500/15 px-2 py-1 text-[10px] text-violet-200 backdrop-blur">
                {t}
              </span>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md">
              <Play className="h-6 w-6 translate-x-0.5 fill-white text-white" />
            </div>
          </div>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-lg bg-black/55 px-3 py-1.5 backdrop-blur">
            <span className="nc-display text-sm text-white">
              this is <span className="nc-amber-text">unreasonably</span> good
            </span>
          </div>
          <div className="absolute bottom-5 right-5 flex h-8 items-end gap-1">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="nc-eq-bar w-1 rounded-full bg-gradient-to-t from-violet-500 to-amber-300" style={{ height: '100%', animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        </div>

        {/* timeline */}
        <div className="relative space-y-2.5 border-t border-white/8 bg-[#08080c] p-4">
          <div className="nc-playhead absolute top-2 bottom-2 z-10 w-px bg-amber-300/80 shadow-[0_0_12px_2px_rgba(245,178,90,0.6)]">
            <span className="absolute -top-1 -left-[3px] h-1.5 w-1.5 rounded-full bg-amber-300" />
          </div>
          {[
            { label: 'V1', segs: [['w-[26%]', 'from-violet-500/70 to-violet-600/40'], ['w-[18%]', 'from-indigo-500/70 to-indigo-600/40'], ['w-[34%]', 'from-violet-500/70 to-fuchsia-600/40']] },
            { label: 'B', segs: [['w-[14%]', 'from-amber-500/50 to-amber-600/30'], ['w-[22%]', 'from-amber-500/50 to-orange-600/30'], ['w-[20%]', 'from-amber-500/50 to-rose-600/30']] },
          ].map((track) => (
            <div key={track.label} className="flex items-center gap-3">
              <span className="nc-mono w-5 text-[10px] text-white/30">{track.label}</span>
              <div className="flex h-7 flex-1 gap-1.5">
                {track.segs.map(([w, g], i) => (
                  <div key={i} className={`${w} h-full rounded-md bg-gradient-to-r ${g} ring-1 ring-white/10`} />
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <span className="nc-mono w-5 text-[10px] text-white/30">A</span>
            <div className="flex h-7 flex-1 items-center gap-[3px] rounded-md bg-white/[0.03] px-2 ring-1 ring-white/8">
              {Array.from({ length: 60 }).map((_, i) => (
                <span key={i} className="w-[2px] rounded-full bg-violet-300/40" style={{ height: `${20 + Math.abs(Math.sin(i * 0.9)) * 70}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -right-4 -top-4 hidden rounded-xl border border-white/10 bg-[#0b0b10]/90 px-4 py-3 shadow-xl backdrop-blur-xl sm:block">
        <div className="flex items-center gap-2.5">
          <Wand2 className="h-4 w-4 text-amber-300" />
          <div>
            <div className="nc-mono text-[10px] uppercase tracking-wider text-white/40">AI draft</div>
            <div className="text-sm font-semibold text-white">8 shorts ready</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Signature: before / after compare slider                          */
/* ================================================================== */

function CompareSlider() {
  const [pos, setPos] = useState(44);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const apply = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = ((clientX - r.left) / r.width) * 100;
    setPos(Math.min(95, Math.max(5, p)));
  };

  return (
    <div
      ref={ref}
      className="nc-compare-handle relative aspect-[16/10] w-full select-none overflow-hidden rounded-2xl border border-white/10 bg-black"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        apply(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && apply(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* AFTER — the finished, graded cut (full bleed, underneath) */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-fuchsia-700 to-amber-600" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(255,255,255,0.25),transparent_55%)]" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/30 px-2.5 py-1 backdrop-blur">
          <span className="nc-pulse h-1.5 w-1.5 rounded-full bg-amber-300" />
          <span className="nc-mono text-[10px] uppercase tracking-wider text-white">final · 00:08 · post-ready</span>
        </div>
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/55 px-3 py-1.5 backdrop-blur">
          <span className="nc-display text-base text-white sm:text-lg">
            and that’s the <span className="nc-amber-text">whole</span> point
          </span>
        </div>
        {/* clean cut timeline */}
        <div className="absolute inset-x-4 bottom-4 flex h-6 gap-1.5">
          {['w-[30%]', 'w-[22%]', 'w-[28%]', 'w-[20%]'].map((w, i) => (
            <div key={i} className={`${w} rounded bg-white/85 ring-1 ring-black/10`} />
          ))}
        </div>
      </div>

      {/* BEFORE — raw, desaturated footage (clipped from the left) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-700 via-neutral-800 to-neutral-900" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_30%,rgba(120,120,130,0.4),transparent_60%)] grayscale" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          <span className="nc-mono text-[10px] uppercase tracking-wider text-white/60">raw · 02:14:08 · 142 takes</span>
        </div>
        <div className="absolute bottom-14 left-6 text-white/30">
          <span className="nc-mono text-xs">no captions · no cuts · no score</span>
        </div>
        {/* messy long timeline */}
        <div className="absolute inset-x-4 bottom-4 flex h-6 gap-[3px] overflow-hidden">
          {Array.from({ length: 26 }).map((_, i) => (
            <div key={i} className="flex-1 rounded-[2px] bg-neutral-500/40 ring-1 ring-white/5" style={{ opacity: 0.4 + (i % 4) * 0.12 }} />
          ))}
        </div>
      </div>

      {/* divider + handle */}
      <div className="pointer-events-none absolute inset-y-0 z-20" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -left-px w-0.5 bg-white/90 shadow-[0_0_18px_2px_rgba(255,255,255,0.4)]" />
        <div className="absolute top-1/2 left-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/15 backdrop-blur-md">
          <MoveHorizontal className="h-5 w-5 text-white" />
        </div>
      </div>

      {/* corner tags */}
      <span className="nc-mono absolute bottom-4 left-4 z-20 text-[10px] uppercase tracking-wider text-white/40 sm:hidden">drag</span>
    </div>
  );
}

/* ================================================================== */
/*  Real-feeling short-form frame                                     */
/* ================================================================== */

function ShortFrame({ s, style }: { s: (typeof SHORTS)[number]; style?: CSSProperties }) {
  return (
    <div
      className="nc-reveal group relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/10"
      style={style}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${s.g}`} />
      <div className="absolute inset-0 bg-[#06060a]/30 mix-blend-multiply" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(255,255,255,0.28),transparent_58%)]" />

      {/* top bar */}
      <div className="absolute inset-x-3 top-3 flex items-center gap-2">
        <span className="h-6 w-6 rounded-full bg-white/85 ring-2 ring-white/30" />
        <span className="text-xs font-semibold text-white drop-shadow">{s.handle}</span>
        <span className="nc-mono ml-auto rounded bg-black/35 px-1.5 py-0.5 text-[9px] text-white/90 backdrop-blur">{s.time}</span>
      </div>

      {/* AI badge */}
      <div className="absolute left-3 top-12 inline-flex items-center gap-1 rounded-md border border-amber-300/40 bg-black/30 px-1.5 py-0.5 backdrop-blur">
        <Wand2 className="h-3 w-3 text-amber-300" />
        <span className="nc-mono text-[9px] uppercase tracking-wide text-amber-200">AI cut</span>
      </div>
      {s.trending && (
        <div className="absolute right-3 top-12 inline-flex items-center gap-1 rounded-md bg-black/35 px-1.5 py-0.5 backdrop-blur">
          <Flame className="h-3 w-3 text-amber-400" />
          <span className="nc-mono text-[9px] uppercase tracking-wide text-white/90">trending</span>
        </div>
      )}

      {/* hover play */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/10 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:opacity-100">
          <Play className="h-4 w-4 translate-x-0.5 fill-white text-white" />
        </div>
      </div>

      {/* right action rail */}
      <div className="absolute bottom-16 right-2.5 flex flex-col items-center gap-3.5 text-white">
        <div className="flex flex-col items-center">
          <Heart className="h-5 w-5 fill-white/90 text-white drop-shadow" />
          <span className="nc-mono text-[9px]">{s.likes}</span>
        </div>
        <div className="flex flex-col items-center">
          <MessageCircle className="h-5 w-5 drop-shadow" />
          <span className="nc-mono text-[9px]">{s.comments}</span>
        </div>
        <Share2 className="h-5 w-5 drop-shadow" />
      </div>

      {/* burned caption */}
      <div className="absolute inset-x-3 bottom-7">
        <div className="nc-display text-lg leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
          {s.cap[0]}{' '}
          <span className="nc-word rounded bg-black/20 px-1">{s.cap[1]}</span>
        </div>
      </div>

      {/* progress bar */}
      <div className="absolute inset-x-3 bottom-3 h-1 overflow-hidden rounded-full bg-white/20">
        <div className="h-full w-2/3 rounded-full bg-white" />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Landing                                                           */
/* ================================================================== */

export function Landing({ isAuthenticated }: { isAuthenticated: boolean }) {
  const ref = useReveal();
  const heroRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  const primaryHref = isAuthenticated ? '/dashboard' : '/auth/register';
  const primaryLabel = isAuthenticated ? 'Open dashboard' : 'Start creating free';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const heroMove = (e: React.MouseEvent) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <div ref={ref} className="nc-root nc-grain min-h-screen">
      {/* ===================== NAV ===================== */}
      <header className="fixed inset-x-0 top-0 z-50 px-4">
        <div
          className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl border px-4 transition-all duration-300 sm:px-6 ${
            scrolled
              ? 'mt-3 border-white/10 bg-[#0a0a0d]/85 py-2.5 backdrop-blur-xl'
              : 'mt-4 border-white/6 bg-[#0a0a0d]/40 py-3.5 backdrop-blur-md'
          }`}
        >
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            {[
              ['The cut', '#the-cut'],
              ['Features', '#features'],
              ['Workflow', '#workflow'],
              ['Showcase', '#showcase'],
            ].map(([label, href]) => (
              <a key={label} href={href} className="text-sm text-white/55 transition-colors hover:text-white">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            {!isAuthenticated && (
              <Link href="/auth/login" className="hidden text-sm font-medium text-white/70 transition-colors hover:text-white sm:block">
                Sign in
              </Link>
            )}
            <Link href={primaryHref} className="nc-glow inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white">
              {isAuthenticated ? 'Dashboard' : 'Get started'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ===================== HERO ===================== */}
      <section ref={heroRef} onMouseMove={heroMove} className="nc-spotlight relative overflow-hidden pt-36 pb-24 sm:pt-44">
        <div className="nc-aurora" aria-hidden>
          <span className="a1" /><span className="a2" /><span className="a3" />
        </div>
        <div className="nc-grid absolute inset-0" aria-hidden />

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-5 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="nc-reveal inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 backdrop-blur">
              <span className="nc-pulse h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="nc-mono text-[11px] uppercase tracking-[0.18em] text-white/60">AI video studio · for brands &amp; studios</span>
            </div>

            <h1 className="nc-reveal nc-display mt-6 text-[clamp(2.6rem,6vw,4.7rem)] leading-[0.96] text-white" style={d(80)}>
              Turn raw footage into{' '}
              <span className="nc-serif nc-gradient-text italic">scroll-stopping</span>{' '}
              shorts &amp; ads.
            </h1>

            <p className="nc-reveal mt-6 max-w-xl text-lg leading-relaxed text-white/60" style={d(160)}>
              neuralCut is the AI-native editing suite for brands and studios.
              Auto subtitles, smart B-roll, scene intelligence, and shorts —
              all in one timeline that renders in minutes, not days.
            </p>

            <div className="nc-reveal mt-9 flex flex-wrap items-center gap-3" style={d(240)}>
              <Magnetic href={primaryHref} className="nc-glow inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 px-6 py-3.5 text-base font-semibold text-white">
                {primaryLabel}
                <ArrowRight className="h-5 w-5" />
              </Magnetic>
              <a href="#the-cut" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-6 py-3.5 text-base font-medium text-white/80 backdrop-blur transition-colors hover:border-white/25 hover:text-white">
                <Play className="h-4 w-4 fill-white/80" />
                See the magic
              </a>
            </div>

            <div className="nc-reveal mt-9 flex items-center gap-5" style={d(320)}>
              <div className="flex -space-x-2">
                {['from-violet-500 to-fuchsia-500', 'from-indigo-500 to-amber-500', 'from-amber-500 to-rose-500', 'from-fuchsia-500 to-violet-500'].map((g, i) => (
                  <span key={i} className={`h-8 w-8 rounded-full border-2 border-[#050506] bg-gradient-to-br ${g}`} />
                ))}
              </div>
              <p className="text-sm text-white/50">
                <span className="font-semibold text-white/80">10,000+</span> videos shipped every month by teams who used to wait days.
              </p>
            </div>
          </div>

          <div className="nc-reveal" style={d(200)}>
            <EditorMockup />
          </div>
        </div>
      </section>

      {/* ===================== LOGO MARQUEE ===================== */}
      <section className="relative border-y border-white/6 py-8">
        <p className="nc-mono mb-6 text-center text-[11px] uppercase tracking-[0.3em] text-white/30">
          Trusted by studios &amp; brands shipping at scale
        </p>
        <div className="nc-marquee-mask overflow-hidden">
          <div className="nc-marquee gap-14 pr-14">
            {[...STUDIOS, ...STUDIOS].map((s, i) => (
              <span key={i} className="nc-display whitespace-nowrap text-xl text-white/25 transition-colors hover:text-white/60">{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== THE CUT (signature) ===================== */}
      <section id="the-cut" className="relative overflow-hidden py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_50%_at_50%_0%,rgba(139,92,246,0.12),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-5">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="nc-reveal">
              <span className="nc-mono text-[11px] uppercase tracking-[0.3em] text-amber-300/80">The cut</span>
              <h2 className="nc-display mt-4 text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.02] text-white">
                A week of footage,
                <br />
                <span className="nc-serif nc-gradient-text italic">an eight-second short.</span>
              </h2>
              <p className="mt-5 max-w-md text-white/55">
                Drag the handle. On the left, hours of raw takes with no captions,
                no cuts, no score. On the right, what neuralCut hands back —
                graded, captioned, and ready to post.
              </p>
              <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2">
                <MoveHorizontal className="h-4 w-4 text-amber-300" />
                <span className="nc-mono text-[11px] uppercase tracking-wider text-white/55">drag to compare</span>
              </div>
            </div>
            <div className="nc-reveal" style={d(120)}>
              <CompareSlider />
            </div>
          </div>
        </div>
      </section>

      {/* ===================== KINETIC DIVIDER ===================== */}
      <div className="nc-marquee-mask overflow-hidden border-y border-white/6 py-6">
        <div className="nc-marquee gap-8 pr-8">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex items-center gap-8">
              {['CUT', 'SHIP', 'SCALE', 'RENDER', 'REPEAT'].map((w) => (
                <span key={w} className="nc-display flex items-center gap-8 text-4xl sm:text-6xl">
                  <span className="nc-stroke">{w}</span>
                  <span className="text-amber-400/70">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ===================== FEATURES (bento) ===================== */}
      <section id="features" className="relative mx-auto max-w-6xl px-5 py-28">
        <div className="nc-reveal mx-auto max-w-2xl text-center">
          <span className="nc-mono text-[11px] uppercase tracking-[0.3em] text-violet-300/70">Capabilities</span>
          <h2 className="nc-display mt-4 text-[clamp(2rem,4vw,3rem)] leading-tight text-white">
            One timeline. Every part of the edit,{' '}
            <span className="nc-serif nc-gradient-text italic">handled by AI.</span>
          </h2>
          <p className="mt-4 text-white/55">
            Stop stitching ten tools together. neuralCut covers the whole pipeline —
            from the first cut to the final render.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* featured wide card */}
          <div className="nc-reveal nc-card group relative overflow-hidden rounded-2xl p-6 sm:col-span-2">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl transition-opacity duration-500 group-hover:bg-violet-500/30" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-300/30 bg-gradient-to-br from-amber-400/15 to-white/[0.02]">
                  <Scissors className="h-5 w-5 text-amber-300" />
                </div>
                <div className="mt-5 flex items-center gap-2">
                  <h3 className="nc-display text-2xl text-white">AI Shorts</h3>
                  <span className="nc-mono rounded border border-amber-300/30 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-amber-200/90">core</span>
                </div>
                <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-white/60">
                  Drop a long video and neuralCut finds the moments worth keeping —
                  reframed to vertical, beat-matched, and captioned automatically.
                  One upload, a dozen posts.
                </p>
              </div>
              {/* mini frame stack */}
              <div className="flex shrink-0 items-end gap-2">
                {[
                  'from-violet-600 to-fuchsia-700',
                  'from-indigo-600 to-violet-700',
                  'from-amber-500 to-rose-600',
                ].map((g, i) => (
                  <div key={i} className={`aspect-[9/16] w-12 rounded-md bg-gradient-to-br ${g} ring-1 ring-white/15 ${i === 1 ? 'w-16' : 'opacity-80'}`} />
                ))}
              </div>
            </div>
          </div>

          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="nc-reveal nc-card group relative overflow-hidden rounded-2xl p-6" style={d(i * 60)}>
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl transition-opacity duration-500 group-hover:bg-violet-500/25" />
                <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02]">
                  <Icon className="h-5 w-5 text-violet-300" />
                </div>
                <div className="mt-5 flex items-center gap-2">
                  <h3 className="nc-display text-xl text-white">{f.title}</h3>
                  <span className="nc-mono rounded border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/40">{f.tag}</span>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-white/55">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================== WORKFLOW ===================== */}
      <section id="workflow" className="relative overflow-hidden py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(99,102,241,0.12),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-5">
          <div className="nc-reveal flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-xl">
              <span className="nc-mono text-[11px] uppercase tracking-[0.3em] text-amber-300/80">The workflow</span>
              <h2 className="nc-display mt-4 text-[clamp(2rem,4vw,3rem)] leading-tight text-white">Three steps from footage to finished film.</h2>
            </div>
            <Link href={primaryHref} className="group inline-flex items-center gap-1.5 text-sm font-medium text-violet-300 transition-colors hover:text-violet-200">
              See it on your footage
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>

          <div className="relative mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.n} className="nc-reveal group relative bg-[#08080c] p-8 transition-colors hover:bg-[#0c0c12]" style={d(i * 90)}>
                <div className="nc-display bg-gradient-to-b from-white/15 to-transparent bg-clip-text text-6xl text-transparent">{s.n}</div>
                <h3 className="nc-display mt-3 text-xl text-white">{s.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-white/55">{s.body}</p>
                {i < STEPS.length - 1 && <ArrowRight className="absolute right-5 top-9 hidden h-5 w-5 text-white/15 md:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== SHOWCASE ===================== */}
      <section id="showcase" className="relative mx-auto max-w-6xl px-5 py-28">
        <div className="nc-reveal mx-auto max-w-2xl text-center">
          <span className="nc-mono text-[11px] uppercase tracking-[0.3em] text-violet-300/70">Showcase</span>
          <h2 className="nc-display mt-4 text-[clamp(2rem,4vw,3rem)] leading-tight text-white">
            Built for the formats that{' '}
            <span className="nc-serif nc-gradient-text italic">convert.</span>
          </h2>
          <p className="mt-4 text-white/55">
            Verticals for social, square for feeds, widescreen for the brand film —
            all from a single project.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SHORTS.map((s, i) => (
            <ShortFrame key={i} s={s} style={d(i * 80)} />
          ))}
        </div>

        <div className="nc-reveal mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/5 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.l} className="bg-[#08080c] px-6 py-8 text-center">
              <div className="nc-display text-4xl text-white">{s.v}</div>
              <div className="nc-mono mt-2 text-[11px] uppercase tracking-wider text-white/40">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== TESTIMONIAL + PRICING ===================== */}
      <section id="pricing" className="relative mx-auto max-w-6xl px-5 pb-28">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="nc-reveal nc-card relative overflow-hidden rounded-3xl p-9">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="mb-5 flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <blockquote className="nc-serif text-3xl leading-snug text-white sm:text-[2.5rem]">
              “We replaced a five-person edit bay with neuralCut. Our shorts ship the
              <span className="nc-amber-text italic"> same day</span> we shoot — and they
              outperform what we used to spend a week on.”
            </blockquote>
            <div className="mt-8 flex items-center gap-3">
              <span className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-amber-500" />
              <div>
                <div className="text-sm font-semibold text-white">Mara Devlin</div>
                <div className="nc-mono text-[11px] text-white/40">Head of Content · OFFAXIS</div>
              </div>
            </div>
          </div>

          <div className="nc-reveal nc-card flex flex-col rounded-3xl p-9" style={d(90)}>
            <span className="nc-mono text-[11px] uppercase tracking-[0.3em] text-amber-300/80">Start free</span>
            <div className="mt-4 flex items-end gap-1.5">
              <span className="nc-display text-5xl text-white">$0</span>
              <span className="mb-1.5 text-sm text-white/50">to start</span>
            </div>
            <p className="mt-3 text-sm text-white/55">
              Bring your footage and ship your first AI-cut short today. Upgrade when
              you scale to a full studio workflow.
            </p>
            <ul className="mt-6 space-y-2.5">
              {['AI shorts & ad drafts', 'Auto subtitles + B-roll', 'Full timeline editor', 'Every aspect ratio'].map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-sm text-white/70">
                  <Check className="h-4 w-4 text-amber-400" strokeWidth={3} />
                  {t}
                </li>
              ))}
            </ul>
            <Magnetic href={primaryHref} strength={0.15} className="nc-glow mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 px-6 py-3.5 text-base font-semibold text-white">
              {primaryLabel}
              <ArrowRight className="h-5 w-5" />
            </Magnetic>
          </div>
        </div>
      </section>

      {/* ===================== FINAL CTA ===================== */}
      <section className="relative overflow-hidden px-5 py-28">
        <div className="nc-reveal relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a10] px-8 py-20 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_120%,rgba(139,92,246,0.4),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_-10%,rgba(245,178,90,0.18),transparent_60%)]" />
          <div className="nc-aurora opacity-35" aria-hidden>
            <span className="a1" /><span className="a3" />
          </div>
          <div className="relative">
            <h2 className="nc-display mx-auto max-w-3xl text-[clamp(2.2rem,5vw,3.8rem)] leading-[1.02] text-white">
              Your next viral short is{' '}
              <span className="nc-serif nc-gradient-text italic">already in your footage.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/60">
              Let neuralCut find it. Start free — no card, no crew, no editing software to learn.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Magnetic href={primaryHref} className="nc-glow inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 px-7 py-4 text-base font-semibold text-white">
                {primaryLabel}
                <ArrowRight className="h-5 w-5" />
              </Magnetic>
              {!isAuthenticated && (
                <Link href="/auth/login" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-7 py-4 text-base font-medium text-white/80 backdrop-blur transition-colors hover:border-white/25 hover:text-white">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="border-t border-white/8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-14 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm text-white/45">The AI video studio for brands and studios. Cut once, publish everywhere.</p>
          </div>
          <div className="grid grid-cols-3 gap-10 text-sm">
            {[
              ['Product', ['The cut', 'Features', 'Showcase', 'Pricing']],
              ['Company', ['About', 'Studios', 'Careers']],
              ['Legal', ['Privacy', 'Terms', 'Security']],
            ].map(([title, items]) => (
              <div key={title as string}>
                <div className="nc-mono mb-3 text-[10px] uppercase tracking-wider text-white/35">{title}</div>
                <ul className="space-y-2">
                  {(items as string[]).map((it) => (
                    <li key={it}><a href="#" className="text-white/55 transition-colors hover:text-white">{it}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-white/6">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-white/35 sm:flex-row">
            <span>© 2026 neuralCut. All rights reserved.</span>
            <span className="nc-mono">Crafted for the cut.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
