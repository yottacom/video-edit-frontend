'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import {
  Plus,
  Trash2,
  Music,
  Image as ImageIcon,
  Video as VideoIcon,
  X,
  Sparkles,
  PlayCircle,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
  AlertTriangle,
  Type,
  Settings,
  LayoutTemplate,
  AlignHorizontalJustifyCenter,
  Mic,
  Check,
  Loader2,
  Upload,
  RefreshCw,
  Search,
  AudioLines,
  Headphones,
  Timer,
  Tag,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { assetsApi, customVideosApi, getApiErrorMessage, musicTracksApi } from '@/lib/api';
import { AssetGenerationJobResponse, AssetItem, AssetType, CustomVideo, CustomVideoScene, CustomVideoStatus, MusicTrack } from '@/types';

// --- Subtitle Presets JSON ---
const SUBTITLE_PRESETS = [
  { id: "mrbeast", name: "MrBeast", description: "Bold yellow with black outline, high impact" },
  { id: "hormozi", name: "Hormozi", description: "Clean white with strong shadow, professional" },
  { id: "tiktok_glow", name: "TikTok Glow", description: "White with cyan glow effect, trendy" },
  { id: "netflix", name: "Netflix", description: "Classic white with subtle shadow, cinematic" },
  { id: "karaoke", name: "Karaoke", description: "White with yellow highlight, word-by-word" },
  { id: "gradient_pop", name: "Gradient Pop", description: "Pink to blue gradient, vibrant" },
  { id: "comic_punch", name: "Comic Punch", description: "Yellow with thick black outline, cartoon style" },
  { id: "typewriter", name: "Typewriter", description: "Monospace font, vintage feel" },
  { id: "neon_outline", name: "Neon Outline", description: "Neon pink glow, cyberpunk style" },
  { id: "glassmorphism", name: "Glassmorphism", description: "Frosted glass background, modern" },
  { id: "shadow_stack", name: "Shadow Stack", description: "Multiple shadow layers, depth effect" },
  { id: "minimal_box", name: "Minimal Box", description: "Clean box with padding, understated" },
  { id: "bold_impact", name: "Bold Impact", description: "Extra bold uppercase, maximum impact" },
  { id: "cinematic", name: "Cinematic", description: "Elegant serif, film credits style" },
  { id: "retro_vhs", name: "Retro VHS", description: "Red/cyan chromatic aberration, 80s vibe" },
  { id: "emoji_burst", name: "Emoji Burst", description: "Fun with emoji decorations" }
];

const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  presetId: 'tiktok_glow',
  presetName: 'TikTok Glow',
  font: 'Inter',
  color: '#ffffff',
  shadow: 'Soft Drop Shadow',
  position: 'bottom-center',
};

const musicMoodStyles: Record<string, string> = {
  upbeat: 'from-amber-400/35 via-orange-400/20 to-rose-500/35',
  chill: 'from-cyan-400/35 via-sky-400/20 to-indigo-500/35',
  dramatic: 'from-fuchsia-500/35 via-violet-500/20 to-indigo-600/35',
  inspirational: 'from-emerald-400/35 via-green-400/20 to-cyan-500/35',
  energetic: 'from-pink-500/35 via-orange-400/20 to-yellow-400/35',
  default: 'from-violet-500/30 via-indigo-500/20 to-cyan-500/30',
};

const waveformHeights = ['h-3', 'h-5', 'h-7', 'h-4', 'h-8', 'h-5', 'h-3', 'h-6'];

// --- Asset & Settings Data Types ---
interface BaseAsset {
  id: string;
  title: string;
  type: AssetType;
  source: 'uploaded' | 'ai_generated';
  url: string;
  duration_seconds: number;
  thumbnailUrl?: string;
}

type Asset = ImageAsset | VideoAsset | AudioAsset;
interface ImageAsset extends BaseAsset { type: 'image'; }
interface VideoAsset extends BaseAsset { type: 'video'; thumbnailUrl: string; }
interface AudioAsset extends BaseAsset { type: 'audio'; }
type AssetSourceFilter = 'all' | 'generated' | 'uploaded';

interface TimelineAsset {
  id: string;
  assetId: string;
  asset: Asset;
  start: number;
  end: number;
  duration: number;
}

interface SubtitleConfig {
  presetId: string;
  presetName: string;
  font: string;
  color: string;
  shadow: string;
  position: string;
}

interface Scene {
  id: string;
  backendSceneId: string | null;
  primaryAssets: TimelineAsset[];
  secondaryAssets: TimelineAsset[][];
  narration: TimelineAsset | null; 
  subtitle: SubtitleConfig | null;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function getFallbackAssetDurationSeconds(assetType: AssetType) {
  switch (assetType) {
    case 'image':
      return 2;
    case 'video':
      return 5;
    case 'audio':
      return 10;
    default:
      return 5;
  }
}

function mapLibraryAsset(item: AssetItem): Asset {
  const fallbackDuration = getFallbackAssetDurationSeconds(item.asset_type);
  const mappedDurationSeconds =
    item.asset_type === 'image'
      ? fallbackDuration
      : typeof item.duration_ms === 'number' && item.duration_ms > 0
        ? item.duration_ms / 1000
        : fallbackDuration;
  const baseAsset = {
    id: item.id,
    title: item.title,
    source: item.source_type === 'generated' ? 'ai_generated' : 'uploaded',
    url: item.url || item.thumbnail_url || '#',
    duration_seconds: mappedDurationSeconds,
  } as const;

  switch (item.asset_type) {
    case 'image':
      return {
        ...baseAsset,
        type: 'image',
        thumbnailUrl: item.thumbnail_url || item.url || undefined,
      };
    case 'video':
      return {
        ...baseAsset,
        type: 'video',
        thumbnailUrl: item.thumbnail_url || item.url || '#',
      };
    case 'audio':
      return {
        ...baseAsset,
        type: 'audio',
        thumbnailUrl: item.thumbnail_url || item.url || undefined,
      };
    default:
      return {
        ...baseAsset,
        type: 'image',
        thumbnailUrl: item.thumbnail_url || item.url || undefined,
      };
  }
}

function mergeAssetsById(currentAssets: Asset[], nextAssets: Asset[]) {
  const assetMap = new Map<string, Asset>();

  currentAssets.forEach((asset) => {
    assetMap.set(asset.id, asset);
  });

  nextAssets.forEach((asset) => {
    assetMap.set(asset.id, asset);
  });

  return Array.from(assetMap.values());
}

function formatMusicDuration(ms: number | null) {
  if (!ms) return 'Unknown';

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatTrackType(type: MusicTrack['track_type']) {
  switch (type) {
    case 'generated':
      return 'AI Generated';
    case 'uploaded':
      return 'Uploaded';
    case 'preset':
      return 'Preset';
    default:
      return type;
  }
}

function getTrackVisual(track: MusicTrack) {
  if (track.track_type === 'uploaded') {
    return 'from-slate-500/30 via-slate-400/15 to-zinc-500/30';
  }

  if (track.track_type === 'preset') {
    return 'from-emerald-500/30 via-teal-500/15 to-cyan-500/30';
  }

  return musicMoodStyles[track.mood || 'default'] || musicMoodStyles.default;
}

function getTrackTypeBadge(track: MusicTrack) {
  switch (track.track_type) {
    case 'generated':
      return 'border-violet-400/20 bg-violet-500/15 text-violet-200';
    case 'uploaded':
      return 'border-slate-500/20 bg-slate-700/50 text-slate-200';
    case 'preset':
      return 'border-emerald-400/20 bg-emerald-500/15 text-emerald-200';
    default:
      return 'border-slate-500/20 bg-slate-700/50 text-slate-200';
  }
}

function getFileAssetType(file: File): AssetType | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return null;
}

// --- Modals ---

const AssetPicker: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelectAsset: (asset: Asset) => void;
  assets: Asset[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  searchValue: string;
  assetTypeFilter: AssetType | 'all';
  sourceTypeFilter: AssetSourceFilter;
  selectedFile: File | null;
  filePreviewUrl: string | null;
  uploadError: string | null;
  uploading: boolean;
  aiPrompt: string;
  aiContentType: AssetType;
  aiAspectRatio: '16:9' | '9:16' | '1:1';
  aiDurationSeconds: string;
  generatingAI: boolean;
  pollingGeneration: boolean;
  generationJob: AssetGenerationJobResponse | null;
  generationError: string | null;
  allowedTypes?: AssetType[];
  onSearchChange: (value: string) => void;
  onAssetTypeFilterChange: (value: AssetType | 'all') => void;
  onSourceTypeFilterChange: (value: AssetSourceFilter) => void;
  onRefresh: () => void;
  onScrollEnd: () => void;
  onBrowseFile: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
  onUpload: () => void;
  onAiPromptChange: (value: string) => void;
  onAiContentTypeChange: (value: AssetType) => void;
  onAiAspectRatioChange: (value: '16:9' | '9:16' | '1:1') => void;
  onAiDurationSecondsChange: (value: string) => void;
  onGenerate: () => void;
}> = ({
  isOpen,
  onClose,
  onSelectAsset,
  assets,
  loading,
  refreshing,
  loadingMore,
  hasMore,
  searchValue,
  assetTypeFilter,
  sourceTypeFilter,
  selectedFile,
  filePreviewUrl,
  uploadError,
  uploading,
  aiPrompt,
  aiContentType,
  aiAspectRatio,
  aiDurationSeconds,
  generatingAI,
  pollingGeneration,
  generationJob,
  generationError,
  allowedTypes,
  onSearchChange,
  onAssetTypeFilterChange,
  onSourceTypeFilterChange,
  onRefresh,
  onScrollEnd,
  onBrowseFile,
  fileInputRef,
  onFileChange,
  onClearFile,
  onUpload,
  onAiPromptChange,
  onAiContentTypeChange,
  onAiAspectRatioChange,
  onAiDurationSecondsChange,
  onGenerate,
}) => {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const filteredAssets = assets.filter((asset) => !allowedTypes || allowedTypes.includes(asset.type));
  const availableAssetTypes = allowedTypes && allowedTypes.length > 0
    ? allowedTypes
    : (['image', 'video', 'audio'] as AssetType[]);
  const isGenerationBusy = generatingAI || pollingGeneration;
  const handleClosePicker = () => {
    setShowUploadDialog(false);
    setShowGenerateDialog(false);
    setPreviewAsset(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={handleClosePicker}>
      <Card className="flex h-[88vh] w-full max-w-7xl flex-col overflow-hidden border-slate-700/70 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={availableAssetTypes.map((type) => `${type}/*`).join(',')}
          onChange={onFileChange}
        />

        <div className="border-b border-slate-700/50 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Select Asset</h2>
              <p className="mt-2 text-sm text-slate-400">
                Browse your library, refine the list with filters, or add something new without leaving the editor.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => setShowUploadDialog(true)}>
                <Upload className="h-4 w-4" />
                Add Asset
              </Button>
              <Button onClick={() => setShowGenerateDialog(true)}>
                <Sparkles className="h-4 w-4" />
                Generate
              </Button>
              <button onClick={handleClosePicker} className="rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 hover:bg-slate-800 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-800/80 px-6 py-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(220px,0.7fr)_minmax(220px,0.7fr)_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search by asset title"
                className="block w-full rounded-md border border-slate-700 bg-slate-800 py-2 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div className="relative">
              <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={assetTypeFilter}
                onChange={(event) => onAssetTypeFilterChange(event.target.value as AssetType | 'all')}
                className="block w-full rounded-md border border-slate-700 bg-slate-800 py-2 pl-10 pr-3 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                {availableAssetTypes.length > 1 && <option value="all">All allowed types</option>}
                {availableAssetTypes.includes('image') && <option value="image">Images</option>}
                {availableAssetTypes.includes('video') && <option value="video">Videos</option>}
                {availableAssetTypes.includes('audio') && <option value="audio">Audio</option>}
              </select>
            </div>

            <div className="relative">
              <RefreshCw className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={sourceTypeFilter}
                onChange={(event) => onSourceTypeFilterChange(event.target.value as AssetSourceFilter)}
                className="block w-full rounded-md border border-slate-700 bg-slate-800 py-2 pl-10 pr-3 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="all">All sources</option>
                <option value="generated">AI generated</option>
                <option value="uploaded">Uploaded</option>
              </select>
            </div>

            <Button variant="outline" onClick={onRefresh} loading={refreshing} disabled={loading || refreshing || loadingMore}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <CardContent
          className="min-h-0 flex-1 overflow-y-auto p-6"
          onScroll={(event) => {
            const target = event.currentTarget;
            const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
            if (distanceFromBottom < 160 && hasMore && !loading && !loadingMore) {
              onScrollEnd();
            }
          }}
        >
          {loading ? (
            <div className="flex min-h-[480px] items-center justify-center text-slate-400">
              <Loader2 className="mr-3 h-5 w-5 animate-spin text-violet-400" />
              Loading assets...
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex min-h-[480px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-slate-500">
                <Search className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-white">No matching assets found</h3>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                Try changing your search or filters, or use the add and generate buttons in the top-right corner.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredAssets.map((asset) => (
                <Card
                  key={asset.id}
                  hover
                  onClick={() => onSelectAsset(asset)}
                  className="cursor-pointer overflow-hidden border-slate-700/70 bg-slate-950 transition-all duration-200 hover:scale-[1.01] hover:border-violet-500/50"
                >
                  <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-slate-900">
                    {asset.type === 'image' && <img src={asset.url} alt={asset.title} className="absolute inset-0 h-full w-full object-cover" />}
                    {asset.type === 'video' && (
                      <>
                        <img src={asset.thumbnailUrl} alt={asset.title} className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/30" />
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPreviewAsset(asset);
                          }}
                          className="relative z-10 rounded-full bg-black/45 p-2 text-white/90 transition-colors hover:bg-black/70"
                          aria-label={`Preview ${asset.title}`}
                        >
                          <PlayCircle className="h-11 w-11" />
                        </button>
                      </>
                    )}
                    {asset.type === 'audio' && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPreviewAsset(asset);
                        }}
                        className="flex h-20 w-20 items-center justify-center rounded-3xl bg-cyan-500/10 text-cyan-300 transition-colors hover:bg-cyan-500/20"
                        aria-label={`Preview ${asset.title}`}
                      >
                        <AudioLines className="h-10 w-10" />
                      </button>
                    )}

                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-700/80 bg-slate-950/90 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-200">
                        {asset.type}
                      </span>
                      <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200">
                        {asset.source === 'ai_generated' ? 'AI Generated' : 'Uploaded'}
                      </span>
                    </div>
                  </div>

                  <CardContent className="space-y-2 p-4">
                    <h4 className="truncate text-sm font-semibold text-white">{asset.title}</h4>
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                      <span>{asset.type === 'image' ? 'Still image' : formatDuration(asset.duration_seconds)}</span>
                      <div className="flex items-center gap-3">
                        {(asset.type === 'video' || asset.type === 'audio') && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPreviewAsset(asset);
                            }}
                            className="inline-flex items-center gap-1 text-slate-300 transition-colors hover:text-white"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Preview
                          </button>
                        )}
                        <span className="inline-flex items-center gap-1 text-violet-300">
                          <ChevronRight className="h-3.5 w-3.5" />
                          Select
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {loadingMore && (
            <div className="flex items-center justify-center py-5 text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-violet-400" />
              Loading more assets...
            </div>
          )}
        </CardContent>
      </Card>

      {previewAsset && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setPreviewAsset(null)}
        >
          <Card
            className="w-full max-w-4xl overflow-hidden border-slate-700/70 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{previewAsset.title}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {previewAsset.type === 'video' ? 'Video preview' : 'Audio preview'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <CardContent className="space-y-5 p-6">
              {previewAsset.type === 'video' ? (
                <div className="overflow-hidden rounded-xl bg-black">
                  <video
                    src={previewAsset.url}
                    poster={previewAsset.thumbnailUrl}
                    controls
                    autoPlay
                    className="max-h-[75vh] w-full object-contain"
                  />
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-5">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                      <AudioLines className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-white">{previewAsset.title}</p>
                      <p className="text-sm text-slate-400">{formatDuration(previewAsset.duration_seconds)}</p>
                    </div>
                  </div>
                  <audio src={previewAsset.url} controls autoPlay className="w-full" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showUploadDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowUploadDialog(false)}>
          <Card className="w-full max-w-xl border-slate-700/70 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">Add Asset</h3>
                    <p className="text-sm text-slate-400">Upload a file directly into the picker library.</p>
                  </div>
                </div>
                <button onClick={() => setShowUploadDialog(false)} className="rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 hover:bg-slate-800 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!selectedFile ? (
                <button
                  type="button"
                  onClick={onBrowseFile}
                  className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/80 px-4 py-12 text-center transition-colors hover:border-violet-500 hover:bg-slate-950"
                >
                  <Upload className="mb-3 h-10 w-10 text-slate-500" />
                  <p className="text-sm font-medium text-white">Choose a file to upload</p>
                  <p className="mt-1 text-xs text-slate-400">Supported types: {availableAssetTypes.join(', ')}</p>
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
                    {selectedFile.type.startsWith('image/') && filePreviewUrl ? (
                      <img src={filePreviewUrl} alt="Selected upload preview" className="max-h-full max-w-full object-contain" />
                    ) : selectedFile.type.startsWith('video/') && filePreviewUrl ? (
                      <video src={filePreviewUrl} controls className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <AudioLines className="h-14 w-14" />
                        <p className="text-sm">Audio files are ready to upload.</p>
                      </div>
                    )}
                    <button type="button" onClick={onClearFile} className="absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white transition-colors hover:bg-black">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                    <p className="truncate text-sm font-medium text-white">{selectedFile.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{selectedFile.type || 'Unknown file type'}</p>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {uploadError}
                </div>
              )}

              <div className="mt-5 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={onBrowseFile} disabled={uploading}>
                  <Upload className="h-4 w-4" />
                  Browse
                </Button>
                <Button className="flex-1" onClick={onUpload} loading={uploading} disabled={!selectedFile || uploading}>
                  <Upload className="h-4 w-4" />
                  Upload Asset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showGenerateDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowGenerateDialog(false)}>
          <Card className="w-full max-w-xl border-slate-700/70 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-300">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">Generate Asset</h3>
                    <p className="text-sm text-slate-400">Create a new asset and add it back into this picker.</p>
                  </div>
                </div>
                <button onClick={() => setShowGenerateDialog(false)} className="rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 hover:bg-slate-800 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Content Type</label>
                  <select
                    value={aiContentType}
                    onChange={(event) => onAiContentTypeChange(event.target.value as AssetType)}
                    disabled={isGenerationBusy}
                    className="block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                  >
                    {availableAssetTypes.includes('image') && <option value="image">Image</option>}
                    {availableAssetTypes.includes('video') && <option value="video">Video</option>}
                    {availableAssetTypes.includes('audio') && <option value="audio">Audio</option>}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Prompt</label>
                  <textarea
                    value={aiPrompt}
                    onChange={(event) => onAiPromptChange(event.target.value)}
                    rows={4}
                    disabled={isGenerationBusy}
                    placeholder={`Describe the ${aiContentType} you want to generate`}
                    className="block w-full rounded-md border border-slate-700 bg-slate-800 p-3 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                {aiContentType !== 'audio' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Aspect Ratio</label>
                    <select
                      value={aiAspectRatio}
                      onChange={(event) => onAiAspectRatioChange(event.target.value as '16:9' | '9:16' | '1:1')}
                      disabled={isGenerationBusy}
                      className="block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                    >
                      <option value="1:1">1:1</option>
                      <option value="16:9">16:9</option>
                      <option value="9:16">9:16</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Duration (seconds)</label>
                  {aiContentType === 'video' ? (
                    <select
                      value={aiDurationSeconds}
                      onChange={(event) => onAiDurationSecondsChange(event.target.value)}
                      disabled={isGenerationBusy}
                      className="block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                    >
                      <option value="5">5 seconds</option>
                      <option value="10">10 seconds</option>
                    </select>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={aiDurationSeconds}
                      onChange={(event) => onAiDurationSecondsChange(event.target.value)}
                      disabled={isGenerationBusy}
                      className="block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                    />
                  )}
                </div>

                {generationJob && (
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Generation Progress</p>
                        <p className="mt-1 text-xs text-slate-300">Status: {generationJob.status}</p>
                      </div>
                      <span className="rounded-full border border-violet-500/20 bg-slate-950/50 px-3 py-1 text-sm font-medium text-violet-200">
                        {generationJob.progress ?? 0}%
                      </span>
                    </div>

                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, generationJob.progress ?? 0))}%` }}
                      />
                    </div>
                  </div>
                )}

                {generationError && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {generationError}
                  </div>
                )}

                <Button onClick={onGenerate} loading={generatingAI} disabled={!aiPrompt.trim() || isGenerationBusy} className="w-full">
                  <Sparkles className="h-4 w-4" />
                  {generatingAI ? 'Starting...' : pollingGeneration ? 'Generating...' : `Generate ${aiContentType}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

const SubtitleModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (config: SubtitleConfig) => void; initialConfig: SubtitleConfig | null; }> = ({ isOpen, onClose, onSave, initialConfig }) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'config'>('presets');

  const [config, setConfig] = useState<SubtitleConfig>(initialConfig || DEFAULT_SUBTITLE_CONFIG);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-900 border-slate-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Type className="w-5 h-5 text-violet-400" /> Subtitle Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-5 pt-3">
          <button onClick={() => setActiveTab('presets')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'presets' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <span className="flex items-center gap-2"><LayoutTemplate className="w-4 h-4" /> Presets</span>
          </button>
          <button onClick={() => setActiveTab('config')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'config' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <span className="flex items-center gap-2"><Settings className="w-4 h-4" /> Configuration</span>
          </button>
        </div>

        <CardContent className="flex-1 overflow-y-auto p-6 bg-slate-950/50">
          {activeTab === 'presets' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SUBTITLE_PRESETS.map(preset => (
                <div key={preset.id} onClick={() => setConfig({ ...config, presetId: preset.id, presetName: preset.name })}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${config.presetId === preset.id ? 'border-violet-500 bg-violet-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}>
                  <h4 className={`font-semibold mb-1 ${config.presetId === preset.id ? 'text-violet-300' : 'text-white'}`}>{preset.name}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2">{preset.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Font Family</label>
                  <select value={config.font} onChange={(e) => setConfig({...config, font: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white text-sm focus:border-violet-500 outline-none">
                    <option value="Inter">Inter</option>
                    <option value="Impact">Impact</option>
                    <option value="Arial">Arial</option>
                    <option value="Courier New">Courier New</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Text Color</label>
                  <div className="flex gap-2">
                    <input type="color" value={config.color} onChange={(e) => setConfig({...config, color: e.target.value})} className="w-10 h-10 rounded cursor-pointer bg-slate-900 border border-slate-700" />
                    <input type="text" value={config.color} onChange={(e) => setConfig({...config, color: e.target.value})} className="flex-1 bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white text-sm focus:border-violet-500 outline-none uppercase" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Text Shadow</label>
                  <select value={config.shadow} onChange={(e) => setConfig({...config, shadow: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white text-sm focus:border-violet-500 outline-none">
                    <option value="None">None</option>
                    <option value="Soft Drop Shadow">Soft Drop Shadow</option>
                    <option value="Hard Drop Shadow">Hard Drop Shadow</option>
                    <option value="Neon Glow">Neon Glow</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Position on Screen</label>
                  <select value={config.position} onChange={(e) => setConfig({...config, position: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white text-sm focus:border-violet-500 outline-none">
                    <option value="bottom-center">Bottom Center</option>
                    <option value="center-center">Middle Center</option>
                    <option value="top-center">Top Center</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <div className="border-t border-slate-800 p-5 flex justify-end gap-3 bg-slate-900">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(config)}>Save Subtitles</Button>
        </div>
      </Card>
    </div>
  );
};

const VideoPreviewModal: React.FC<{ isOpen: boolean; onClose: () => void; videoUrl: string | null; }> = ({ isOpen, onClose, videoUrl }) => {
  if (!isOpen || !videoUrl) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-4xl overflow-hidden border-slate-700 bg-slate-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-xl font-semibold text-white">Final Video</h2>
          <button onClick={onClose} className="rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-black p-4">
          <video controls autoPlay className="max-h-[75vh] w-full rounded-lg">
            <source src={videoUrl} />
            Your browser does not support video playback.
          </video>
        </div>
      </Card>
    </div>
  );
};


// --- Wizard Header Component ---
const WizardStep = ({ number, title, active, completed }: { number: number, title: string, active: boolean, completed: boolean }) => (
  <div className={`flex items-center gap-2 ${active ? 'text-white' : completed ? 'text-violet-400' : 'text-slate-600'}`}>
    <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-bold transition-colors
      ${active ? 'border-violet-500 bg-violet-500/20 text-violet-400' : completed ? 'border-violet-500 bg-violet-500 text-white' : 'border-slate-700 bg-slate-900'}`}>
      {completed ? <Check className="w-4 h-4" /> : number}
    </div>
    <span className={`font-medium ${active ? 'text-white' : completed ? 'text-slate-300' : 'text-slate-600'}`}>{title}</span>
  </div>
);

const WizardLine = ({ active }: { active: boolean }) => (
  <div className={`flex-1 h-0.5 mx-4 rounded-full transition-colors ${active ? 'bg-violet-500/50' : 'bg-slate-800'}`} />
);


// --- Drag State Types ---
type DragState = 
  | { type: 'primary-resize'; sceneId: string; assetIndex: number; startX: number; origDuration: number; trackWidth: number; }
  | { type: 'secondary-edge'; sceneId: string; trackIndex: number; assetIndex: number; edge: 'left' | 'right'; startX: number; origStart: number; origDuration: number; minLimit: number; maxLimit: number; trackWidth: number; }
  | { type: 'secondary-move'; sceneId: string; trackIndex: number; assetIndex: number; startX: number; origStart: number; origDuration: number; minStart: number; maxStart: number; trackWidth: number; }
  | null;

// --- Main Component ---
export default function CreateVideoPage() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEditMode = pathname?.endsWith('/edit') ?? false;
  
  // Overall Wizard State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [customVideoId, setCustomVideoId] = useState<string | null>(null);
  const [customVideoStatus, setCustomVideoStatus] = useState<CustomVideoStatus>('draft');
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderOutputUrl, setRenderOutputUrl] = useState<string | null>(null);
  const [renderErrorMessage, setRenderErrorMessage] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<CustomVideo | null>(null);
  const [loadingReviewDraft, setLoadingReviewDraft] = useState(false);
  const [hydratingDraft, setHydratingDraft] = useState(true);
  const [syncingScenes, setSyncingScenes] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [finalizingVideo, setFinalizingVideo] = useState(false);
  const [deletingSceneId, setDeletingSceneId] = useState<string | null>(null);
  const [savingSceneId, setSavingSceneId] = useState<string | null>(null);
  const [libraryAssets, setLibraryAssets] = useState<Asset[]>([]);
  const [loadingLibraryAssets, setLoadingLibraryAssets] = useState(true);
  
  // Step 2 State (Scenes)
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [queuedSceneSaveIds, setQueuedSceneSaveIds] = useState<string[]>([]);
  
  // Step 2 State (Background Music)
  const [backgroundTracks, setBackgroundTracks] = useState<MusicTrack[]>([]);
  const [loadingBackgroundTracks, setLoadingBackgroundTracks] = useState(false);
  const [refreshingBackgroundTracks, setRefreshingBackgroundTracks] = useState(false);
  const [playingBackgroundTrackId, setPlayingBackgroundTrackId] = useState<string | null>(null);
  const [selectedBackgroundTrack, setSelectedBackgroundTrack] = useState<MusicTrack | null>(null);

  // Modals State
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [currentPickerTarget, setCurrentPickerTarget] = useState<{ sceneId?: string; rowType: 'primary' | 'secondary' | 'narration' | 'globalBg'; secondaryOverlapIndex?: number; } | null>(null);
  const [pickerAllowedTypes, setPickerAllowedTypes] = useState<('image' | 'video' | 'audio')[] | undefined>(undefined);
  const [pickerAssets, setPickerAssets] = useState<Asset[]>([]);
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerSearchInput, setPickerSearchInput] = useState('');
  const [debouncedPickerSearch, setDebouncedPickerSearch] = useState('');
  const [pickerAssetTypeFilter, setPickerAssetTypeFilter] = useState<AssetType | 'all'>('all');
  const [pickerSourceTypeFilter, setPickerSourceTypeFilter] = useState<AssetSourceFilter>('all');
  const [loadingPickerAssets, setLoadingPickerAssets] = useState(false);
  const [refreshingPickerAssets, setRefreshingPickerAssets] = useState(false);
  const [loadingMorePickerAssets, setLoadingMorePickerAssets] = useState(false);
  const [pickerHasMore, setPickerHasMore] = useState(false);
  const [pickerSelectedFile, setPickerSelectedFile] = useState<File | null>(null);
  const [pickerFilePreviewUrl, setPickerFilePreviewUrl] = useState<string | null>(null);
  const [pickerUploadError, setPickerUploadError] = useState<string | null>(null);
  const [pickerUploading, setPickerUploading] = useState(false);
  const [pickerAiPrompt, setPickerAiPrompt] = useState('');
  const [pickerAiContentType, setPickerAiContentType] = useState<AssetType>('image');
  const [pickerAiAspectRatio, setPickerAiAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('1:1');
  const [pickerAiDurationSeconds, setPickerAiDurationSeconds] = useState('5');
  const [pickerGeneratingAI, setPickerGeneratingAI] = useState(false);
  const [pickerPollingGeneration, setPickerPollingGeneration] = useState(false);
  const [pickerGenerationJob, setPickerGenerationJob] = useState<AssetGenerationJobResponse | null>(null);
  const [pickerGenerationError, setPickerGenerationError] = useState<string | null>(null);
  const [subtitleModalTarget, setSubtitleModalTarget] = useState<string | null>(null); 
  const [showFinalVideoModal, setShowFinalVideoModal] = useState(false);
  const pickerFileInputRef = useRef<HTMLInputElement>(null);
  const lastPickerQueryKeyRef = useRef('');
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);

  const [dragState, setDragState] = useState<DragState>(null);

  const sceneRowHeight = 'h-24';
  const timelineLabelWidthClass = 'w-40';
  const MIN_DURATION = 1.0; 
  const PRIMARY_MIN_DURATION = 0.01;
  const DEFAULT_IMAGE_DURATION = 2.0;
  const isInitialPageLoading = hydratingDraft || loadingLibraryAssets || (!!routeId && !customVideoId);
  const isRenderInProgress = customVideoStatus === 'finalizing' || customVideoStatus === 'rendering';
  const pickerPageSize = 24;
  const pickerQueryKey = JSON.stringify({
    search: debouncedPickerSearch,
    type: pickerAssetTypeFilter,
    source: pickerSourceTypeFilter,
    allowed: pickerAllowedTypes || [],
  });

  // --- Helpers ---
  const recalculatePrimaryTimes = (primaryArray: TimelineAsset[]) => {
    let currentStart = 0;
    return primaryArray.map(asset => {
      const updated = { ...asset, start: currentStart, end: currentStart + asset.duration };
      currentStart += asset.duration;
      return updated;
    });
  };

  const distributePrimaryAssetsEvenly = useCallback((primaryArray: TimelineAsset[], totalDuration: number) => {
    if (primaryArray.length === 0) {
      return [];
    }

    const safeTotalDuration = Math.max(PRIMARY_MIN_DURATION, totalDuration);
    const equalDuration = safeTotalDuration / primaryArray.length;
    let currentStart = 0;

    return primaryArray.map((asset, index) => {
      const duration =
        index === primaryArray.length - 1
          ? Math.max(0, safeTotalDuration - currentStart)
          : equalDuration;
      const updated = { ...asset, start: currentStart, end: currentStart + duration, duration };
      currentStart = updated.end;
      return updated;
    });
  }, []);

  const redistributePrimaryTail = useCallback((primaryArray: TimelineAsset[], totalDuration: number) => {
    if (primaryArray.length === 0) {
      return [];
    }

    const safeTotalDuration = Math.max(0, totalDuration);
    const minimumTotalDuration = PRIMARY_MIN_DURATION * primaryArray.length;

    if (safeTotalDuration <= minimumTotalDuration) {
      return distributePrimaryAssetsEvenly(primaryArray, safeTotalDuration);
    }

    const weights = primaryArray.map((asset) => Math.max(asset.duration, PRIMARY_MIN_DURATION));
    let remainingWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let remainingDuration = safeTotalDuration;
    let remainingExtraDuration = safeTotalDuration - minimumTotalDuration;
    let currentStart = 0;

    return primaryArray.map((asset, index) => {
      let duration: number;

      if (index === primaryArray.length - 1) {
        duration = Math.max(0, remainingDuration);
      } else {
        const extraShare =
          remainingWeight > 0
            ? (remainingExtraDuration * weights[index]) / remainingWeight
            : remainingExtraDuration / (primaryArray.length - index);
        duration = PRIMARY_MIN_DURATION + extraShare;
        remainingExtraDuration -= extraShare;
        remainingWeight -= weights[index];
      }

      const updated = { ...asset, start: currentStart, end: currentStart + duration, duration };
      currentStart = updated.end;
      remainingDuration -= duration;
      return updated;
    });
  }, [distributePrimaryAssetsEvenly]);

  const resizePrimaryAssetsWithinDuration = useCallback((
    primaryArray: TimelineAsset[],
    assetIndex: number,
    desiredDuration: number,
    totalDuration: number
  ) => {
    if (primaryArray.length === 0 || !primaryArray[assetIndex]) {
      return primaryArray;
    }

    const safeTotalDuration = Math.max(PRIMARY_MIN_DURATION, totalDuration);
    const beforeAssets = primaryArray.slice(0, assetIndex);
    const currentAsset = primaryArray[assetIndex];
    const afterAssets = primaryArray.slice(assetIndex + 1);
    const lockedDuration = beforeAssets.reduce((sum, asset) => sum + asset.duration, 0);
    const reservedAfterDuration = afterAssets.length * PRIMARY_MIN_DURATION;
    const availableForCurrent = Math.max(
      PRIMARY_MIN_DURATION,
      safeTotalDuration - lockedDuration - reservedAfterDuration
    );
    const nextDuration = Math.min(
      Math.max(PRIMARY_MIN_DURATION, desiredDuration),
      availableForCurrent
    );
    const remainingAfterDuration = Math.max(0, safeTotalDuration - lockedDuration - nextDuration);

    return recalculatePrimaryTimes([
      ...beforeAssets,
      { ...currentAsset, duration: nextDuration },
      ...redistributePrimaryTail(afterAssets, remainingAfterDuration),
    ]);
  }, [redistributePrimaryTail]);

  const getTrackSurfaceWidth = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return 1;
    }

    const trackSurface =
      (target.closest('.timeline-track-surface') as HTMLElement | null) ||
      (target.closest('.timeline-track-container') as HTMLElement | null);

    return Math.max(1, trackSurface?.getBoundingClientRect().width || 1);
  };

  const getSceneDurations = useCallback((scene: Scene) => {
    const narrationDur = scene.narration?.duration || 0;
    const primaryDur = scene.primaryAssets.reduce((sum, asset) => sum + asset.duration, 0);
    const secondaryDur = scene.secondaryAssets.reduce((maxTrackEnd, track) => {
      const trackEnd = track.reduce((maxAssetEnd, asset) => Math.max(maxAssetEnd, asset.end), 0);
      return Math.max(maxTrackEnd, trackEnd);
    }, 0);
    const displayDuration = scene.narration
      ? Math.max(MIN_DURATION, narrationDur)
      : Math.max(MIN_DURATION, primaryDur, secondaryDur);
    return { narrationDur, primaryDur, secondaryDur, displayDuration };
  }, []);

  // Total duration across all scenes (used by music/finalize steps)
  const getTotalVideoExportDuration = () => {
    return scenes.reduce((total, scene) => {
      const { narrationDur, primaryDur } = getSceneDurations(scene);
      return total + (scene.narration ? narrationDur : primaryDur);
    }, 0);
  };

  // Validation
  const canProceedToStep3 = scenes.length > 0 && scenes.every(s => 
    s.primaryAssets.length > 0 && 
    s.narration !== null && 
    s.subtitle !== null
  );

  const formatPositionString = (pos: string) => {
    return pos.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const isSceneEmpty = useCallback((scene: Scene) => (
    scene.primaryAssets.length === 0 &&
    scene.secondaryAssets.every((track) => track.length === 0) &&
    scene.narration === null &&
    scene.subtitle === null
  ), []);

  const createFallbackAsset = useCallback((assetId: string): Asset => ({
    id: assetId,
    title: `Asset ${assetId}`,
    type: 'image',
    source: 'uploaded',
    url: '#',
    thumbnailUrl: '#',
    duration_seconds: DEFAULT_IMAGE_DURATION,
  }), []);

  const mergeBackendScenesIntoLocal = useCallback((
    backendScenes: CustomVideoScene[],
    previousScenes: Scene[]
  ) => {
    if (backendScenes.length === 0) {
      return [];
    }

    return backendScenes.map((backendScene, index) => {
      const previousScene =
        previousScenes.find((scene) => scene.backendSceneId === backendScene.id) ||
        previousScenes[index];

      const primaryAssets = recalculatePrimaryTimes(
        (backendScene.primary_assets || []).map((sceneAsset) => {
          const asset = libraryAssets.find((libraryAsset) => libraryAsset.id === sceneAsset.asset_id) || createFallbackAsset(sceneAsset.asset_id);
          const duration = Math.max(
            MIN_DURATION,
            (sceneAsset.end_time ?? 0) - (sceneAsset.start_time ?? 0) || (asset.type === 'image' ? DEFAULT_IMAGE_DURATION : asset.duration_seconds)
          );

          return {
            id: `timeline-${sceneAsset.asset_id}-${backendScene.id}-${Math.random().toString(36).slice(2, 8)}`,
            assetId: sceneAsset.asset_id,
            asset,
            start: sceneAsset.start_time ?? 0,
            end: (sceneAsset.start_time ?? 0) + duration,
            duration,
          };
        })
      );

      const secondaryAssets = (backendScene.secondary_assets && backendScene.secondary_assets.length > 0)
        ? [[...backendScene.secondary_assets]
            .sort((left, right) => (left.start_time ?? 0) - (right.start_time ?? 0))
            .map((sceneAsset) => {
              const asset = libraryAssets.find((libraryAsset) => libraryAsset.id === sceneAsset.asset_id) || createFallbackAsset(sceneAsset.asset_id);
              const duration = Math.max(
                MIN_DURATION,
                (sceneAsset.end_time ?? 0) - (sceneAsset.start_time ?? 0) || (asset.type === 'image' ? DEFAULT_IMAGE_DURATION : asset.duration_seconds)
              );

              return {
                id: `timeline-${sceneAsset.asset_id}-${backendScene.id}-${Math.random().toString(36).slice(2, 8)}`,
                assetId: sceneAsset.asset_id,
                asset,
                start: sceneAsset.start_time ?? 0,
                end: (sceneAsset.start_time ?? 0) + duration,
                duration,
              };
            })]
        : previousScene?.secondaryAssets || [];

      const narrationAssetId = backendScene.audio_asset_id || null;
      const narration = narrationAssetId
        ? (() => {
            const asset = libraryAssets.find((libraryAsset) => libraryAsset.id === narrationAssetId) || {
              id: narrationAssetId,
              title: backendScene.voiceover_text || `Audio ${narrationAssetId}`,
              type: 'audio' as const,
              source: 'uploaded' as const,
              url: '#',
              duration_seconds: Math.max(MIN_DURATION, (backendScene.duration_ms || 0) / 1000 || 10),
            };

            const duration = Math.max(MIN_DURATION, (backendScene.duration_ms || 0) / 1000 || asset.duration_seconds);

            return {
              id: `timeline-${narrationAssetId}-${backendScene.id}`,
              assetId: narrationAssetId,
              asset,
              start: 0,
              end: duration,
              duration,
            };
          })()
        : previousScene?.narration || null;

      const rawSubtitleConfig = backendScene.subtitle_config || null;
      const subtitle = rawSubtitleConfig
        ? {
            presetId: String(rawSubtitleConfig.presetId ?? rawSubtitleConfig.preset_id ?? DEFAULT_SUBTITLE_CONFIG.presetId),
            presetName: String(rawSubtitleConfig.presetName ?? rawSubtitleConfig.preset_name ?? DEFAULT_SUBTITLE_CONFIG.presetName),
            font: String(rawSubtitleConfig.font ?? DEFAULT_SUBTITLE_CONFIG.font),
            color: String(rawSubtitleConfig.color ?? DEFAULT_SUBTITLE_CONFIG.color),
            shadow: String(rawSubtitleConfig.shadow ?? DEFAULT_SUBTITLE_CONFIG.shadow),
            position: String(rawSubtitleConfig.position ?? DEFAULT_SUBTITLE_CONFIG.position),
          }
        : previousScene?.subtitle || null;

      const normalizedPrimaryAssets =
        narration && primaryAssets.length > 0 && Math.abs(primaryAssets.reduce((sum, asset) => sum + asset.duration, 0) - narration.duration) > 0.01
          ? distributePrimaryAssetsEvenly(primaryAssets, narration.duration)
          : primaryAssets;

      return {
        id: previousScene?.id || `scene-${backendScene.id}`,
        backendSceneId: backendScene.id,
        primaryAssets: normalizedPrimaryAssets,
        secondaryAssets,
        narration,
        subtitle,
      };
    });
  }, [createFallbackAsset, distributePrimaryAssetsEvenly, libraryAssets]);

  const buildScenePayload = useCallback((scene: Scene, index: number) => {
    const { narrationDur, primaryDur } = getSceneDurations(scene);
    const sceneDurationSeconds = scene.narration ? narrationDur : primaryDur;

    return {
      order: index,
      title: `Scene ${index + 1}`,
      kind: 'asset',
      use_avatar: false,
      voiceover_text: scene.narration?.asset.title || '',
      audio_asset_id: scene.narration?.assetId,
      primary_assets: scene.primaryAssets.map((asset) => ({
        asset_id: asset.assetId,
        start_time: asset.start,
        end_time: asset.end,
      })),
      secondary_assets: scene.secondaryAssets.flat().map((asset) => ({
        asset_id: asset.assetId,
        start_time: asset.start,
        end_time: asset.end,
      })),
      subtitle_config: scene.subtitle
        ? {
            presetId: scene.subtitle.presetId,
            presetName: scene.subtitle.presetName,
            font: scene.subtitle.font,
            color: scene.subtitle.color,
            shadow: scene.subtitle.shadow,
            position: scene.subtitle.position,
          }
        : undefined,
      duration_ms: Math.max(1000, Math.round(sceneDurationSeconds * 1000)),
      extra_metadata: {
        local_scene_id: scene.id,
      },
    };
  }, [getSceneDurations]);

  const buildBulkScenePayloads = useCallback((sceneList: Scene[]) => {
    return sceneList
      .filter((scene) => !isSceneEmpty(scene))
      .map((scene, index) => buildScenePayload(scene, index));
  }, [buildScenePayload, isSceneEmpty]);

  const queueSceneSave = useCallback((sceneId: string) => {
    setQueuedSceneSaveIds((currentIds) => (
      currentIds.includes(sceneId) ? currentIds : [...currentIds, sceneId]
    ));
  }, []);

  const refreshScenesFromVideo = useCallback(async (video: CustomVideo) => {
    const detailedScenes = video.scenes || [];
    setScenes((previousScenes) => {
      return mergeBackendScenesIntoLocal(detailedScenes, previousScenes);
    });
    setCustomVideoStatus(video.status);
    setRenderProgress(video.progress || 0);
    setRenderOutputUrl(video.output_url || null);
    setRenderErrorMessage(video.error_message || null);
    setQueuedSceneSaveIds([]);

    return detailedScenes;
  }, [mergeBackendScenesIntoLocal]);

  const syncScenesToBackend = useCallback(async (videoId: string) => {
    setSyncingScenes(true);
    try {
      const savableScenes = scenes.filter((scene) => !isSceneEmpty(scene));

      for (const [index, scene] of savableScenes.entries()) {
        const payload = buildScenePayload(scene, index);
        if (scene.backendSceneId) {
          await customVideosApi.updateScene(videoId, scene.backendSceneId, payload);
        } else {
          await customVideosApi.addScene(videoId, payload);
        }
      }

      const refreshedVideo = await customVideosApi.get(videoId);
      await refreshScenesFromVideo(refreshedVideo);

      return refreshedVideo;
    } finally {
      setSyncingScenes(false);
    }
  }, [buildScenePayload, isSceneEmpty, refreshScenesFromVideo, scenes]);

  const handleSaveDraft = useCallback(async () => {
    if (!customVideoId) {
      alert('Unable to save draft because the draft is not ready yet.');
      return;
    }

    setSavingDraft(true);

    try {
      const updatedVideo = await customVideosApi.bulkReplaceScenes(
        customVideoId,
        buildBulkScenePayloads(scenes)
      );
      await refreshScenesFromVideo(updatedVideo);
    } catch (error) {
      console.error('Failed to save draft:', error);
      alert(getApiErrorMessage(error, 'Failed to save draft.'));
    } finally {
      setSavingDraft(false);
    }
  }, [buildBulkScenePayloads, customVideoId, refreshScenesFromVideo, scenes]);

  const loadBackgroundTracks = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setLoadingBackgroundTracks(true);
    } else {
      setRefreshingBackgroundTracks(true);
    }

    try {
      const data = await musicTracksApi.list();
      setBackgroundTracks(data.items || []);
    } catch (error) {
      console.error('Failed to load background music tracks:', error);
      alert(getApiErrorMessage(error, 'Failed to load background music tracks.'));
    } finally {
      setLoadingBackgroundTracks(false);
      setRefreshingBackgroundTracks(false);
    }
  }, []);

  const toggleBackgroundTrackPlay = useCallback(async (track: MusicTrack) => {
    if (playingBackgroundTrackId === track.id) {
      backgroundAudioRef.current?.pause();
      setPlayingBackgroundTrackId(null);
      return;
    }

    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.pause();
    }

    const audio = new Audio(track.audio_url);
    audio.onended = () => setPlayingBackgroundTrackId(null);
    audio.onpause = () => {
      setPlayingBackgroundTrackId((currentId) => (currentId === track.id ? null : currentId));
    };

    backgroundAudioRef.current = audio;
    setPlayingBackgroundTrackId(track.id);

    try {
      await audio.play();
    } catch (error) {
      console.error('Failed to play background track:', error);
      setPlayingBackgroundTrackId(null);
      alert('Unable to play this background track right now.');
    }
  }, [playingBackgroundTrackId]);

  const loadPickerAssets = useCallback(async (mode: 'replace' | 'append' | 'refresh' = 'replace') => {
    if (!showAssetPicker) {
      return;
    }

    if (mode === 'append') {
      setLoadingMorePickerAssets(true);
    } else if (mode === 'refresh') {
      setRefreshingPickerAssets(true);
    } else {
      setLoadingPickerAssets(true);
    }

    try {
      const assetTypeParam =
        pickerAllowedTypes?.length === 1
          ? pickerAllowedTypes[0]
          : pickerAssetTypeFilter === 'all'
            ? undefined
            : pickerAssetTypeFilter;

      const response = await assetsApi.list({
        page: pickerPage,
        page_size: pickerPageSize,
        asset_type: assetTypeParam,
        source_type: pickerSourceTypeFilter === 'all' ? undefined : pickerSourceTypeFilter,
        search: debouncedPickerSearch || undefined,
      });

      const readyAssets = response.items
        .filter((item) => item.status === 'ready')
        .map(mapLibraryAsset)
        .filter((asset) => !pickerAllowedTypes || pickerAllowedTypes.includes(asset.type));

      setPickerAssets((currentAssets) => (
        mode === 'append' ? mergeAssetsById(currentAssets, readyAssets) : readyAssets
      ));
      setLibraryAssets((currentAssets) => mergeAssetsById(currentAssets, readyAssets));
      setPickerHasMore(response.page * response.page_size < response.total);
    } catch (error) {
      console.error('Failed to load asset picker library:', error);
      alert(getApiErrorMessage(error, 'Failed to load assets.'));
    } finally {
      setLoadingPickerAssets(false);
      setRefreshingPickerAssets(false);
      setLoadingMorePickerAssets(false);
    }
  }, [
    debouncedPickerSearch,
    pickerAllowedTypes,
    pickerAssetTypeFilter,
    pickerPage,
    pickerPageSize,
    pickerSourceTypeFilter,
    showAssetPicker,
  ]);

  const resetPickerUploadState = useCallback(() => {
    setPickerSelectedFile(null);
    setPickerFilePreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }
      return null;
    });
    setPickerUploadError(null);
    if (pickerFileInputRef.current) {
      pickerFileInputRef.current.value = '';
    }
  }, []);

  const refreshPickerAssets = useCallback(async () => {
    if (pickerPage === 1) {
      await loadPickerAssets('refresh');
      return;
    }

    setPickerPage(1);
  }, [loadPickerAssets, pickerPage]);

  const openAssetPicker = useCallback((
    target: { sceneId?: string; rowType: 'primary' | 'secondary' | 'narration' | 'globalBg'; secondaryOverlapIndex?: number; },
    allowedTypes?: AssetType[]
  ) => {
    setCurrentPickerTarget(target);
    setPickerAllowedTypes(allowedTypes);
    setShowAssetPicker(true);
    setPickerSearchInput('');
    setDebouncedPickerSearch('');
    setPickerSourceTypeFilter('all');
    setPickerAssetTypeFilter(allowedTypes && allowedTypes.length === 1 ? allowedTypes[0] : 'all');
    setPickerAiContentType(allowedTypes && allowedTypes.length > 0 ? allowedTypes[0] : 'image');
    setPickerPage(1);
    resetPickerUploadState();
  }, [resetPickerUploadState]);

  const closeAssetPicker = useCallback(() => {
    setShowAssetPicker(false);
    setCurrentPickerTarget(null);
    setPickerAllowedTypes(undefined);
  }, []);

  const handlePickerFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      resetPickerUploadState();
      return;
    }

    const assetType = getFileAssetType(file);

    if (!assetType) {
      setPickerSelectedFile(null);
      setPickerFilePreviewUrl((currentPreviewUrl) => {
        if (currentPreviewUrl) {
          URL.revokeObjectURL(currentPreviewUrl);
        }
        return null;
      });
      setPickerUploadError('Please choose an image, video, or audio file.');
      return;
    }

    if (pickerAllowedTypes && !pickerAllowedTypes.includes(assetType)) {
      setPickerSelectedFile(null);
      setPickerFilePreviewUrl((currentPreviewUrl) => {
        if (currentPreviewUrl) {
          URL.revokeObjectURL(currentPreviewUrl);
        }
        return null;
      });
      if (pickerFileInputRef.current) {
        pickerFileInputRef.current.value = '';
      }
      setPickerUploadError(`This picker only accepts ${pickerAllowedTypes.join(', ')} assets.`);
      return;
    }

    setPickerUploadError(null);
    setPickerSelectedFile(file);
    setPickerFilePreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }

      return assetType === 'audio' ? null : URL.createObjectURL(file);
    });
  }, [pickerAllowedTypes, resetPickerUploadState]);

  const handlePickerUpload = useCallback(async () => {
    if (!pickerSelectedFile) {
      return;
    }

    const assetType = getFileAssetType(pickerSelectedFile);

    if (!assetType) {
      setPickerUploadError('Unsupported file type.');
      return;
    }

    setPickerUploading(true);
    setPickerUploadError(null);

    try {
      const uploadedAsset = await assetsApi.upload(
        pickerSelectedFile,
        pickerSelectedFile.name.replace(/\.[^/.]+$/, ''),
        assetType
      );
      const mappedAsset = mapLibraryAsset(uploadedAsset);

      setLibraryAssets((currentAssets) => mergeAssetsById(currentAssets, [mappedAsset]));
      resetPickerUploadState();

      if (pickerPage === 1) {
        await loadPickerAssets('refresh');
      } else {
        setPickerPage(1);
      }
    } catch (error) {
      console.error('Failed to upload asset from picker:', error);
      setPickerUploadError(getApiErrorMessage(error, 'Failed to upload asset.'));
    } finally {
      setPickerUploading(false);
    }
  }, [loadPickerAssets, pickerPage, pickerSelectedFile, resetPickerUploadState]);

  const handlePickerGenerate = useCallback(async () => {
    if (!pickerAiPrompt.trim()) {
      return;
    }

    setPickerGeneratingAI(true);
    setPickerGenerationError(null);

    try {
      const response = await assetsApi.generate({
        asset_type: pickerAiContentType,
        prompt: pickerAiContentType === 'audio' ? undefined : pickerAiPrompt,
        text: pickerAiContentType === 'audio' ? pickerAiPrompt : undefined,
        aspect_ratio: pickerAiContentType === 'audio' ? undefined : pickerAiAspectRatio,
        duration_seconds: Number(pickerAiDurationSeconds) || 5,
      });

      if (response.asset) {
        const mappedAsset = mapLibraryAsset(response.asset);
        setLibraryAssets((currentAssets) => mergeAssetsById(currentAssets, [mappedAsset]));
        setPickerAiPrompt('');

        if (pickerPage === 1) {
          await loadPickerAssets('refresh');
        } else {
          setPickerPage(1);
        }
      } else {
        setPickerGenerationJob(response);

        if (response.job_id) {
          setPickerPollingGeneration(true);
        } else {
          setPickerGenerationError('Generation started, but the backend did not return polling details.');
        }
      }
    } catch (error) {
      console.error('Failed to generate asset from picker:', error);
      setPickerGenerationError(getApiErrorMessage(error, 'Failed to generate asset.'));
    } finally {
      setPickerGeneratingAI(false);
    }
  }, [
    loadPickerAssets,
    pickerAiAspectRatio,
    pickerAiContentType,
    pickerAiDurationSeconds,
    pickerAiPrompt,
    pickerPage,
  ]);

  useEffect(() => {
    const loadLibraryAssets = async () => {
      setLoadingLibraryAssets(true);
      try {
        const data = await assetsApi.list({ page: 1, page_size: 100 });
        const usableAssets = data.items
          .filter((asset) => asset.status === 'ready')
          .map(mapLibraryAsset);
        setLibraryAssets(usableAssets);
      } catch (error) {
        console.error('Failed to load asset library:', error);
        alert(getApiErrorMessage(error, 'Failed to load asset library.'));
      } finally {
        setLoadingLibraryAssets(false);
      }
    };

    void loadLibraryAssets();
  }, []);

  useEffect(() => {
    if (currentStep !== 2 || backgroundTracks.length > 0 || loadingBackgroundTracks) {
      return;
    }

    void loadBackgroundTracks();
  }, [backgroundTracks.length, currentStep, loadBackgroundTracks, loadingBackgroundTracks]);

  useEffect(() => {
    return () => {
      backgroundAudioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedPickerSearch(pickerSearchInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pickerSearchInput]);

  useEffect(() => {
    return () => {
      if (pickerFilePreviewUrl) {
        URL.revokeObjectURL(pickerFilePreviewUrl);
      }
    };
  }, [pickerFilePreviewUrl]);

  useEffect(() => {
    if (!showAssetPicker) {
      return;
    }

    if (
      lastPickerQueryKeyRef.current &&
      lastPickerQueryKeyRef.current !== pickerQueryKey &&
      pickerPage !== 1
    ) {
      lastPickerQueryKeyRef.current = pickerQueryKey;
      setPickerPage(1);
      return;
    }

    lastPickerQueryKeyRef.current = pickerQueryKey;
    void loadPickerAssets(pickerPage === 1 ? 'replace' : 'append');
  }, [
    loadPickerAssets,
    pickerPage,
    pickerQueryKey,
    showAssetPicker,
  ]);

  useEffect(() => {
    if (!pickerGenerationJob?.job_id || !pickerPollingGeneration) {
      return;
    }

    let cancelled = false;

    const pollGenerationJob = async () => {
      try {
        const result = await assetsApi.pollGenerationJob(
          pickerGenerationJob.job_id!,
          pickerGenerationJob.poll_url || undefined
        );

        if (cancelled) {
          return;
        }

        setPickerGenerationJob(result);

        if (result.asset) {
          const mappedAsset = mapLibraryAsset(result.asset);
          setLibraryAssets((currentAssets) => mergeAssetsById(currentAssets, [mappedAsset]));
          setPickerPollingGeneration(false);
          setPickerAiPrompt('');
          setPickerGenerationJob(null);
          setPickerGenerationError(null);

          if (pickerPage === 1) {
            await loadPickerAssets('refresh');
          } else {
            setPickerPage(1);
          }
          return;
        }

        if (result.status === 'failed') {
          setPickerPollingGeneration(false);
          setPickerGenerationError(result.error || 'AI generation failed.');
          return;
        }

        window.setTimeout(() => {
          if (!cancelled) {
            void pollGenerationJob();
          }
        }, 1500);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to poll picker generation job:', error);
          setPickerPollingGeneration(false);
          setPickerGenerationError(getApiErrorMessage(error, 'Failed to poll generation progress.'));
        }
      }
    };

    void pollGenerationJob();

    return () => {
      cancelled = true;
    };
  }, [loadPickerAssets, pickerGenerationJob?.job_id, pickerGenerationJob?.poll_url, pickerPage, pickerPollingGeneration]);

  useEffect(() => {
    if (!routeId || routeId === customVideoId || loadingLibraryAssets) {
      return;
    }

    let cancelled = false;

    const hydrateDraftFromRoute = async () => {
      setHydratingDraft(true);

      try {
        const draft = await customVideosApi.get(routeId);

        if (cancelled) {
          return;
        }

        setCustomVideoId(draft.id);
        await refreshScenesFromVideo(draft);

        if (cancelled) {
          return;
        }

        const shouldOpenEditor =
          isEditMode &&
          (draft.status === 'draft' || draft.status === 'completed' || draft.status === 'failed');

        setCurrentStep(shouldOpenEditor || draft.status === 'draft' ? 1 : 4);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Failed to hydrate draft from route:', error);
      } finally {
        if (!cancelled) {
          setHydratingDraft(false);
        }
      }
    };

    void hydrateDraftFromRoute();

    return () => {
      cancelled = true;
    };
  }, [customVideoId, isEditMode, loadingLibraryAssets, refreshScenesFromVideo, routeId]);

  useEffect(() => {
    if (!customVideoId || (customVideoStatus !== 'finalizing' && customVideoStatus !== 'rendering')) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const polledVideo = await customVideosApi.poll(customVideoId);
        setCustomVideoStatus(polledVideo.status);
        setRenderProgress(polledVideo.progress || 0);
        setRenderOutputUrl(polledVideo.output_url || null);
        setRenderErrorMessage(polledVideo.error_message || null);
      } catch (error) {
        console.error('Failed to poll render progress:', error);
      }
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [customVideoId, customVideoStatus]);

  useEffect(() => {
    if (!customVideoId || currentStep !== 3) {
      return;
    }

    let cancelled = false;

    const loadReviewDraft = async () => {
      setLoadingReviewDraft(true);

      try {
        const draft = await customVideosApi.get(customVideoId);

        if (cancelled) {
          return;
        }

        setReviewDraft(draft);
        setCustomVideoStatus(draft.status);
        setRenderProgress(draft.progress || 0);
        setRenderOutputUrl(draft.output_url || null);
        setRenderErrorMessage(draft.error_message || null);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load review draft:', error);
        }
      } finally {
        if (!cancelled) {
          setLoadingReviewDraft(false);
        }
      }
    };

    void loadReviewDraft();

    return () => {
      cancelled = true;
    };
  }, [currentStep, customVideoId]);

  useEffect(() => {
    if (!customVideoId || isInitialPageLoading || syncingScenes || savingDraft || deletingSceneId || savingSceneId || queuedSceneSaveIds.length === 0) {
      return;
    }

    const sceneIdToSave = queuedSceneSaveIds[0];
    const sceneIndex = scenes.findIndex((scene) => scene.id === sceneIdToSave);
    const sceneToSave = sceneIndex >= 0 ? scenes[sceneIndex] : null;

    if (!sceneToSave?.backendSceneId) {
      setQueuedSceneSaveIds((currentIds) => currentIds.filter((id) => id !== sceneIdToSave));
      return;
    }

    const backendSceneId = sceneToSave.backendSceneId;

    const timeoutId = window.setTimeout(async () => {
      setSavingSceneId(sceneToSave.id);

      try {
        await customVideosApi.updateScene(
          customVideoId,
          backendSceneId,
          buildScenePayload(sceneToSave, sceneIndex)
        );
      } catch (error) {
        console.error('Failed to auto-save scene changes:', error);
      } finally {
        setSavingSceneId(null);
        setQueuedSceneSaveIds((currentIds) => currentIds.filter((id) => id !== sceneIdToSave));
      }
    }, 600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [buildScenePayload, customVideoId, deletingSceneId, isInitialPageLoading, queuedSceneSaveIds, savingDraft, savingSceneId, scenes, syncingScenes]);

  // --- Handlers ---
  const handleAddScene = async () => {
    if (!customVideoId) {
      alert('Unable to create a scene because the draft is not ready yet.');
      return;
    }

    try {
      await syncScenesToBackend(customVideoId);
      const newSceneOrder = scenes.filter((scene) => !isSceneEmpty(scene)).length;
      await customVideosApi.addScene(customVideoId, {
        order: newSceneOrder,
        title: `Scene ${newSceneOrder + 1}`,
        kind: 'asset',
        use_avatar: false,
        primary_assets: [],
        secondary_assets: [],
        duration_ms: 1000,
      });
      const refreshedVideo = await customVideosApi.get(customVideoId);
      await refreshScenesFromVideo(refreshedVideo);
    } catch (error) {
      console.error('Failed to create a new scene:', error);
      alert(getApiErrorMessage(error, 'Failed to create a new scene.'));
    }
  };

  const handleContinueToStep3 = async () => {
    if (!customVideoId) {
      alert('Unable to continue because the draft is not ready yet.');
      return;
    }

    try {
      await syncScenesToBackend(customVideoId);
      setCurrentStep(2);
    } catch (error) {
      console.error('Failed to save scenes:', error);
      alert(getApiErrorMessage(error, 'Failed to save scenes.'));
    }
  };

  const handleOpenFinalizeReview = async () => {
    if (!customVideoId) {
      alert('Unable to continue because the draft is not ready yet.');
      return;
    }

    setLoadingReviewDraft(true);

    try {
      const draft = await customVideosApi.get(customVideoId);
      setReviewDraft(draft);
      setCustomVideoStatus(draft.status);
      setRenderProgress(draft.progress || 0);
      setRenderOutputUrl(draft.output_url || null);
      setRenderErrorMessage(draft.error_message || null);
      setCurrentStep(3);
    } catch (error) {
      console.error('Failed to load finalize review:', error);
      alert(getApiErrorMessage(error, 'Failed to load video details.'));
    } finally {
      setLoadingReviewDraft(false);
    }
  };

  const handleCreateVideo = async () => {
    if (!customVideoId) {
      alert('Unable to finalize because the draft is not ready yet.');
      return;
    }

    setFinalizingVideo(true);

    try {
      await syncScenesToBackend(customVideoId);
      const finalizeResponse = await customVideosApi.finalize(customVideoId, {
        music_track_id: selectedBackgroundTrack?.id || null,
      });
      if ('status' in finalizeResponse && typeof finalizeResponse.status === 'string') {
        setCustomVideoStatus(finalizeResponse.status as CustomVideoStatus);
      }
      if ('progress' in finalizeResponse && typeof finalizeResponse.progress === 'number') {
        setRenderProgress(finalizeResponse.progress);
      }
      setCurrentStep(4);
      const polledVideo = await customVideosApi.poll(customVideoId);
      setCustomVideoStatus(polledVideo.status);
      setRenderProgress(polledVideo.progress || 0);
      setRenderOutputUrl(polledVideo.output_url || null);
      setRenderErrorMessage(polledVideo.error_message || null);
    } catch (error) {
      console.error('Failed to finalize video:', error);
      alert(getApiErrorMessage(error, 'Failed to finalize video.'));
    } finally {
      setFinalizingVideo(false);
    }
  };

  const handleDeleteScene = useCallback(async (sceneId: string) => {
    const sceneToDelete = scenes.find((scene) => scene.id === sceneId);
    if (!sceneToDelete) {
      return;
    }

    if (!customVideoId || !sceneToDelete.backendSceneId) {
      setScenes((previousScenes) => previousScenes.filter((scene) => scene.id !== sceneId));
      setQueuedSceneSaveIds((currentIds) => currentIds.filter((id) => id !== sceneId));
      return;
    }

    setDeletingSceneId(sceneId);

    try {
      await customVideosApi.deleteScene(customVideoId, sceneToDelete.backendSceneId);
      const refreshedVideo = await customVideosApi.get(customVideoId);
      await refreshScenesFromVideo(refreshedVideo);
    } catch (error) {
      console.error('Failed to delete scene:', error);
      alert(getApiErrorMessage(error, 'Failed to delete scene.'));
    } finally {
      setDeletingSceneId(null);
    }
  }, [customVideoId, refreshScenesFromVideo, scenes]);

  const handleAssetSelect = useCallback((selectedAsset: Asset) => {
    if (!currentPickerTarget) return;
    const { sceneId, rowType, secondaryOverlapIndex } = currentPickerTarget;

    // Handle Global Background Music Selection
    // Handle Scene Asset Selection (Step 2)
    const targetScene = sceneId ? scenes.find((scene) => scene.id === sceneId) : null;
    const shouldQueueSave = !!targetScene?.backendSceneId;

    setScenes((prevScenes) =>
      prevScenes.map((scene) => {
        if (scene.id === sceneId) {
          let initialDuration = selectedAsset.duration_seconds;
          if (selectedAsset.type === 'image' && rowType === 'primary') initialDuration = DEFAULT_IMAGE_DURATION; 

          const newTimelineAsset: TimelineAsset = {
            id: `timeline-${selectedAsset.id}-${Date.now()}`,
            assetId: selectedAsset.id,
            asset: selectedAsset,
            start: 0, end: initialDuration, duration: initialDuration,
          };

          if (rowType === 'narration') {
            return {
              ...scene,
              narration: newTimelineAsset,
              primaryAssets:
                scene.primaryAssets.length > 0
                  ? distributePrimaryAssetsEvenly(scene.primaryAssets, newTimelineAsset.duration)
                  : scene.primaryAssets,
            };
          } else if (rowType === 'primary') {
            if (scene.narration) {
              return {
                ...scene,
                primaryAssets: distributePrimaryAssetsEvenly(
                  [...scene.primaryAssets, newTimelineAsset],
                  scene.narration.duration
                ),
              };
            }

            const currentTotal = scene.primaryAssets.reduce((sum, a) => sum + a.duration, 0);
            newTimelineAsset.start = currentTotal;
            newTimelineAsset.end = currentTotal + initialDuration;
            return { ...scene, primaryAssets: [...scene.primaryAssets, newTimelineAsset] };
          } else if (rowType === 'secondary') {
            newTimelineAsset.start = 0;
            newTimelineAsset.end = newTimelineAsset.duration;
            const updatedSecondaryAssets = [...scene.secondaryAssets];
            if (secondaryOverlapIndex !== undefined && secondaryOverlapIndex < updatedSecondaryAssets.length) {
              const track = updatedSecondaryAssets[secondaryOverlapIndex];
              if (track.length > 0) {
                 const lastAsset = track[track.length - 1];
                 newTimelineAsset.start = lastAsset.end;
                 newTimelineAsset.end = newTimelineAsset.start + newTimelineAsset.duration;
              }
              updatedSecondaryAssets[secondaryOverlapIndex] = [...track, newTimelineAsset];
            } else {
              updatedSecondaryAssets.push([newTimelineAsset]);
            }
            return { ...scene, secondaryAssets: updatedSecondaryAssets };
          }
        }
        return scene;
      })
    );
    if (sceneId && shouldQueueSave) {
      queueSceneSave(sceneId);
    }
    closeAssetPicker();
  }, [closeAssetPicker, currentPickerTarget, distributePrimaryAssetsEvenly, queueSceneSave, scenes]);

  const handleRemoveAsset = useCallback((sceneId: string, rowType: 'primary' | 'secondary' | 'narration' | 'subtitle', timelineAssetId?: string, secondaryOverlapIndex?: number) => {
    const targetScene = scenes.find((scene) => scene.id === sceneId);
    const shouldQueueSave = !!targetScene?.backendSceneId;

    setScenes((prevScenes) =>
      prevScenes.map((scene) => {
        if (scene.id === sceneId) {
          const updatedScene = { ...scene };
          if (rowType === 'narration') updatedScene.narration = null;
          else if (rowType === 'subtitle') updatedScene.subtitle = null;
          else if (rowType === 'primary') {
            updatedScene.primaryAssets = updatedScene.primaryAssets.filter((a) => a.id !== timelineAssetId);
            updatedScene.primaryAssets =
              updatedScene.narration && updatedScene.primaryAssets.length > 0
                ? distributePrimaryAssetsEvenly(updatedScene.primaryAssets, updatedScene.narration.duration)
                : recalculatePrimaryTimes(updatedScene.primaryAssets);
          } else if (rowType === 'secondary' && secondaryOverlapIndex !== undefined) {
            updatedScene.secondaryAssets[secondaryOverlapIndex] = updatedScene.secondaryAssets[secondaryOverlapIndex].filter((a) => a.id !== timelineAssetId);
          }
          return updatedScene;
        }
        return scene;
      })
    );
    if (shouldQueueSave) {
      queueSceneSave(sceneId);
    }
  }, [distributePrimaryAssetsEvenly, queueSceneSave, scenes]);

  const handleSwapPrimary = useCallback((sceneId: string, index: number, direction: 'left' | 'right') => {
    const targetScene = scenes.find((scene) => scene.id === sceneId);
    const shouldQueueSave = !!targetScene?.backendSceneId;
    setScenes((prev) => prev.map(scene => {
      if (scene.id !== sceneId) return scene;
      const newPrimary = [...scene.primaryAssets];
      if (direction === 'left' && index > 0) {
        const temp = newPrimary[index]; newPrimary[index] = newPrimary[index - 1]; newPrimary[index - 1] = temp;
      } else if (direction === 'right' && index < newPrimary.length - 1) {
        const temp = newPrimary[index]; newPrimary[index] = newPrimary[index + 1]; newPrimary[index + 1] = temp;
      } else { return scene; }
      return { ...scene, primaryAssets: recalculatePrimaryTimes(newPrimary) };
    }));
    if (shouldQueueSave) {
      queueSceneSave(sceneId);
    }
  }, [queueSceneSave, scenes]);

  const handleSwapSecondary = useCallback((sceneId: string, trackIndex: number, index: number, direction: 'left' | 'right') => {
    const targetScene = scenes.find((scene) => scene.id === sceneId);
    const shouldQueueSave = !!targetScene?.backendSceneId;
    setScenes((prev) => prev.map(scene => {
      if (scene.id !== sceneId) return scene;
      const newSecondary = [...scene.secondaryAssets];
      const track = [...newSecondary[trackIndex]];
      
      const leftIdx = direction === 'left' ? index - 1 : index;
      const rightIdx = direction === 'left' ? index : index + 1;
      if (leftIdx < 0 || rightIdx >= track.length) return scene; 

      const leftAsset = track[leftIdx]; const rightAsset = track[rightIdx];
      const gap = rightAsset.start - leftAsset.end;
      const startAnchor = leftAsset.start;

      track[leftIdx] = { ...rightAsset, start: startAnchor, end: startAnchor + rightAsset.duration };
      track[rightIdx] = { ...leftAsset, start: startAnchor + rightAsset.duration + gap, end: startAnchor + rightAsset.duration + gap + leftAsset.duration };
      
      newSecondary[trackIndex] = track;
      return { ...scene, secondaryAssets: newSecondary };
    }));
    if (shouldQueueSave) {
      queueSceneSave(sceneId);
    }
  }, [queueSceneSave, scenes]);

  // --- DRAG LOGIC (Multi-Scene Aware) ---
  const handleDragStartPrimaryResize = (e: React.MouseEvent, sceneId: string, assetIndex: number) => {
    e.preventDefault(); e.stopPropagation();
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const trackWidth = getTrackSurfaceWidth(e.currentTarget);
    setDragState({ type: 'primary-resize', sceneId, assetIndex, startX: e.clientX, origDuration: scene.primaryAssets[assetIndex].duration, trackWidth });
  };

  const handleDragStartSecondaryEdge = (e: React.MouseEvent, sceneId: string, trackIndex: number, assetIndex: number, edge: 'left' | 'right') => {
    e.preventDefault(); e.stopPropagation();
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const trackWidth = getTrackSurfaceWidth(e.currentTarget);
    const track = scene.secondaryAssets[trackIndex];
    const targetAsset = track[assetIndex];

    const { displayDuration } = getSceneDurations(scene);
    let minLimit = 0; let maxLimit = displayDuration; 
    if (edge === 'left' && assetIndex > 0) minLimit = track[assetIndex - 1].end;
    if (edge === 'right' && assetIndex < track.length - 1) maxLimit = track[assetIndex + 1].start;

    setDragState({ type: 'secondary-edge', sceneId, trackIndex, assetIndex, edge, startX: e.clientX, origStart: targetAsset.start, origDuration: targetAsset.duration, minLimit, maxLimit, trackWidth });
  };

  const handleDragStartSecondaryMove = (e: React.MouseEvent, sceneId: string, trackIndex: number, assetIndex: number) => {
    e.preventDefault(); e.stopPropagation();
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const trackWidth = getTrackSurfaceWidth(e.currentTarget);
    const track = scene.secondaryAssets[trackIndex];
    const targetAsset = track[assetIndex];

    const { displayDuration } = getSceneDurations(scene);
    let minStart = 0; let maxStart = displayDuration - targetAsset.duration;
    if (assetIndex > 0) minStart = track[assetIndex - 1].end;
    if (assetIndex < track.length - 1) maxStart = track[assetIndex + 1].start - targetAsset.duration;

    setDragState({ type: 'secondary-move', sceneId, trackIndex, assetIndex, startX: e.clientX, origStart: targetAsset.start, origDuration: targetAsset.duration, minStart, maxStart, trackWidth });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const activeScene = scenes.find(s => s.id === dragState.sceneId);
      if (!activeScene) return;
      
      const { displayDuration } = getSceneDurations(activeScene);
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = (deltaX / dragState.trackWidth) * displayDuration;

      setScenes(prev => prev.map(scene => {
        if (scene.id !== dragState.sceneId) return scene;

        if (dragState.type === 'primary-resize') {
          let newDuration = dragState.origDuration + deltaTime;
          if (scene.narration) {
            return {
              ...scene,
              primaryAssets: resizePrimaryAssetsWithinDuration(
                scene.primaryAssets,
                dragState.assetIndex,
                newDuration,
                scene.narration.duration
              ),
            };
          }

          if (newDuration < MIN_DURATION) newDuration = MIN_DURATION;
          const newPrimary = [...scene.primaryAssets];
          newPrimary[dragState.assetIndex] = { ...newPrimary[dragState.assetIndex], duration: newDuration };
          return { ...scene, primaryAssets: recalculatePrimaryTimes(newPrimary) };
        } 
        else if (dragState.type === 'secondary-edge') {
          const newSecondary = [...scene.secondaryAssets];
          const track = [...newSecondary[dragState.trackIndex]];
          const asset = track[dragState.assetIndex];

          if (dragState.edge === 'right') {
            let newDuration = dragState.origDuration + deltaTime;
            if (newDuration < MIN_DURATION) newDuration = MIN_DURATION;
            if (dragState.origStart + newDuration > dragState.maxLimit) newDuration = dragState.maxLimit - dragState.origStart;
            track[dragState.assetIndex] = { ...asset, duration: newDuration, end: dragState.origStart + newDuration };
          } 
          else if (dragState.edge === 'left') {
            let newStart = dragState.origStart + deltaTime;
            let newDuration = dragState.origDuration - deltaTime;
            if (newStart < dragState.minLimit) { newStart = dragState.minLimit; newDuration = dragState.origStart + dragState.origDuration - dragState.minLimit; }
            if (newDuration < MIN_DURATION) { newDuration = MIN_DURATION; newStart = dragState.origStart + dragState.origDuration - MIN_DURATION; }
            track[dragState.assetIndex] = { ...asset, start: newStart, duration: newDuration, end: newStart + newDuration };
          }
          newSecondary[dragState.trackIndex] = track;
          return { ...scene, secondaryAssets: newSecondary };
        }
        else if (dragState.type === 'secondary-move') {
          const newSecondary = [...scene.secondaryAssets];
          const track = [...newSecondary[dragState.trackIndex]];
          const asset = track[dragState.assetIndex];

          let newStart = dragState.origStart + deltaTime;
          if (newStart < dragState.minStart) newStart = dragState.minStart;
          if (newStart > dragState.maxStart) newStart = dragState.maxStart;

          track[dragState.assetIndex] = { ...asset, start: newStart, end: newStart + dragState.origDuration };
          newSecondary[dragState.trackIndex] = track;
          return { ...scene, secondaryAssets: newSecondary };
        }
        return scene;
      }));
    };

    const handleMouseUp = () => {
      if (dragState?.sceneId) {
        const activeScene = scenes.find((scene) => scene.id === dragState.sceneId);
        if (activeScene?.backendSceneId) {
          queueSceneSave(dragState.sceneId);
        }
      }
      setDragState(null);
    };

    if (dragState.type === 'secondary-move') document.body.style.cursor = 'grabbing';
    else document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { document.body.style.cursor = ''; document.body.style.userSelect = ''; window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [dragState, getSceneDurations, queueSceneSave, resizePrimaryAssetsWithinDuration, scenes]); 


  // --- Render Functions ---

  const getTimelineTickInterval = (displayDuration: number) => {
    if (displayDuration <= 12) return 1;
    if (displayDuration <= 24) return 2;
    if (displayDuration <= 60) return 5;
    if (displayDuration <= 120) return 10;
    return 15;
  };

  const renderTimelineHeader = (displayDuration: number) => {
    const safeDisplayDuration = Math.max(MIN_DURATION, displayDuration);
    const tickInterval = getTimelineTickInterval(safeDisplayDuration);
    const tickCount = Math.floor(safeDisplayDuration / tickInterval);
    const tickMarks = Array.from({ length: tickCount + 1 }, (_, index) => index * tickInterval);

    return (
      <div className="flex items-stretch">
        <div className={`${timelineLabelWidthClass} h-10 flex-shrink-0`} />
        <div className="relative h-10 flex-1 overflow-hidden rounded-t-lg border border-slate-700 bg-slate-800/95">
          {tickMarks.map((tick, index) => {
            const leftPercentage = Math.min(100, Math.max(0, (tick / safeDisplayDuration) * 100));
            const isFirst = index === 0;
            const isLast = index === tickMarks.length - 1;

            return (
              <div
                key={`time-tick-${tick}`}
                className="absolute inset-y-0"
                style={{ left: `${leftPercentage}%` }}
              >
                <div className="absolute inset-y-0 w-px bg-slate-700/80" />
                <span
                  className={`absolute left-0 top-2 whitespace-nowrap text-xs text-slate-400 ${
                    isFirst
                      ? 'translate-x-0 pl-2'
                      : isLast
                        ? '-translate-x-full -ml-2'
                        : '-translate-x-1/2'
                  }`}
                >
                  {formatDuration(tick)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTimelineAsset = (
    timelineAsset: TimelineAsset,
    trackType: 'primary' | 'secondary' | 'narration',
    onRemove: () => void,
    sceneId: string,
    displayDuration: number,
    assetIndex?: number,     
    trackIndex?: number,     
    totalCountInRow?: number 
  ) => {
    const widthPercentage = Math.min(100, Math.max(0, (timelineAsset.duration / displayDuration) * 100));
    const offsetPercentage = Math.min(100, Math.max(0, (timelineAsset.start / displayDuration) * 100));
    const thumbnailCount = Math.max(1, Math.floor(widthPercentage / 10)); 

    return (
      <div
        key={timelineAsset.id}
        className={`absolute top-0 bottom-0 bg-slate-700/80 rounded border border-slate-600 group hover:border-violet-500 transition-all duration-100 flex items-center overflow-visible ${dragState && dragState.type !== 'secondary-move' ? 'pointer-events-none' : ''}`}
        style={{ left: `${offsetPercentage}%`, width: `${widthPercentage}%`, zIndex: trackType === 'secondary' ? 10 : 1 }}
      >
        <div 
          className={`flex w-full h-full overflow-hidden ${trackType === 'secondary' ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
          onMouseDown={(e) => { if (trackType === 'secondary' && trackIndex !== undefined && assetIndex !== undefined) handleDragStartSecondaryMove(e, sceneId, trackIndex, assetIndex); }}
        >
          {timelineAsset.asset.type === 'audio' ? (
            <div className="w-full h-full flex items-center justify-center text-violet-400 text-sm bg-violet-900/20">
              <Mic className="h-5 w-5 mr-2 flex-shrink-0" />
              <span className="truncate">{timelineAsset.asset.title}</span>
            </div>
          ) : (
            <div className="flex w-full h-full bg-slate-800 pointer-events-none">
              {Array.from({ length: thumbnailCount }).map((_, i) => (
                <div key={i} className="flex-1 h-full border-r border-slate-700/50 flex items-center justify-center overflow-hidden bg-slate-900 pointer-events-none">
                  <img src={timelineAsset.asset.type === 'image' ? timelineAsset.asset.url : (timelineAsset.asset as VideoAsset).thumbnailUrl} alt="Asset" className="h-full w-full object-cover opacity-80" />
                </div>
              ))}
            </div>
          )}
        </div>

        {trackType === 'primary' && assetIndex !== undefined && (
            <div className="absolute top-0 bottom-0 -right-2 w-4 cursor-ew-resize z-30 group-hover:bg-violet-400/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto" onMouseDown={(e) => handleDragStartPrimaryResize(e, sceneId, assetIndex)}>
                <div className="h-4 w-1 bg-white/80 rounded-full shadow pointer-events-none" />
            </div>
        )}

        {trackType === 'secondary' && trackIndex !== undefined && assetIndex !== undefined && (
           <>
              <div className="absolute top-0 bottom-0 -left-2 w-4 cursor-ew-resize z-30 group-hover:bg-cyan-400/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto" onMouseDown={(e) => handleDragStartSecondaryEdge(e, sceneId, trackIndex, assetIndex, 'left')}>
                  <div className="h-4 w-1 bg-white/80 rounded-full shadow pointer-events-none" />
              </div>
              <div className="absolute top-0 bottom-0 -right-2 w-4 cursor-ew-resize z-30 group-hover:bg-cyan-400/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto" onMouseDown={(e) => handleDragStartSecondaryEdge(e, sceneId, trackIndex, assetIndex, 'right')}>
                  <div className="h-4 w-1 bg-white/80 rounded-full shadow pointer-events-none" />
              </div>
           </>
        )}

        <div className="absolute top-1 left-2 right-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
          {(trackType === 'primary' || trackType === 'secondary') && assetIndex !== undefined && totalCountInRow !== undefined ? (
             <div className="flex gap-1 bg-slate-900/90 rounded p-0.5 ml-1 items-center pointer-events-auto shadow-md">
                {trackType === 'secondary' && <div className="text-slate-500 mx-1"><GripHorizontal className="h-3.5 w-3.5" /></div>}
                <button onClick={(e) => { e.stopPropagation(); if (trackType === 'primary') handleSwapPrimary(sceneId, assetIndex, 'left'); else handleSwapSecondary(sceneId, trackIndex!, assetIndex, 'left');}} disabled={assetIndex === 0} className={`p-1 rounded transition-colors ${assetIndex === 0 ? 'text-slate-600 cursor-not-allowed' : 'hover:bg-slate-700 text-slate-300 hover:text-white'}`} title="Swap Left"><ChevronLeft className="h-3.5 w-3.5" /></button>
                <div className="w-[1px] h-3 bg-slate-700 mx-0.5"></div>
                <button onClick={(e) => { e.stopPropagation(); if (trackType === 'primary') handleSwapPrimary(sceneId, assetIndex, 'right'); else handleSwapSecondary(sceneId, trackIndex!, assetIndex, 'right');}} disabled={assetIndex === totalCountInRow - 1} className={`p-1 rounded transition-colors ${assetIndex === totalCountInRow - 1 ? 'text-slate-600 cursor-not-allowed' : 'hover:bg-slate-700 text-slate-300 hover:text-white'}`} title="Swap Right"><ChevronRight className="h-3.5 w-3.5" /></button>
             </div>
          ) : (
            <span className="text-white text-xs truncate font-medium bg-black/50 px-1 rounded backdrop-blur-sm pointer-events-none">{timelineAsset.asset.title}</span>
          )}
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-red-400 hover:text-red-500 hover:bg-red-500/20 p-1 rounded-md flex-shrink-0 bg-black/60 backdrop-blur-sm pointer-events-auto ml-auto"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    );
  };


  // --- Master View Rendering ---

  return (
    <DashboardLayout>
      <AssetPicker
        isOpen={showAssetPicker}
        onClose={closeAssetPicker}
        onSelectAsset={handleAssetSelect}
        assets={pickerAssets}
        loading={loadingPickerAssets}
        refreshing={refreshingPickerAssets}
        loadingMore={loadingMorePickerAssets}
        hasMore={pickerHasMore}
        searchValue={pickerSearchInput}
        assetTypeFilter={pickerAssetTypeFilter}
        sourceTypeFilter={pickerSourceTypeFilter}
        selectedFile={pickerSelectedFile}
        filePreviewUrl={pickerFilePreviewUrl}
        uploadError={pickerUploadError}
        uploading={pickerUploading}
        aiPrompt={pickerAiPrompt}
        aiContentType={pickerAiContentType}
        aiAspectRatio={pickerAiAspectRatio}
        aiDurationSeconds={pickerAiDurationSeconds}
        generatingAI={pickerGeneratingAI}
        pollingGeneration={pickerPollingGeneration}
        generationJob={pickerGenerationJob}
        generationError={pickerGenerationError}
        allowedTypes={pickerAllowedTypes}
        onSearchChange={setPickerSearchInput}
        onAssetTypeFilterChange={setPickerAssetTypeFilter}
        onSourceTypeFilterChange={setPickerSourceTypeFilter}
        onRefresh={() => { void refreshPickerAssets(); }}
        onScrollEnd={() => {
          if (!loadingMorePickerAssets && pickerHasMore) {
            setPickerPage((currentPage) => currentPage + 1);
          }
        }}
        onBrowseFile={() => pickerFileInputRef.current?.click()}
        fileInputRef={pickerFileInputRef}
        onFileChange={handlePickerFileSelect}
        onClearFile={resetPickerUploadState}
        onUpload={() => { void handlePickerUpload(); }}
        onAiPromptChange={setPickerAiPrompt}
        onAiContentTypeChange={setPickerAiContentType}
        onAiAspectRatioChange={setPickerAiAspectRatio}
        onAiDurationSecondsChange={setPickerAiDurationSeconds}
        onGenerate={() => { void handlePickerGenerate(); }}
      />
      
      <SubtitleModal 
        key={subtitleModalTarget || 'subtitle-modal'}
        isOpen={!!subtitleModalTarget} 
        onClose={() => setSubtitleModalTarget(null)} 
        initialConfig={subtitleModalTarget ? (scenes.find(s => s.id === subtitleModalTarget)?.subtitle || null) : null}
        onSave={(config) => {
          const targetSceneId = subtitleModalTarget;
          const targetScene = targetSceneId ? scenes.find((scene) => scene.id === targetSceneId) : null;
          const shouldQueueSave = !!targetScene?.backendSceneId;
          setScenes(prev => prev.map(s => {
            if (s.id !== targetSceneId) return s;
            return { ...s, subtitle: config };
          }));
          if (targetSceneId && shouldQueueSave) {
            queueSceneSave(targetSceneId);
          }
          setSubtitleModalTarget(null);
        }}
      />

      <VideoPreviewModal
        isOpen={showFinalVideoModal}
        onClose={() => setShowFinalVideoModal(false)}
        videoUrl={renderOutputUrl}
      />

      {!isInitialPageLoading && (
        <div className="max-w-4xl mx-auto mb-12 mt-4">
          <div className="flex items-center justify-between">
            <WizardStep number={1} title="Video Editor" active={currentStep === 1} completed={currentStep > 1} />
            <WizardLine active={currentStep > 1} />
            <WizardStep number={2} title="Background Music" active={currentStep === 2} completed={currentStep > 2} />
            <WizardLine active={currentStep > 2} />
            <WizardStep number={3} title="Finalize" active={currentStep === 3} completed={currentStep > 3} />
            <WizardLine active={currentStep > 3} />
            <WizardStep number={4} title="Video Generation" active={currentStep === 4} completed={customVideoStatus === 'completed'} />
          </div>
        </div>
      )}

      {isInitialPageLoading && (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="inline-flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-5 py-4 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            Opening your custom video draft...
          </div>
        </div>
      )}

      {/* --- STEP 1: SCENES EDITOR --- */}
      {!isInitialPageLoading && currentStep === 1 && (
        <>
          <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/custom_video">
                <Button variant="outline">Back</Button>
              </Link>
              <h1 className="text-3xl font-bold text-white">Scene Editor</h1>
            </div>
            <div className="flex gap-3">
               <span className="rounded-full border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-400">
                 Ratio already set for this draft
               </span>
               <Button
                  variant="outline"
                  onClick={() => { void handleSaveDraft(); }}
                  loading={savingDraft}
                  disabled={savingDraft || syncingScenes || deletingSceneId !== null}
                >
                  Save Draft
               </Button>
               <Button 
                  onClick={() => { void handleContinueToStep3(); }}
                  loading={syncingScenes}
                  disabled={!canProceedToStep3 || syncingScenes || savingDraft}
                  className={!canProceedToStep3 ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  Next Step <ChevronRight className="w-4 h-4 ml-2" />
               </Button>
            </div>
          </div>

          {scenes.length > 0 && !canProceedToStep3 && (
             <div className="mb-6 bg-amber-500/10 border border-amber-500/20 px-6 py-3 rounded-lg flex items-center gap-3 text-amber-200">
               <AlertTriangle className="h-5 w-5" />
               Every scene requires at least one Primary Asset, Narration, and Subtitles configured before proceeding to Background Music.
             </div>
          )}

          <div className="space-y-10 pb-20">
            {scenes.length === 0 && (
              <Card className="border-slate-800 bg-slate-950">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-violet-300">
                    <Plus className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Start your first scene</h3>
                  <p className="mt-2 max-w-xl text-slate-400">
                    Create a scene first, then add assets, narration, and subtitles. Changes are saved automatically as you edit.
                  </p>
                  <div className="mt-6">
                    <Button
                      onClick={() => { void handleAddScene(); }}
                      loading={syncingScenes}
                      disabled={syncingScenes || deletingSceneId !== null || savingSceneId !== null}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Scene
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {scenes.map((scene, sceneIndex) => {
              const { primaryDur, narrationDur, displayDuration } = getSceneDurations(scene);
              const warningVisible = !!scene.narration && primaryDur - narrationDur > 0.01;
              const cutoffPercentage = scene.narration
                ? Math.min(100, Math.max(0, (narrationDur / displayDuration) * 100))
                : 0;
              const subtitleWidthPct = Math.min(100, Math.max(0, ((scene.narration ? narrationDur : primaryDur) / displayDuration) * 100));

              return (
              <div key={scene.id} className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative">
                {warningVisible && (
                  <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center gap-2 text-amber-200 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Primary assets exceed narration length. Video cuts off at {formatDuration(narrationDur)}. Resize assets to fit.
                  </div>
                )}
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-800">
                  <h3 className="text-lg font-medium text-white">Scene {sceneIndex + 1}</h3>
                  <div className="flex items-center gap-4">
                    {savingSceneId === scene.id && (
                      <span className="inline-flex items-center gap-2 text-sm text-violet-200">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    )}
                    <span className="text-sm font-medium text-slate-400">Length: {formatDuration(scene.narration ? narrationDur : primaryDur)}</span>
                    <button
                      onClick={() => { void handleDeleteScene(scene.id); }}
                      disabled={deletingSceneId === scene.id || savingSceneId === scene.id}
                      className="p-1 text-red-400 transition-colors hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingSceneId === scene.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="p-6 overflow-x-auto">
                  <div className="min-w-[800px] relative timeline-track-container">
                    {renderTimelineHeader(displayDuration)}

                    {scene.narration && (
                      <div className="absolute top-0 bottom-0 left-40 right-0 z-40 pointer-events-none">
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500 flex flex-col items-center"
                          style={{ left: `${cutoffPercentage}%` }}
                        >
                          <div className="bg-red-500 text-white text-[10px] px-1 rounded-b whitespace-nowrap">Cutoff</div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-[2px] mt-2 select-none">
                      
                      {/* PRIMARY */}
                      <div className="flex items-center group/track">
                        <div className={`${timelineLabelWidthClass} flex-shrink-0 text-sm text-slate-400 px-2 flex items-center gap-2`}><VideoIcon className="h-4 w-4" /> Primary</div>
                        <div className={`timeline-track-surface relative flex-1 bg-slate-900/50 rounded-r-md border-y border-r border-slate-800/80 ${sceneRowHeight} flex`}>
                          {scene.primaryAssets.map((asset, index) =>
                            renderTimelineAsset(asset, 'primary', () => handleRemoveAsset(scene.id, 'primary', asset.id), scene.id, displayDuration, index, undefined, scene.primaryAssets.length)
                          )}
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/track:opacity-100 transition-opacity">
                            <Button size="sm" variant="secondary" className="h-8 shadow-lg border-slate-700" onClick={() => openAssetPicker({ sceneId: scene.id, rowType: 'primary' }, ['image', 'video'])}><Plus className="h-4 w-4" /></Button>
                          </div>
                          {scene.primaryAssets.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm pointer-events-none">Add assets to fill timeline.</div>}
                        </div>
                      </div>

                      {/* SECONDARY */}
                      {scene.secondaryAssets.map((row, rowIndex) => (
                        <div key={`sec-row-${rowIndex}`} className="flex items-center group/track">
                          <div className={`${timelineLabelWidthClass} flex-shrink-0 text-sm text-slate-400 px-2 flex items-center gap-2`}><ImageIcon className="h-4 w-4" /> Overlay {rowIndex + 1}</div>
                          <div className={`timeline-track-surface relative flex-1 bg-slate-900/50 rounded-r-md border-y border-r border-slate-800/80 ${sceneRowHeight}`}>
                            {row.map((asset, index) => renderTimelineAsset(asset, 'secondary', () => handleRemoveAsset(scene.id, 'secondary', asset.id, rowIndex), scene.id, displayDuration, index, rowIndex, row.length))}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/track:opacity-100 transition-opacity pointer-events-none">
                                <Button size="sm" variant="secondary" className="h-8 shadow-lg border-slate-700 pointer-events-auto" onClick={() => openAssetPicker({ sceneId: scene.id, rowType: 'secondary', secondaryOverlapIndex: rowIndex }, ['image', 'video'])}><Plus className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center pt-2 pb-2 border-b border-slate-800/50">
                        <div className={`${timelineLabelWidthClass} flex-shrink-0`}></div>
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800" onClick={() => openAssetPicker({ sceneId: scene.id, rowType: 'secondary', secondaryOverlapIndex: scene.secondaryAssets.length }, ['image', 'video'])}>
                            <Plus className="h-4 w-4 mr-2" /> Add Overlap Track
                        </Button>
                      </div>

                      {/* SUBTITLES */}
                      <div className="flex items-center group/track mt-2">
                        <div className={`${timelineLabelWidthClass} flex-shrink-0 text-sm text-slate-400 px-2 flex items-center gap-2`}><Type className="h-4 w-4" /> Subtitles</div>
                        <div className={`timeline-track-surface relative flex-1 bg-slate-900/50 rounded-r-md border-y border-r border-slate-800/80 h-16`}>
                          {scene.subtitle ? (
                            <div className="absolute top-1 bottom-1 bg-blue-900/30 border border-blue-500/40 rounded-md flex items-center px-3 group overflow-hidden" style={{ left: '0%', width: `${subtitleWidthPct || 100}%`}}>
                              <div className="flex items-center gap-3 truncate pr-16">
                                <span className="text-blue-300 font-bold text-sm">{scene.subtitle.presetName}</span>
                                
                                <span className="flex items-center gap-1 bg-blue-950/80 border border-blue-500/20 px-1.5 py-0.5 rounded text-xs text-blue-200"><Type className="w-3 h-3"/> {scene.subtitle.font.split(',')[0]}</span>
                                
                                <span className="flex items-center gap-1.5 bg-blue-950/80 border border-blue-500/20 px-2 py-1 rounded text-xs text-blue-200">
                                   <div className="w-3 h-3 rounded-full border border-white/20 shadow-[0_0_2px_rgba(0,0,0,0.5)]" style={{ backgroundColor: scene.subtitle.color }} title={scene.subtitle.color} />
                                   <span className="capitalize">Color</span>
                                </span>
                                
                                <span className="flex items-center gap-1 bg-blue-950/80 border border-blue-500/20 px-1.5 py-0.5 rounded text-xs text-blue-200"><AlignHorizontalJustifyCenter className="w-3 h-3"/> {formatPositionString(scene.subtitle.position)}</span>
                              </div>
                              <div className="absolute right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 p-1 rounded border border-slate-700">
                                <button onClick={() => setSubtitleModalTarget(scene.id)} className="p-1 hover:text-white text-slate-300" title="Edit Subtitles"><Settings className="w-3.5 h-3.5"/></button>
                                <button onClick={() => handleRemoveAsset(scene.id, 'subtitle')} className="p-1 hover:text-red-400 text-slate-300" title="Remove Subtitles"><Trash2 className="w-3.5 h-3.5"/></button>
                              </div>
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/track:opacity-100 transition-opacity">
                                <Button size="sm" variant="secondary" onClick={() => setSubtitleModalTarget(scene.id)}><Plus className="h-4 w-4 mr-2" /> Add Subtitles</Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* NARRATION */}
                      <div className="flex items-center group/track pt-1">
                        <div className={`${timelineLabelWidthClass} flex-shrink-0 text-sm text-slate-400 px-2 flex items-center gap-2`}><Mic className="h-4 w-4" /> Narration</div>
                        <div className={`timeline-track-surface relative flex-1 bg-slate-900/50 rounded-r-md border-y border-r border-slate-800/80 h-20`}>
                          {scene.narration ? renderTimelineAsset(scene.narration, 'narration', () => handleRemoveAsset(scene.id, 'narration', scene.narration!.id), scene.id, displayDuration) : (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/track:opacity-100 transition-opacity">
                                <Button size="sm" variant="secondary" onClick={() => openAssetPicker({ sceneId: scene.id, rowType: 'narration' }, ['audio'])}><Plus className="h-4 w-4 mr-2" /> Add Narration</Button>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            )})}

            {scenes.length > 0 && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => { void handleAddScene(); }}
                  loading={syncingScenes}
                  disabled={syncingScenes || deletingSceneId !== null || savingSceneId !== null}
                  className="border-dashed border-2 border-slate-600 bg-slate-900 text-slate-300 hover:border-violet-500 hover:text-white"
                >
                    <Plus className="w-6 h-6 mr-2" /> Add New Scene
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* --- STEP 2: BACKGROUND MUSIC --- */}
      {!isInitialPageLoading && currentStep === 2 && (
        <div className="flex flex-col max-w-5xl mx-auto min-h-[50vh]">
          <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <Link href="/dashboard/custom_video">
                  <Button variant="outline">Back</Button>
                </Link>
                <h1 className="text-3xl font-bold text-white">Background Music</h1>
              </div>
              <p className="text-slate-400">Add a background track that plays across all your scenes.</p>
            </div>
            <div className="flex gap-3">
               <Button variant="outline" onClick={() => setCurrentStep(1)}>Back to Editor</Button>
               <Button
                 onClick={() => { void handleOpenFinalizeReview(); }}
                 disabled={finalizingVideo || syncingScenes || isRenderInProgress}
               >
                 Next Step <ChevronRight className="w-4 h-4 ml-2" />
               </Button>
            </div>
          </div>

          <Card className="border-slate-700 bg-slate-900 shadow-xl overflow-hidden mt-8">
             <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                   <Music className="w-5 h-5 text-violet-400" />
                   <h3 className="text-lg font-semibold text-white">Global Background Music</h3>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => { void loadBackgroundTracks('refresh'); }}
                    loading={refreshingBackgroundTracks}
                    disabled={loadingBackgroundTracks || refreshingBackgroundTracks}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                  <span className="bg-slate-800 px-3 py-1 rounded-full text-sm font-medium text-slate-300 border border-slate-700">
                    Total Video Length: {formatDuration(getTotalVideoExportDuration())}
                  </span>
                </div>
             </div>
             <CardContent className="p-6">
                <div className="space-y-3">
                  <Card
                    hover
                    onClick={() => setSelectedBackgroundTrack(null)}
                    className={`cursor-pointer overflow-hidden border transition-all ${
                      selectedBackgroundTrack === null
                        ? 'border-violet-500/50 bg-violet-500/10'
                        : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                    }`}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-slate-300">
                        <Music className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-white">No background music</p>
                        <p className="mt-1 text-sm text-slate-400">Keep the video clean without a global track.</p>
                      </div>
                      {selectedBackgroundTrack === null && (
                        <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-200">
                          Selected
                        </span>
                      )}
                    </CardContent>
                  </Card>

                  {loadingBackgroundTracks ? (
                    <div className="flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/60 py-16 text-slate-400">
                      <Loader2 className="mr-3 h-5 w-5 animate-spin text-violet-400" />
                      Loading music library...
                    </div>
                  ) : backgroundTracks.length === 0 ? (
                    <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 py-12 text-center text-slate-400">
                      No music tracks found in the music library.
                    </div>
                  ) : (
                    backgroundTracks.map((track) => {
                      const isPlaying = playingBackgroundTrackId === track.id;
                      const isSelected = selectedBackgroundTrack?.id === track.id;

                      return (
                        <Card
                          key={track.id}
                          hover
                          onClick={() => setSelectedBackgroundTrack(track)}
                          className={`cursor-pointer overflow-hidden border transition-all ${
                            isSelected
                              ? 'border-violet-500/50 bg-violet-500/10'
                              : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                          }`}
                        >
                          <CardContent className="p-0">
                            <div className={`flex flex-col gap-4 bg-gradient-to-r ${getTrackVisual(track)} p-4 sm:flex-row sm:items-center`}>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void toggleBackgroundTrackPlay(track);
                                }}
                                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-slate-950/60 text-white transition-colors hover:bg-slate-950"
                                aria-label={`${isPlaying ? 'Pause' : 'Play'} ${track.title}`}
                              >
                                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6" />}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="truncate text-lg font-semibold text-white">{track.title}</h4>
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getTrackTypeBadge(track)}`}>
                                    {formatTrackType(track.track_type)}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/40 px-2.5 py-1 text-[11px] font-medium text-white/85">
                                    <Timer className="h-3.5 w-3.5" />
                                    {formatMusicDuration(track.duration_ms)}
                                  </span>
                                  {track.mood && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/40 px-2.5 py-1 text-[11px] font-medium capitalize text-white/85">
                                      <Tag className="h-3.5 w-3.5" />
                                      {track.mood}
                                    </span>
                                  )}
                                  {track.genre && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/40 px-2.5 py-1 text-[11px] font-medium capitalize text-white/85">
                                      <Headphones className="h-3.5 w-3.5" />
                                      {track.genre}
                                    </span>
                                  )}
                                </div>

                                <div className="mt-3 flex items-end gap-1.5">
                                  {waveformHeights.map((height, index) => (
                                    <span
                                      key={`${track.id}-wave-${index}`}
                                      className={`w-1.5 rounded-full bg-white/70 ${height} ${isPlaying ? 'animate-pulse' : ''}`}
                                      style={{ animationDelay: `${index * 120}ms` }}
                                    />
                                  ))}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                                <Button
                                  variant={isPlaying ? 'primary' : 'secondary'}
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void toggleBackgroundTrackPlay(track);
                                  }}
                                >
                                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                  {isPlaying ? 'Pause' : 'Play'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={isSelected ? 'primary' : 'outline'}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedBackgroundTrack(track);
                                  }}
                                >
                                  {isSelected ? 'Selected' : 'Select'}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
             </CardContent>
          </Card>
        </div>
      )}

      {/* --- STEP 3: FINALIZE --- */}
      {!isInitialPageLoading && currentStep === 3 && (
        <div className="flex flex-col max-w-5xl mx-auto min-h-[50vh]">
          <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <h1 className="text-3xl font-bold text-white">Finalize</h1>
              </div>
              <p className="text-slate-400">Review the latest draft data before starting video generation.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(2)} disabled={finalizingVideo}>
                Back to Music
              </Button>
              <Button
                onClick={() => { void handleCreateVideo(); }}
                loading={finalizingVideo}
                disabled={finalizingVideo || syncingScenes || isRenderInProgress}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-none shadow-lg shadow-violet-500/25"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {isEditMode ? 'Generate Updated Video' : 'Start Video Generation'}
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden border-slate-700 bg-slate-900 shadow-xl">
            <CardContent className="p-6">
              {loadingReviewDraft ? (
                <div className="flex min-h-[320px] items-center justify-center text-slate-400">
                  <Loader2 className="mr-3 h-5 w-5 animate-spin text-violet-400" />
                  Loading latest video details...
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.22em] text-violet-300">Draft Review</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {reviewDraft?.title || 'Custom Video Draft'}
                    </h2>
                    
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Video ID</p>
                      <p className="mt-3 font-medium text-white">{reviewDraft?.id || customVideoId}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Aspect Ratio</p>
                      <p className="mt-3 font-medium capitalize text-white">{reviewDraft?.video_type || 'Unknown'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Scenes</p>
                      <p className="mt-3 font-medium text-white">{reviewDraft?.scenes?.length || 0}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Total Length</p>
                      <p className="mt-3 font-medium text-white">{formatDuration(getTotalVideoExportDuration())}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-slate-400">Background music</p>
                        <p className="mt-1 font-medium text-white">
                          {selectedBackgroundTrack ? selectedBackgroundTrack.title : 'No background music selected'}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-300">
                        Status: <span className="capitalize">{reviewDraft?.status || customVideoStatus}</span>
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/70">
                    <div className="border-b border-slate-800 px-5 py-4">
                      <h3 className="text-lg font-semibold text-white">Scenes Overview</h3>
                    </div>
                    <div className="space-y-3 p-5">
                      {(reviewDraft?.scenes || []).length === 0 ? (
                        <p className="text-sm text-slate-400">No scenes found in the draft yet.</p>
                      ) : (
                        (reviewDraft?.scenes || []).map((scene, index) => (
                          <div key={scene.id || `${scene.order}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-white">{scene.title || `Scene ${index + 1}`}</p>
                                <p className="mt-1 text-sm text-slate-400">
                                  {scene.primary_assets?.length || 0} primary assets, {scene.secondary_assets?.length || 0} overlap assets
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-300">
                                  Duration: {formatDuration(Math.max(1, Math.round((scene.duration_ms || 0) / 1000)))}
                                </span>
                                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-300">
                                  Narration: {scene.audio_asset_id ? 'Yes' : 'No'}
                                </span>
                                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-300">
                                  Subtitles: {scene.subtitle_config ? 'Yes' : 'No'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {renderErrorMessage && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {renderErrorMessage}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- STEP 4: VIDEO GENERATION --- */}
      {!isInitialPageLoading && currentStep === 4 && (
        <div className="flex flex-col max-w-5xl mx-auto min-h-[50vh]">
          <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <h1 className="text-3xl font-bold text-white">Video Generation</h1>
              </div>
              <p className="text-slate-400">Your video is generating. This step is locked until the render finishes or fails.</p>
            </div>
          </div>

          <Card className="overflow-hidden border-slate-700 bg-slate-900 shadow-xl">
            <CardContent className="p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.22em] text-violet-300">
                    {customVideoStatus === 'completed'
                      ? 'Render Complete'
                      : customVideoStatus === 'failed'
                        ? 'Render Failed'
                        : 'Rendering In Progress'}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {customVideoStatus === 'finalizing'
                      ? 'Finalizing your custom video'
                      : customVideoStatus === 'rendering'
                        ? 'Rendering your custom video'
                        : customVideoStatus === 'completed'
                          ? 'Your custom video is ready'
                          : 'There was a problem finishing your video'}
                  </h2>
                  <p className="mt-2 max-w-2xl text-slate-400">
                    {customVideoStatus === 'completed'
                      ? 'Your render finished successfully. You can open the result or return to your custom videos list.'
                      : customVideoStatus === 'failed'
                        ? (renderErrorMessage || 'The render stopped before completion. You can try again or return to your custom videos list.')
                        : 'We are polling the latest render progress automatically every few seconds.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href="/dashboard/custom_video">
                    <Button variant="outline">Go to All Videos</Button>
                  </Link>
                  {customVideoStatus === 'completed' && (
                    <Link href={`/dashboard/custom_video/${customVideoId}/edit`}>
                      <Button variant="secondary">Edit Video</Button>
                    </Link>
                  )}
                  {customVideoStatus === 'completed' && renderOutputUrl && (
                    <Button onClick={() => setShowFinalVideoModal(true)}>Open Final Video</Button>
                  )}
                </div>
              </div>

              {customVideoStatus !== 'failed' && (
                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-300">
                      Status: <span className="font-medium capitalize text-white">{customVideoStatus}</span>
                    </span>
                    <span className="font-medium text-violet-300">{renderProgress}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, renderProgress))}%` }}
                    />
                  </div>
                </div>
              )}

              {customVideoStatus === 'failed' && (
                <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {renderErrorMessage || 'Rendering failed. Please try again.'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

    </DashboardLayout>
  );
}
