'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  LayoutTemplate,
  MonitorPlay,
  RefreshCw,
  Smartphone,
  Sparkles,
  UserRound,
  Wand2,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { customVideosApi, getApiErrorMessage } from '@/lib/api';
import { AdTemplate } from '@/types';

type ToastState = {
  open: boolean;
  variant: 'error' | 'success' | 'info';
  title?: string;
  message: string;
};

const FALLBACK_ACCENT = '#8b5cf6';

function isValidHex(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function getAccent(template: AdTemplate) {
  return isValidHex(template.accent) ? template.accent : FALLBACK_ACCENT;
}

// Tasteful label for the format id returned by the backend.
function formatAdFormatLabel(adFormat: string) {
  return adFormat
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function groupByCategory(templates: AdTemplate[]) {
  const groups = new Map<string, AdTemplate[]>();
  for (const template of templates) {
    const existing = groups.get(template.category);
    if (existing) {
      existing.push(template);
    } else {
      groups.set(template.category, [template]);
    }
  }
  return Array.from(groups.entries());
}

interface TemplateCardProps {
  template: AdTemplate;
  expanded: boolean;
  onToggleBrief: () => void;
  onUse: () => void;
}

function TemplateCard({ template, expanded, onToggleBrief, onUse }: TemplateCardProps) {
  const accent = getAccent(template);
  const isPortrait = template.recommended_video_type === 'portrait';
  const FormatIcon = isPortrait ? Smartphone : MonitorPlay;

  return (
    <Card hover className="group flex h-full flex-col overflow-hidden border-slate-800/80 bg-slate-950/60">
      {/* Accent-colored top band per template */}
      <div className="relative h-2.5 w-full" style={{ background: `linear-gradient(90deg, ${accent} 0%, ${accent}66 100%)` }}>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0f]/30 to-transparent" />
      </div>

      <CardContent className="flex min-h-0 flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{
                color: accent,
                backgroundColor: `${accent}1f`,
                boxShadow: `inset 0 0 0 1px ${accent}40`,
              }}
            >
              {template.category}
            </span>
            <h3 className="mt-2.5 text-lg font-semibold leading-snug text-white">{template.name}</h3>
          </div>
          {template.suggested_persona && (
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/15 px-2.5 py-1 text-[11px] font-medium text-violet-200"
              title="Pairs best with one of your AI creators"
            >
              <UserRound className="h-3 w-3" />
              Persona-ready
            </span>
          )}
        </div>

        <p className="mt-2.5 text-sm leading-relaxed text-slate-400">{template.description}</p>

        {/* Format + orientation + duration hints */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            {formatAdFormatLabel(template.ad_format)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs text-slate-300">
            <FormatIcon className="h-3.5 w-3.5 text-slate-500" />
            {isPortrait ? 'Portrait' : 'Landscape'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs tabular-nums text-slate-300">
            ~{template.recommended_duration_s}s
          </span>
        </div>

        {/* Preview brief — expands to show the example prompt */}
        {expanded && (
          <div className="animate-fadeIn mt-4 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Creative brief</p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{template.example_prompt}</p>
          </div>
        )}

        <div className="mt-auto flex items-center gap-2.5 pt-5">
          <Button
            onClick={onUse}
            className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
          >
            <Wand2 className="h-4 w-4" />
            Use template
          </Button>
          <Button
            variant="outline"
            onClick={onToggleBrief}
            aria-expanded={expanded}
            title={expanded ? 'Hide the example brief' : 'Read the example brief'}
          >
            Preview brief
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TemplatesPage() {
  const router = useRouter();

  const [templates, setTemplates] = useState<AdTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState>({ open: false, variant: 'info', message: '' });
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, variant: ToastState['variant'], title?: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast({ open: true, variant, title, message });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast((current) => ({ ...current, open: false }));
      toastTimeoutRef.current = null;
    }, 5000);
  }, []);

  const closeToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast((current) => ({ ...current, open: false }));
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const loadTemplates = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const data = await customVideosApi.listAdTemplates();
        setTemplates(data.items);
      } catch (error) {
        console.error('Failed to load ad templates:', error);
        showToast(getApiErrorMessage(error, 'Failed to load templates.'), 'error', 'Load Failed');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleUseTemplate = useCallback(
    (template: AdTemplate) => {
      showToast(`Prefilling the composer with "${template.name}".`, 'success', 'Template applied');
      router.push(`/dashboard?template=${encodeURIComponent(template.id)}`);
    },
    [router, showToast]
  );

  const grouped = groupByCategory(templates);

  return (
    <DashboardLayout>
      <Toast
        open={toast.open}
        variant={toast.variant}
        title={toast.title}
        message={toast.message}
        onClose={closeToast}
      />

      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-violet-200">
            Ad Templates
            {!loading && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 tracking-normal text-white">
                {templates.length}
              </span>
            )}
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">Start from a proven ad</h1>
          <p className="max-w-2xl text-slate-400">
            Hand-crafted starting points written like a senior performance creative would brief them.
            Pick one, review the prompt, and the composer is ready before you even type.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              void loadTemplates('refresh');
            }}
            loading={refreshing}
            disabled={loading || refreshing}
          >
            <RefreshCw className="h-5 w-5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Gallery */}
      {loading ? (
        <div className="space-y-10">
          {Array.from({ length: 2 }).map((_, sectionIndex) => (
            <div key={sectionIndex}>
              <div className="mb-4 h-4 w-40 animate-pulse rounded-full bg-slate-800/70" />
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((__, cardIndex) => (
                  <Card key={cardIndex} className="animate-pulse overflow-hidden border-slate-800/80">
                    <div className="h-2.5 bg-slate-800/60" />
                    <CardContent className="p-5">
                      <div className="h-5 w-24 rounded-full bg-slate-800/70" />
                      <div className="mt-3 h-5 w-2/3 rounded-full bg-slate-800/80" />
                      <div className="mt-3 h-3 w-full rounded-full bg-slate-800/60" />
                      <div className="mt-2 h-3 w-4/5 rounded-full bg-slate-800/60" />
                      <div className="mt-5 flex gap-2">
                        <div className="h-6 w-24 rounded-full bg-slate-800/60" />
                        <div className="h-6 w-20 rounded-full bg-slate-800/60" />
                      </div>
                      <div className="mt-5 flex gap-2.5">
                        <div className="h-10 flex-1 rounded-xl bg-slate-800/70" />
                        <div className="h-10 w-32 rounded-xl bg-slate-800/50" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-6 py-16 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 text-violet-300 ring-1 ring-violet-500/30">
            <LayoutTemplate className="h-9 w-9" />
          </div>
          <h2 className="text-2xl font-semibold text-white">No templates available yet</h2>
          <p className="mt-3 max-w-lg text-slate-400">
            We could not load any ad templates right now. Try refreshing — or head to the composer and
            describe your ad from scratch.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <Button
              size="lg"
              onClick={() => {
                void loadTemplates('refresh');
              }}
              loading={refreshing}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
            >
              <RefreshCw className="h-5 w-5" />
              Try again
            </Button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-2 text-xs text-slate-500 transition-colors hover:text-slate-300"
            >
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              Start from a blank prompt instead
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map(([category, categoryTemplates]) => (
            <section key={category}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {category}
                </h2>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-400">
                  {categoryTemplates.length}
                </span>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {categoryTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    expanded={expandedId === template.id}
                    onToggleBrief={() =>
                      setExpandedId((current) => (current === template.id ? null : template.id))
                    }
                    onUse={() => handleUseTemplate(template)}
                  />
                ))}
              </div>
            </section>
          ))}

          <p className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-600">
            Every template drops you into the composer prefilled — review it, tweak it, then generate.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}
