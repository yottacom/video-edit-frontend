'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clapperboard,
  Clock,
  Film,
  Image as ImageIcon,
  Loader2,
  Mic,
  MonitorPlay,
  Music2,
  Scissors,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  UserRound,
  Video,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Toast } from '@/components/ui/Toast';
import { useAuthStore } from '@/lib/store';
import {
  assetsApi,
  brandsApi,
  customVideosApi,
  getApiErrorMessage,
  jobsApi,
  musicTracksApi,
  personasApi,
  projectsApi,
  sourceVideosApi,
} from '@/lib/api';
import {
  AdFormat,
  AdTemplate,
  AssetsBoard,
  AssetsBoardEntry,
  Brand,
  EditProject,
  GenerateFromPromptJobResponse,
  GenerateFromPromptStage,
  Persona,
  PlanPreview,
  PlanPreviewAsset,
  ProjectStatus,
} from '@/types';

const MIN_PROMPT_LENGTH = 10;
const POLL_INTERVAL_MS = 2500;
const MAX_CONSECUTIVE_POLL_ERRORS = 5;
const DURATION_OPTIONS = [15, 30, 45, 60];

const GENERATION_STEPS: { label: string; stages: GenerateFromPromptStage[] }[] = [
  { label: 'Planning your ad', stages: ['queued', 'planning', 'planned'] },
  { label: 'Generating assets', stages: ['generating_assets'] },
  { label: 'Building scenes', stages: ['building_scenes'] },
  { label: 'Recording narration', stages: ['generating_voiceover', 'finalizing', 'completing', 'completed'] },
];

interface Stats {
  videos: number;
  music: number;
  projects: number;
  completed: number;
}

interface GenerationState {
  jobRequestId: string;
  customVideoId: string;
  stage: GenerateFromPromptStage;
  progress: number;
  assetsDone: number | null;
  assetsTotal: number | null;
  planPreview: PlanPreview | null;
  assetsBoard: AssetsBoard;
}

type ToastState = {
  open: boolean;
  variant: 'error' | 'success' | 'info';
  title?: string;
  message: string;
};

function getActiveStepIndex(stage: GenerateFromPromptStage) {
  const index = GENERATION_STEPS.findIndex((step) => step.stages.includes(stage));
  return index === -1 ? 0 : index;
}

function getStageLabel(generation: GenerationState, hasPersona: boolean) {
  switch (generation.stage) {
    case 'queued':
      return 'Warming up';
    case 'planning':
      return 'Your creative director is writing the script';
    case 'planned':
      return 'Script locked — briefing the crew';
    case 'generating_assets': {
      const label = hasPersona ? 'Filming your creator' : 'Generating assets';
      return generation.assetsTotal
        ? `${label} · ${Math.min(generation.assetsDone ?? 0, generation.assetsTotal)} of ${generation.assetsTotal}`
        : label;
    }
    case 'building_scenes':
      return 'Assembling your timeline';
    case 'generating_voiceover':
      return hasPersona ? 'Your creator is recording the voiceover' : 'Recording the narration';
    case 'finalizing':
    case 'completing':
      return 'Finishing touches';
    case 'completed':
      return 'Taking you to the editor';
    case 'failed':
      return 'Generation failed';
    default:
      return 'Working on it';
  }
}

function getProjectStatusBadge(status: ProjectStatus) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20';
    case 'failed':
      return 'bg-red-500/15 text-red-200 border-red-400/20';
    case 'draft':
      return 'bg-blue-500/15 text-blue-200 border-blue-400/20';
    default:
      return 'bg-violet-500/15 text-violet-200 border-violet-400/20';
  }
}

function getProjectStatusLabel(status: ProjectStatus) {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'draft':
      return 'Draft';
    case 'pending':
      return 'Pending';
    case 'transcribing':
      return 'Transcribing';
    case 'planning':
      return 'Planning';
    case 'generating':
      return 'Generating';
    case 'rendering':
      return 'Rendering';
    default:
      return status;
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StoryboardAssetCell({
  asset,
  entry,
}: {
  asset: PlanPreviewAsset;
  entry: AssetsBoardEntry | undefined;
}) {
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const status = entry?.status ?? 'pending';
  const Glyph = asset.type === 'video' ? Film : ImageIcon;

  return (
    <div
      title={asset.description || undefined}
      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition-colors duration-300 ${
        status === 'generating'
          ? 'animate-pulse border-violet-500/35 bg-violet-500/10'
          : status === 'done'
            ? 'border-white/[0.1] bg-white/[0.04]'
            : status === 'failed'
              ? 'border-white/[0.05] bg-white/[0.015]'
              : 'border-white/[0.06] bg-white/[0.03]'
      }`}
    >
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-0.5 ${
          status === 'generating'
            ? 'text-violet-300/80'
            : status === 'failed'
              ? 'text-slate-700'
              : status === 'done'
                ? 'text-emerald-300/70'
                : 'text-slate-600'
        }`}
      >
        <Glyph className="h-4 w-4" />
        {status === 'failed' && (
          <span className="text-[9px] font-medium leading-none text-slate-600">skipped</span>
        )}
      </div>
      {status === 'done' && entry?.thumbnail_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.thumbnail_url}
          alt={asset.description || 'Generated asset'}
          loading="lazy"
          onLoad={() => setThumbnailLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            thumbnailLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
}

function DashboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const [stats, setStats] = useState<Stats>({ videos: 0, music: 0, projects: 0, completed: 0 });
  const [recentProjects, setRecentProjects] = useState<EditProject[]>([]);
  const [loading, setLoading] = useState(true);

  const [prompt, setPrompt] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
  const [personaPortraits, setPersonaPortraits] = useState<Record<string, string>>({});
  const [adFormats, setAdFormats] = useState<AdFormat[]>([]);
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
  const [videoType, setVideoType] = useState<'portrait' | 'landscape'>('portrait');
  const [duration, setDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [generation, setGeneration] = useState<GenerationState | null>(null);

  const [toast, setToast] = useState<ToastState>({ open: false, variant: 'info', message: '' });
  const toastTimeoutRef = useRef<number | null>(null);
  const brandMenuRef = useRef<HTMLDivElement | null>(null);
  const personaMenuRef = useRef<HTMLDivElement | null>(null);
  const templatePrefilledRef = useRef(false);

  const showToast = useCallback((message: string, variant: ToastState['variant'], title?: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToast({ open: true, variant, title, message });

    toastTimeoutRef.current = window.setTimeout(() => {
      setToast((currentToast) => ({ ...currentToast, open: false }));
      toastTimeoutRef.current = null;
    }, 6000);
  }, []);

  const closeToast = () => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast((currentToast) => ({ ...currentToast, open: false }));
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function loadStats() {
      try {
        const [videos, music, projects] = await Promise.all([
          sourceVideosApi.list(1, 1),
          musicTracksApi.list(),
          projectsApi.list(1, 100),
        ]);
        setStats({
          videos: videos.total,
          music: music.total,
          projects: projects.total,
          completed: projects.items.filter((p) => p.status === 'completed').length,
        });
        setRecentProjects(
          [...projects.items]
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .slice(0, 4)
        );
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    }
    void loadStats();
  }, []);

  useEffect(() => {
    async function loadBrands() {
      try {
        const response = await brandsApi.list();
        setBrands(response.items);
      } catch (error) {
        console.error('Failed to load brands:', error);
      }
    }
    void loadBrands();
  }, []);

  useEffect(() => {
    async function loadAdFormats() {
      try {
        const response = await customVideosApi.listAdFormats();
        setAdFormats(response.items);
      } catch (error) {
        console.error('Failed to load ad formats:', error);
      }
    }
    void loadAdFormats();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPersonas() {
      try {
        const response = await personasApi.list();
        if (cancelled) return;
        setPersonas(response.items);

        const portraitPairs = await Promise.all(
          response.items.map(async (persona) => {
            // Prefer the backend-resolved portrait_url (works for presets whose
            // assets are not user-scoped); fall back to the asset fetch for own
            // personas that don't have it.
            if (persona.portrait_url) return [persona.id, persona.portrait_url] as const;
            if (!persona.portrait_asset_id) return [persona.id, null] as const;
            try {
              const asset = await assetsApi.get(persona.portrait_asset_id);
              return [persona.id, asset.thumbnail_url || asset.url] as const;
            } catch (error) {
              console.error('Failed to load persona portrait:', error);
              return [persona.id, null] as const;
            }
          })
        );
        if (cancelled) return;

        const portraits: Record<string, string> = {};
        for (const [personaId, url] of portraitPairs) {
          if (url) portraits[personaId] = url;
        }
        setPersonaPortraits(portraits);
      } catch (error) {
        console.error('Failed to load personas:', error);
      }
    }

    void loadPersonas();
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefill the composer from a template chosen in the gallery (?template=<id>).
  // Runs once: fetch the templates, hydrate the prompt + format + orientation +
  // duration, then strip the query param so a refresh doesn't re-trigger it.
  useEffect(() => {
    const templateId = searchParams.get('template');
    if (!templateId || templatePrefilledRef.current) return;
    templatePrefilledRef.current = true;

    let cancelled = false;

    async function applyTemplate(id: string) {
      try {
        const response = await customVideosApi.listAdTemplates();
        if (cancelled) return;

        const template: AdTemplate | undefined = response.items.find((item) => item.id === id);
        if (!template) {
          showToast('That template is no longer available. Start from a blank prompt instead.', 'info');
          return;
        }

        setPrompt(template.example_prompt);
        setSelectedFormatId(template.ad_format);
        setVideoType(template.recommended_video_type);
        setDuration(template.recommended_duration_s);
        showToast(`"${template.name}" is loaded — review it, then hit Generate.`, 'success', 'Template applied');
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to prefill from template:', error);
        showToast(getApiErrorMessage(error, 'Failed to load that template.'), 'error');
      } finally {
        if (!cancelled) {
          // Clear the query param so refreshing the page doesn't re-apply the template.
          router.replace('/dashboard');
        }
      }
    }

    void applyTemplate(templateId);

    return () => {
      cancelled = true;
    };
  }, [searchParams, router, showToast]);

  useEffect(() => {
    if (!brandMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (brandMenuRef.current && !brandMenuRef.current.contains(event.target as Node)) {
        setBrandMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [brandMenuOpen]);

  useEffect(() => {
    if (!personaMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (personaMenuRef.current && !personaMenuRef.current.contains(event.target as Node)) {
        setPersonaMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [personaMenuOpen]);

  const jobRequestId = generation?.jobRequestId ?? null;
  const generationVideoId = generation?.customVideoId ?? null;

  useEffect(() => {
    if (!jobRequestId || !generationVideoId) return;

    let cancelled = false;
    let inFlight = false;
    let consecutivePollErrors = 0;

    const interval = window.setInterval(async () => {
      if (inFlight) return;
      inFlight = true;

      try {
        const job = await jobsApi.getResult<GenerateFromPromptJobResponse>(jobRequestId);
        if (cancelled) return;

        consecutivePollErrors = 0;
        const response = job.result?.response ?? null;

        if (job.status === 'failed') {
          window.clearInterval(interval);
          // Keep the storyboard on screen if one was planned, so the user sees
          // what the creative director DID put together before the failure.
          setGeneration((current) => {
            if (!current || current.jobRequestId !== jobRequestId) return current;
            return current.planPreview ? { ...current, stage: 'failed' } : null;
          });
          showToast(
            job.error || 'Ad generation failed. Tweak your prompt and try again.',
            'error',
            'Generation failed'
          );
          return;
        }

        if (job.status === 'finished') {
          window.clearInterval(interval);
          setGeneration((current) =>
            current ? { ...current, stage: 'completed', progress: 100 } : current
          );
          router.push(`/dashboard/custom_video/${response?.custom_video_id || generationVideoId}/create`);
          return;
        }

        setGeneration((current) => {
          if (!current || current.jobRequestId !== jobRequestId) return current;
          return {
            ...current,
            stage: response?.stage ?? current.stage,
            progress: Math.max(current.progress, job.progress ?? 0),
            assetsDone: response?.assets_done ?? current.assetsDone,
            assetsTotal: response?.assets_total ?? current.assetsTotal,
            planPreview: response?.plan_preview ?? current.planPreview,
            assetsBoard: response?.assets_board ?? current.assetsBoard,
          };
        });
      } catch (error) {
        if (cancelled) return;
        consecutivePollErrors += 1;
        console.error('Failed to poll ad generation job:', error);

        if (consecutivePollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          window.clearInterval(interval);
          setGeneration(null);
          showToast(
            getApiErrorMessage(error, 'Lost track of the generation job. Please try again.'),
            'error',
            'Generation failed'
          );
        }
      } finally {
        inFlight = false;
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [jobRequestId, generationVideoId, router, showToast]);

  const trimmedPrompt = prompt.trim();
  const canGenerate = trimmedPrompt.length >= MIN_PROMPT_LENGTH;

  const handleGenerate = async () => {
    if (submitting || generation) return;

    if (!canGenerate) {
      showToast(
        'Describe your ad in at least 10 characters so the AI has something to work with.',
        'error'
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await customVideosApi.generateFromPrompt({
        prompt: trimmedPrompt,
        brand_id: selectedBrandId,
        persona_id: selectedPersonaId,
        ad_format: selectedFormatId,
        video_type: videoType,
        target_duration_s: duration,
      });
      setGeneration({
        jobRequestId: response.job_request_id,
        customVideoId: response.custom_video.id,
        stage: 'queued',
        progress: 1,
        assetsDone: null,
        assetsTotal: null,
        planPreview: null,
        assetsBoard: {},
      });
    } catch (error) {
      console.error('Failed to start ad generation:', error);
      showToast(getApiErrorMessage(error, 'Failed to start ad generation.'), 'error', 'Generation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const name = user?.email?.split('@')[0] || 'there';
  const selectedBrand = brands.find((brand) => brand.id === selectedBrandId) || null;
  const selectedPersona = personas.find((persona) => persona.id === selectedPersonaId) || null;
  const presetPersonas = personas.filter((persona) => persona.is_preset);
  const ownPersonas = personas.filter((persona) => !persona.is_preset);
  const selectedPersonaPortrait = selectedPersona ? personaPortraits[selectedPersona.id] || null : null;
  const selectedFormat = adFormats.find((format) => format.id === selectedFormatId) || null;
  const activeStepIndex = generation ? getActiveStepIndex(generation.stage) : 0;
  const planPreview = generation?.planPreview ?? null;
  const generationCompleted = generation?.stage === 'completed';
  const generationFailed = generation?.stage === 'failed';

  return (
    <DashboardLayout>
      <Toast
        open={toast.open}
        variant={toast.variant}
        title={toast.title}
        message={toast.message}
        onClose={closeToast}
      />

      {/* Hero creation panel */}
      <section className="relative mb-10 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d0d14]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-36 left-1/2 h-80 w-[46rem] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[110px]" />
          <div className="absolute -bottom-44 right-0 h-72 w-96 rounded-full bg-indigo-600/10 blur-[120px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_75%)]" />
        </div>

        <div className="relative px-5 py-10 sm:px-10 sm:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3.5 py-1.5 text-xs font-medium text-violet-200">
              <Sparkles className="h-3.5 w-3.5" />
              Welcome back, <span className="capitalize">{name}</span>
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-[2.75rem] sm:leading-[1.12]">
              What will you{' '}
              <span className="bg-gradient-to-r from-violet-300 via-violet-400 to-indigo-300 bg-clip-text text-transparent">
                create today?
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-slate-400">
              Describe your product and the ad you imagine. neuralCut writes the script, generates
              the visuals and voiceover, and builds the whole cut for you.
            </p>
          </div>

          {generation ? (
            <div className="mx-auto mt-9 max-w-3xl">
              <div className="rounded-2xl border border-violet-500/20 bg-white/[0.02] p-6 backdrop-blur-sm sm:p-8">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p
                      className={`flex items-center gap-2 text-sm font-medium ${
                        generationFailed
                          ? 'text-red-200'
                          : generationCompleted
                            ? 'text-emerald-200'
                            : 'text-violet-200'
                      }`}
                    >
                      {generationCompleted ? (
                        <Check className="h-4 w-4 shrink-0" />
                      ) : generationFailed ? null : (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      )}
                      <span className="truncate">
                        {getStageLabel(generation, Boolean(selectedPersona))}
                        {generationFailed ? '' : '…'}
                      </span>
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {generationFailed
                        ? 'Here is what your creative director planned — tweak your prompt and try again.'
                        : 'Hang tight — this usually takes a couple of minutes.'}
                    </p>
                  </div>
                  {!generationFailed && (
                    <p className="text-3xl font-semibold tabular-nums tracking-tight text-white">
                      {Math.min(generation.progress, 100)}%
                    </p>
                  )}
                </div>

                {!generationFailed && (
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="relative h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-[width] duration-700 ease-out"
                      style={{ width: `${Math.min(Math.max(generation.progress, 4), 100)}%` }}
                    >
                      {!generationCompleted && (
                        <div className="absolute inset-0 animate-pulse rounded-full bg-white/20" />
                      )}
                    </div>
                  </div>
                )}

                {planPreview && (
                  <div className="animate-fadeIn mt-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                          Storyboard
                        </p>
                        <h3 className="mt-1 truncate text-lg font-semibold text-white">
                          {planPreview.title || 'Untitled ad'}
                        </h3>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {planPreview.music_mood && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium capitalize text-violet-200">
                            <Music2 className="h-3 w-3" />
                            {planPreview.music_mood}
                          </span>
                        )}
                        {generation.assetsTotal != null && generation.assetsTotal > 0 && (
                          <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] tabular-nums text-slate-300">
                            {Math.min(generation.assetsDone ?? 0, generation.assetsTotal)}/
                            {generation.assetsTotal} assets
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
                      {planPreview.scenes.map((scene) => (
                        <div
                          key={scene.order}
                          className="animate-fadeIn rounded-xl border border-white/[0.06] bg-white/[0.015] p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[11px] font-semibold text-violet-200">
                              {scene.order}
                            </span>
                            <h4 className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                              {scene.title || `Scene ${scene.order}`}
                            </h4>
                            {scene.use_avatar && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-200">
                                <Mic className="h-3 w-3" />
                                To camera
                              </span>
                            )}
                            {scene.estimated_duration_s != null && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] tabular-nums text-slate-400">
                                <Clock className="h-3 w-3" />~
                                {Math.round(scene.estimated_duration_s)}s
                              </span>
                            )}
                          </div>
                          {scene.voiceover_text && (
                            <p className="mt-2.5 border-l-2 border-violet-500/30 pl-3 text-[13px] italic leading-relaxed text-slate-300">
                              “{scene.voiceover_text}”
                            </p>
                          )}
                          {scene.assets.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {scene.assets.map((asset) => (
                                <StoryboardAssetCell
                                  key={asset.key}
                                  asset={asset}
                                  entry={generation.assetsBoard[asset.key]}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!planPreview && (
                  <ol className="mt-6 grid gap-2.5 sm:grid-cols-3">
                    {GENERATION_STEPS.map((step, index) => {
                      const isDone =
                        index < activeStepIndex ||
                        (index === activeStepIndex && generation.stage === 'completed');
                      const isActive = index === activeStepIndex && !isDone;

                      return (
                        <li
                          key={step.label}
                          className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors duration-300 ${
                            isActive
                              ? 'border-violet-500/35 bg-violet-500/10'
                              : isDone
                                ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
                                : 'border-white/[0.06] bg-white/[0.015]'
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                              isDone
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : isActive
                                  ? 'bg-violet-500/25 text-violet-200'
                                  : 'bg-white/[0.06] text-slate-500'
                            }`}
                          >
                            {isDone ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : isActive ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span
                            className={`text-sm ${
                              isDone ? 'text-emerald-200' : isActive ? 'text-white' : 'text-slate-500'
                            }`}
                          >
                            {step.label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}

                {generationFailed ? (
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setGeneration(null)}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-5 text-sm font-medium text-slate-200 transition-colors hover:border-white/[0.16] hover:bg-white/[0.06]"
                    >
                      Start a new ad
                    </button>
                  </div>
                ) : (
                  <p className="mt-5 text-center text-xs text-slate-500">
                    You&apos;ll be dropped straight into the editor the moment your ad is ready.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <form
              className="mx-auto mt-9 max-w-3xl"
              onSubmit={(event) => {
                event.preventDefault();
                void handleGenerate();
              }}
            >
              <div className="rounded-2xl border border-white/[0.1] bg-[#0a0a0f]/80 shadow-2xl shadow-black/40 backdrop-blur transition-all duration-200 focus-within:border-violet-500/50 focus-within:ring-2 focus-within:ring-violet-500/20">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void handleGenerate();
                    }
                  }}
                  rows={4}
                  maxLength={2000}
                  placeholder="Describe the ad you want — product, audience, vibe…"
                  className="w-full resize-none bg-transparent px-5 pb-2 pt-5 text-[15px] leading-relaxed text-white placeholder-slate-500 focus:outline-none"
                />

                {/* Ad format picker */}
                {adFormats.length > 0 && (
                  <div className="border-t border-white/[0.06] px-3.5 pb-2.5 pt-3">
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-600">
                        Format
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedFormatId(null)}
                        aria-pressed={selectedFormatId === null}
                        title="Let the AI pick the best structure for your prompt"
                        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all duration-200 ${
                          selectedFormatId === null
                            ? 'border-violet-500/40 bg-violet-500/15 text-violet-100'
                            : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.16] hover:text-slate-200'
                        }`}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Auto
                      </button>
                      {adFormats.map((format) => {
                        const isActive = selectedFormatId === format.id;
                        return (
                          <button
                            key={format.id}
                            type="button"
                            onClick={() => setSelectedFormatId(format.id)}
                            aria-pressed={isActive}
                            title={format.tagline}
                            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all duration-200 ${
                              isActive
                                ? 'border-violet-500/40 bg-violet-500/15 text-violet-100'
                                : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.16] hover:text-slate-200'
                            }`}
                          >
                            <span className="whitespace-nowrap">{format.name}</span>
                            {selectedPersona && format.supports_persona && (
                              <UserRound className="h-3 w-3 shrink-0 text-violet-300" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {selectedFormat && (
                      <p className="animate-fadeIn mt-2 text-xs text-slate-500">
                        {selectedFormat.tagline}{' '}
                        <span className="text-slate-600">
                          · best around {selectedFormat.recommended_duration_s}s
                        </span>
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 border-t border-white/[0.06] px-3.5 py-3">
                  {/* Brand selector */}
                  <div className="relative" ref={brandMenuRef}>
                    <button
                      type="button"
                      onClick={() => setBrandMenuOpen((open) => !open)}
                      aria-haspopup="listbox"
                      aria-expanded={brandMenuOpen}
                      className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-sm text-slate-200 transition-colors hover:border-white/[0.16] hover:bg-white/[0.05]"
                    >
                      <Tag className="h-4 w-4 text-violet-300" />
                      <span className="max-w-[130px] truncate">
                        {selectedBrand ? selectedBrand.name : 'No brand'}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${brandMenuOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {brandMenuOpen && (
                      <div className="absolute left-0 top-12 z-30 w-64 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12121a] shadow-2xl shadow-black/60">
                        <div className="max-h-56 overflow-y-auto p-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBrandId(null);
                              setBrandMenuOpen(false);
                            }}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition-colors hover:bg-white/[0.06]"
                          >
                            No brand
                            {selectedBrandId === null && <Check className="h-4 w-4 text-violet-300" />}
                          </button>
                          {brands.map((brand) => (
                            <button
                              key={brand.id}
                              type="button"
                              onClick={() => {
                                setSelectedBrandId(brand.id);
                                setBrandMenuOpen(false);
                              }}
                              className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition-colors hover:bg-white/[0.06]"
                            >
                              <span className="truncate">{brand.name}</span>
                              {selectedBrandId === brand.id && (
                                <Check className="h-4 w-4 shrink-0 text-violet-300" />
                              )}
                            </button>
                          ))}
                          {brands.length === 0 && (
                            <p className="px-3 py-2.5 text-xs text-slate-500">
                              Save your product, tone and colors as a brand to reuse them in every ad.
                            </p>
                          )}
                        </div>
                        <Link
                          href="/dashboard/brands"
                          className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5 text-sm text-violet-300 transition-colors hover:bg-white/[0.04] hover:text-violet-200"
                        >
                          Manage brands
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Persona selector */}
                  <div className="relative" ref={personaMenuRef}>
                    <button
                      type="button"
                      onClick={() => setPersonaMenuOpen((open) => !open)}
                      aria-haspopup="listbox"
                      aria-expanded={personaMenuOpen}
                      className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-sm text-slate-200 transition-colors hover:border-white/[0.16] hover:bg-white/[0.05]"
                    >
                      {selectedPersona && selectedPersonaPortrait ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedPersonaPortrait}
                          alt={selectedPersona.name}
                          className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                        />
                      ) : (
                        <UserRound className="h-4 w-4 text-violet-300" />
                      )}
                      <span className="max-w-[130px] truncate">
                        {selectedPersona ? selectedPersona.name : 'No creator'}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${personaMenuOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {personaMenuOpen && (
                      <div className="absolute left-0 top-12 z-30 w-64 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12121a] shadow-2xl shadow-black/60">
                        <div className="max-h-56 overflow-y-auto p-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPersonaId(null);
                              setPersonaMenuOpen(false);
                            }}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition-colors hover:bg-white/[0.06]"
                          >
                            No creator
                            {selectedPersonaId === null && <Check className="h-4 w-4 text-violet-300" />}
                          </button>

                          {presetPersonas.length > 0 && (
                            <>
                              <p className="flex items-center gap-1.5 px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-600">
                                <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                                Featured
                              </p>
                              {presetPersonas.map((persona) => (
                                <button
                                  key={persona.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPersonaId(persona.id);
                                    setPersonaMenuOpen(false);
                                  }}
                                  className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition-colors hover:bg-white/[0.06]"
                                >
                                  <span className="flex min-w-0 items-center gap-2.5">
                                    {personaPortraits[persona.id] ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={personaPortraits[persona.id]}
                                        alt={persona.name}
                                        className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                                      />
                                    ) : (
                                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
                                        <UserRound className="h-3.5 w-3.5" />
                                      </span>
                                    )}
                                    <span className="truncate">{persona.name}</span>
                                  </span>
                                  {selectedPersonaId === persona.id && (
                                    <Check className="h-4 w-4 shrink-0 text-violet-300" />
                                  )}
                                </button>
                              ))}
                            </>
                          )}

                          {ownPersonas.length > 0 && (
                            <>
                              <p className="px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-600">
                                Yours
                              </p>
                              {ownPersonas.map((persona) => (
                                <button
                                  key={persona.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPersonaId(persona.id);
                                    setPersonaMenuOpen(false);
                                  }}
                                  className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition-colors hover:bg-white/[0.06]"
                                >
                                  <span className="flex min-w-0 items-center gap-2.5">
                                    {personaPortraits[persona.id] ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={personaPortraits[persona.id]}
                                        alt={persona.name}
                                        className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                                      />
                                    ) : (
                                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
                                        <UserRound className="h-3.5 w-3.5" />
                                      </span>
                                    )}
                                    <span className="truncate">{persona.name}</span>
                                  </span>
                                  {selectedPersonaId === persona.id && (
                                    <Check className="h-4 w-4 shrink-0 text-violet-300" />
                                  )}
                                </button>
                              ))}
                            </>
                          )}

                          {personas.length === 0 && (
                            <p className="px-3 py-2.5 text-xs text-slate-500">
                              Create an AI creator to front your ads with a consistent face and voice.
                            </p>
                          )}
                        </div>
                        <Link
                          href="/dashboard/personas"
                          className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5 text-sm text-violet-300 transition-colors hover:bg-white/[0.04] hover:text-violet-200"
                        >
                          Manage creators
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Format toggle */}
                  <div className="flex h-10 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
                    {(
                      [
                        { value: 'portrait', label: 'Portrait', icon: Smartphone },
                        { value: 'landscape', label: 'Landscape', icon: MonitorPlay },
                      ] as const
                    ).map((option) => {
                      const Icon = option.icon;
                      const isActive = videoType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setVideoType(option.value)}
                          aria-pressed={isActive}
                          className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition-all duration-200 ${
                            isActive
                              ? 'bg-violet-600 text-white shadow-sm shadow-violet-950/40'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="hidden sm:inline">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Duration */}
                  <div className="flex h-10 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
                    {DURATION_OPTIONS.map((option) => {
                      const isActive = duration === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setDuration(option)}
                          aria-pressed={isActive}
                          className={`flex h-8 items-center rounded-lg px-2.5 text-sm tabular-nums transition-all duration-200 ${
                            isActive
                              ? 'bg-violet-600 text-white shadow-sm shadow-violet-950/40'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {option}s
                        </button>
                      );
                    })}
                  </div>

                  <div className="ms-auto">
                    <button
                      type="submit"
                      disabled={!canGenerate || submitting}
                      title={canGenerate ? undefined : 'Describe your ad in at least 10 characters'}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-violet-500 to-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-violet-950/50 ring-1 ring-inset ring-white/15 transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Generate ad
                    </button>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-center text-xs text-slate-500">
                Tip: mention your product, who it&apos;s for, and the vibe. Press{' '}
                <kbd className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-sans text-[10px] text-slate-300">
                  ⌘
                </kbd>{' '}
                <kbd className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-sans text-[10px] text-slate-300">
                  Enter
                </kbd>{' '}
                to generate.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Other starting points */}
      <div className="mb-5 flex items-center gap-4">
        <div className="h-px flex-1 bg-white/[0.06]" />
        <span className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
          Or start from
        </span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>

      <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          {
            href: '/dashboard/projects/new',
            icon: Scissors,
            title: 'Edit my footage',
            desc: 'AI subtitles, shorts and b-roll for video you already have.',
            accent: 'from-sky-500 to-cyan-600',
          },
          {
            href: '/dashboard/custom_video',
            icon: Clapperboard,
            title: 'Build scene by scene',
            desc: 'Compose an ad shot by shot with full creative control.',
            accent: 'from-amber-500 to-orange-600',
          },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.href} href={a.href}>
              <Card hover className="group h-full">
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${a.accent} text-white transition-transform duration-300 group-hover:scale-105`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-white">{a.title}</h3>
                    <p className="mt-0.5 text-sm text-slate-400">{a.desc}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-600 transition-all duration-300 group-hover:translate-x-1 group-hover:text-violet-400" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Recent creations */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Recent creations</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {loading
                ? 'Loading your library…'
                : `${stats.projects} projects · ${stats.completed} completed · ${stats.videos} videos · ${stats.music} tracks`}
            </p>
          </div>
          <Link
            href="/dashboard/projects"
            className="inline-flex shrink-0 items-center gap-1 text-sm text-violet-300 transition-colors hover:text-violet-200"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="animate-pulse p-5">
                  <div className="h-5 w-20 rounded-full bg-white/[0.06]" />
                  <div className="mt-4 h-4 w-3/4 rounded bg-white/[0.06]" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-white/[0.04]" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : recentProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
                <Video className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-semibold text-white">Nothing here yet</h3>
              <p className="mt-1 max-w-md text-sm text-slate-400">
                Your generated ads and edits will land here. Upload footage to get rolling.
              </p>
              <Link
                href="/dashboard/videos"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-violet-300 transition-colors hover:text-violet-200"
              >
                Go to your videos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentProjects.map((project) => (
              <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
                <Card hover className="group h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getProjectStatusBadge(project.status)}`}
                      >
                        {getProjectStatusLabel(project.status)}
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-slate-600 transition-colors duration-300 group-hover:text-violet-300" />
                    </div>
                    <h3 className="mt-3 truncate font-medium text-white" title={project.title}>
                      {project.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Updated {formatDateTime(project.updated_at)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0d]">
          <Scissors className="h-7 w-7 animate-pulse text-violet-500" />
        </div>
      }
    >
      <DashboardPageInner />
    </Suspense>
  );
}
