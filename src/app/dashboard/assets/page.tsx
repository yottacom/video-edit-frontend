'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Sparkles,
  Image as ImageIcon,
  Video as VideoIcon,
  X,
  Trash2,
  Download,
  Loader2,
  FileText,
  PlayCircle,
  Clock,
  Video,
  AudioLines,
  RefreshCw,
  Search,
  Check,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { assetsApi, getApiErrorMessage } from '@/lib/api';
import { AssetGenerationJobResponse, AssetItem, AssetStatus, AssetType, ElevenLabsVoice } from '@/types';

// --- Asset Data Types ---
interface BaseAsset {
  id: string;
  title: string;
  type: AssetType;
  source: 'uploaded' | 'ai_generated';
  status: AssetStatus;
  url: string | null;
  thumbnailUrl: string | null;
  created_at: string;
}

interface ImageAsset extends BaseAsset {
  type: 'image';
}

interface VideoAsset extends BaseAsset {
  type: 'video';
}

interface AudioAsset extends BaseAsset {
  type: 'audio';
}

type Asset = ImageAsset | VideoAsset | AudioAsset;
type AssetTypeFilter = AssetType | 'all';
type AssetSourceFilter = 'all' | 'generated' | 'uploaded';

// --- Helper Functions ---
function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function mapAsset(item: AssetItem): Asset {
  return {
    id: item.id,
    title: item.title,
    type: item.asset_type,
    source: item.source_type === 'generated' ? 'ai_generated' : 'uploaded',
    status: item.status,
    url: item.url,
    thumbnailUrl: item.thumbnail_url,
    created_at: item.created_at || new Date().toISOString(),
  } as Asset;
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

function buildGeneratedAssetTitle(prompt: string, assetType: AssetType) {
  const trimmedPrompt = prompt.trim().replace(/\s+/g, ' ');

  if (!trimmedPrompt) {
    return assetType === 'image'
      ? 'Generated Image'
      : assetType === 'video'
        ? 'Generated Video'
        : 'Generated Audio';
  }

  return trimmedPrompt.length > 60
    ? `${trimmedPrompt.slice(0, 57).trimEnd()}...`
    : trimmedPrompt;
}

function getAssetTypeLabel(type: Asset['type']) {
  switch (type) {
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    default:
      return type;
  }
}

function getAssetIcon(type: Asset['type']) {
  switch (type) {
    case 'image':
      return <ImageIcon className="h-10 w-10 text-slate-500" />;
    case 'video':
      return <VideoIcon className="h-10 w-10 text-slate-500" />;
    case 'audio':
      return <AudioLines className="h-10 w-10 text-slate-500" />;
    default:
      return <FileText className="h-10 w-10 text-slate-500" />;
  }
}

function getStatusBadgeClass(status: AssetStatus) {
  switch (status) {
    case 'ready':
      return 'border-emerald-400/20 bg-emerald-500/15 text-emerald-200';
    case 'processing':
      return 'border-amber-400/20 bg-amber-500/15 text-amber-200';
    case 'failed':
      return 'border-red-400/20 bg-red-500/15 text-red-200';
    default:
      return 'border-slate-500/20 bg-slate-700/50 text-slate-200';
  }
}

function getVoiceMeta(voice: ElevenLabsVoice) {
  return [voice.gender, voice.age, voice.accent || voice.language || voice.locale].filter(Boolean).join(' • ');
}

interface VoicePickerModalProps {
  open: boolean;
  onClose: () => void;
  voices: ElevenLabsVoice[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  searchValue: string;
  selectedVoiceId: string | null;
  onSearchChange: (value: string) => void;
  onSelect: (voice: ElevenLabsVoice) => void;
  onScrollEnd: () => void;
}

function VoicePickerModal({
  open,
  onClose,
  voices,
  loading,
  loadingMore,
  hasMore,
  searchValue,
  selectedVoiceId,
  onSearchChange,
  onSelect,
  onScrollEnd,
}: VoicePickerModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden border-slate-700/70 bg-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-slate-700/50 p-6">
          <h2 className="text-2xl font-semibold text-white">Select ElevenLabs Voice</h2>
          <p className="mt-2 text-sm text-slate-400">
            Search and browse voices, then choose one for AI audio generation.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="Close voice picker"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search voices by name, accent, or description"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              className="pl-10"
            />
          </div>

          <div
            className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
            onScroll={(event) => {
              const target = event.currentTarget;
              const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
              if (distanceFromBottom < 120 && hasMore && !loading && !loadingMore) {
                onScrollEnd();
              }
            }}
          >
            {loading ? (
              <div className="flex min-h-60 items-center justify-center text-slate-400">
                <Loader2 className="mr-3 h-5 w-5 animate-spin text-violet-400" />
                Loading voices...
              </div>
            ) : voices.length === 0 ? (
              <div className="flex min-h-60 items-center justify-center text-center text-slate-400">
                No voices found for this search.
              </div>
            ) : (
              voices.map((voice) => (
                <button
                  key={voice.voice_id}
                  type="button"
                  onClick={() => onSelect(voice)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    selectedVoiceId === voice.voice_id
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-white">{voice.name}</h3>
                        {voice.category && (
                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">
                            {voice.category}
                          </span>
                        )}
                      </div>
                      {voice.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-slate-400">{voice.description}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                        {getVoiceMeta(voice) && (
                          <span className="rounded-full bg-slate-900 px-2.5 py-1">{getVoiceMeta(voice)}</span>
                        )}
                        {voice.locale && (
                          <span className="rounded-full bg-slate-900 px-2.5 py-1">{voice.locale}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {selectedVoiceId === voice.voice_id && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-1 text-xs font-medium text-violet-200">
                          <Check className="h-3.5 w-3.5" />
                          Selected
                        </span>
                      )}
                      <ChevronRight className="h-5 w-5 text-slate-500" />
                    </div>
                  </div>

                  {voice.preview_url && (
                    <div className="mt-4" onClick={(event) => event.stopPropagation()}>
                      <audio src={voice.preview_url} controls className="w-full" />
                    </div>
                  )}
                </button>
              ))
            )}

            {loadingMore && (
              <div className="flex items-center justify-center py-4 text-sm text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-violet-400" />
                Loading more voices...
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState<AssetTypeFilter>('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<AssetSourceFilter>('all');
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [refreshingAssets, setRefreshingAssets] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Create Modal State
  const [showAICreateModal, setShowAICreateModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiMotionPrompt, setAiMotionPrompt] = useState('');
  const [aiContentType, setAiContentType] = useState<AssetType>('image');
  const [aiAspectRatio, setAiAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('1:1');
  const [aiDurationSeconds, setAiDurationSeconds] = useState('5');
  const [aiRemoveBackground, setAiRemoveBackground] = useState(false);
  const [videoGenerationMode, setVideoGenerationMode] = useState<'prompt' | 'base-image'>('prompt');
  const [selectedBaseImage, setSelectedBaseImage] = useState<Asset | null>(null);
  const [selectedReferenceImages, setSelectedReferenceImages] = useState<Asset[]>([]);
  const [showReferencePickerModal, setShowReferencePickerModal] = useState(false);
  const [showBaseImagePickerModal, setShowBaseImagePickerModal] = useState(false);
  const [referenceAssets, setReferenceAssets] = useState<Asset[]>([]);
  const [referenceSearchInput, setReferenceSearchInput] = useState('');
  const [debouncedReferenceSearch, setDebouncedReferenceSearch] = useState('');
  const [referencePage, setReferencePage] = useState(1);
  const [referenceHasMore, setReferenceHasMore] = useState(false);
  const [loadingReferenceAssets, setLoadingReferenceAssets] = useState(false);
  const [loadingMoreReferenceAssets, setLoadingMoreReferenceAssets] = useState(false);
  const [uploadingReferenceImages, setUploadingReferenceImages] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<ElevenLabsVoice | null>(null);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [pollingGeneration, setPollingGeneration] = useState(false);
  const [generationJob, setGenerationJob] = useState<AssetGenerationJobResponse | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showVoicePickerModal, setShowVoicePickerModal] = useState(false);
  const [voiceSearchInput, setVoiceSearchInput] = useState('');
  const [debouncedVoiceSearch, setDebouncedVoiceSearch] = useState('');
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [loadingMoreVoices, setLoadingMoreVoices] = useState(false);
  const [voicesNextPageToken, setVoicesNextPageToken] = useState<string | null>(null);
  const [voicesHasMore, setVoicesHasMore] = useState(false);

  // Video Player Modal State
  const [showVideoPlayerModal, setShowVideoPlayerModal] = useState<VideoAsset | null>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const [showImageModal, setShowImageModal] = useState<ImageAsset | null>(null);
  const [showAudioPlayerModal, setShowAudioPlayerModal] = useState<AudioAsset | null>(null);
  const referenceUploadInputRef = useRef<HTMLInputElement>(null);
  const isGenerationBusy = generatingAI || pollingGeneration;
  const hasPendingReferenceImages = selectedReferenceImages.some((asset) => asset.status !== 'ready');
  const hasPendingBaseImage = !!selectedBaseImage && selectedBaseImage.status !== 'ready';
  const isVideoUsingBaseImage = aiContentType === 'video' && videoGenerationMode === 'base-image';
  const canSubmitAICreate =
    !isGenerationBusy &&
    !uploadingReferenceImages &&
    !hasPendingReferenceImages &&
    !hasPendingBaseImage &&
    (
      aiContentType === 'image'
        ? aiPrompt.trim().length > 0
        : aiContentType === 'video'
          ? (
              isVideoUsingBaseImage
                ? !!selectedBaseImage && aiMotionPrompt.trim().length > 0
                : aiPrompt.trim().length > 0 && aiMotionPrompt.trim().length > 0
            )
          : aiPrompt.trim().length > 0
    );
  const pageSize = 20;
  const referencePageSize = 12;
  const totalPages = Math.max(1, Math.ceil(totalAssets / pageSize));
  const hasActiveFilters =
    debouncedSearch.length > 0 || assetTypeFilter !== 'all' || sourceTypeFilter !== 'all';

  // --- Effects ---
  const loadAssets = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setLoadingAssets(true);
    } else {
      setRefreshingAssets(true);
    }

    try {
      const data = await assetsApi.list({
        page,
        page_size: pageSize,
        asset_type: assetTypeFilter === 'all' ? undefined : assetTypeFilter,
        source_type: sourceTypeFilter === 'all' ? undefined : sourceTypeFilter,
        search: debouncedSearch || undefined,
      });
      setAssets(data.items.map(mapAsset));
      setTotalAssets(data.total);
    } catch (error) {
      console.error('Failed to load assets:', error);
      alert(getApiErrorMessage(error, 'Failed to load assets.'));
    } finally {
      setLoadingAssets(false);
      setRefreshingAssets(false);
    }
  }, [assetTypeFilter, debouncedSearch, page, sourceTypeFilter]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, assetTypeFilter, sourceTypeFilter]);

  useEffect(() => {
    if (assets.length === 0) {
      return;
    }

    setSelectedReferenceImages((currentAssets) =>
      currentAssets.map((asset) => assets.find((currentAsset) => currentAsset.id === asset.id) || asset)
    );
    setSelectedBaseImage((currentAsset) =>
      currentAsset ? assets.find((asset) => asset.id === currentAsset.id) || currentAsset : null
    );
    setReferenceAssets((currentAssets) =>
      currentAssets.map((asset) => assets.find((currentAsset) => currentAsset.id === asset.id) || asset)
    );
  }, [assets]);

  useEffect(() => {
    // Cleanup for file preview URL
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  useEffect(() => {
    // Handle body overflow for modals
    const previousOverflow = document.body.style.overflow;
    if (showUploadModal || showAICreateModal || showReferencePickerModal || showBaseImagePickerModal || showVideoPlayerModal || showImageModal || showAudioPlayerModal || showVoicePickerModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = previousOverflow;
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showUploadModal, showAICreateModal, showReferencePickerModal, showBaseImagePickerModal, showVideoPlayerModal, showImageModal, showAudioPlayerModal, showVoicePickerModal]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedVoiceSearch(voiceSearchInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [voiceSearchInput]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedReferenceSearch(referenceSearchInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [referenceSearchInput]);

  useEffect(() => {
    setReferencePage(1);
  }, [debouncedReferenceSearch]);

  useEffect(() => {
    if (aiContentType !== 'image') {
      setAiRemoveBackground(false);
      if (aiContentType !== 'video' || videoGenerationMode === 'base-image') {
        setSelectedReferenceImages([]);
      }
    }

    if (aiContentType !== 'image' && aiContentType !== 'video') {
      setShowReferencePickerModal(false);
    }

    if (aiContentType !== 'video') {
      setAiMotionPrompt('');
      setSelectedBaseImage(null);
      setShowBaseImagePickerModal(false);
      setVideoGenerationMode('prompt');
    }
  }, [aiContentType, videoGenerationMode]);

  useEffect(() => {
    if (aiContentType !== 'video') {
      return;
    }

    if (videoGenerationMode === 'base-image') {
      setSelectedReferenceImages([]);
      setShowReferencePickerModal(false);
      setAiPrompt('');
      return;
    }

    setSelectedBaseImage(null);
    setShowBaseImagePickerModal(false);
  }, [aiContentType, videoGenerationMode]);

  const loadVoices = useCallback(async (
    mode: 'reset' | 'append' = 'reset',
    nextPageToken?: string | null
  ) => {
    if (mode === 'reset') {
      setLoadingVoices(true);
    } else {
      setLoadingMoreVoices(true);
    }

    try {
      const response = await assetsApi.listElevenLabsVoices({
        page_size: 20,
        next_page_token: mode === 'append' ? nextPageToken || undefined : undefined,
        search: debouncedVoiceSearch || undefined,
      });

      setVoices((currentVoices) =>
        mode === 'append' ? [...currentVoices, ...response.items] : response.items
      );
      setVoicesNextPageToken(response.next_page_token || null);
      setVoicesHasMore(response.has_more);
    } catch (error) {
      console.error('Failed to load ElevenLabs voices:', error);
      alert(getApiErrorMessage(error, 'Failed to load ElevenLabs voices.'));
    } finally {
      setLoadingVoices(false);
      setLoadingMoreVoices(false);
    }
  }, [debouncedVoiceSearch]);

  useEffect(() => {
    if (!showVoicePickerModal) {
      return;
    }

    void loadVoices('reset');
  }, [showVoicePickerModal, debouncedVoiceSearch, loadVoices]);

  const resetAiGenerationState = useCallback(() => {
    setGeneratingAI(false);
    setPollingGeneration(false);
    setGenerationJob(null);
    setGenerationError(null);
  }, []);

  const resetAiFormState = useCallback(() => {
    setAiPrompt('');
    setAiMotionPrompt('');
    setAiContentType('image');
    setAiAspectRatio('1:1');
    setAiDurationSeconds('5');
    setAiRemoveBackground(false);
    setVideoGenerationMode('prompt');
    setSelectedBaseImage(null);
    setSelectedReferenceImages([]);
    setReferenceSearchInput('');
    setDebouncedReferenceSearch('');
    setReferencePage(1);
    setReferenceAssets([]);
    setReferenceHasMore(false);
    setShowReferencePickerModal(false);
    setShowBaseImagePickerModal(false);
    setSelectedVoice(null);
    setVoiceSearchInput('');
    setDebouncedVoiceSearch('');
    setShowVoicePickerModal(false);
  }, []);

  const loadReferenceAssets = useCallback(async (mode: 'replace' | 'append' = 'replace') => {
    if (!showReferencePickerModal && !showBaseImagePickerModal) {
      return;
    }

    if (mode === 'append') {
      setLoadingMoreReferenceAssets(true);
    } else {
      setLoadingReferenceAssets(true);
    }

    try {
      const response = await assetsApi.list({
        page: referencePage,
        page_size: referencePageSize,
        asset_type: 'image',
        search: debouncedReferenceSearch || undefined,
      });

      const nextReferenceAssets = response.items
        .filter((item) => item.asset_type === 'image' && item.status === 'ready')
        .map(mapAsset);

      setReferenceAssets((currentAssets) =>
        mode === 'append' ? mergeAssetsById(currentAssets, nextReferenceAssets) : nextReferenceAssets
      );
      setReferenceHasMore(referencePage * referencePageSize < response.total);
    } catch (error) {
      console.error('Failed to load reference image assets:', error);
      alert(getApiErrorMessage(error, 'Failed to load reference image assets.'));
    } finally {
      setLoadingReferenceAssets(false);
      setLoadingMoreReferenceAssets(false);
    }
  }, [debouncedReferenceSearch, referencePage, referencePageSize, showBaseImagePickerModal, showReferencePickerModal]);

  useEffect(() => {
    if (!showReferencePickerModal && !showBaseImagePickerModal) {
      return;
    }

    void loadReferenceAssets(referencePage === 1 ? 'replace' : 'append');
  }, [loadReferenceAssets, referencePage, showBaseImagePickerModal, showReferencePickerModal]);

  useEffect(() => {
    if (!generationJob?.job_id || !pollingGeneration) {
      return;
    }

    let cancelled = false;

    const pollJob = async () => {
      try {
        const result = await assetsApi.pollGenerationJob(generationJob.job_id!, generationJob.poll_url || undefined);

        if (cancelled) {
          return;
        }

        setGenerationJob(result);

        if (result.asset) {
          if (page === 1) {
            void loadAssets('refresh');
          } else {
            setPage(1);
          }
          setShowAICreateModal(false);
          resetAiFormState();
          resetAiGenerationState();
          return;
        }

        if (result.status === 'failed') {
          setPollingGeneration(false);
          setGenerationError(result.error || 'AI generation failed.');
          return;
        }

        window.setTimeout(() => {
          if (!cancelled) {
            void pollJob();
          }
        }, 1500);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to poll generation job:', error);
          setPollingGeneration(false);
          setGenerationError(getApiErrorMessage(error, 'Failed to poll asset generation progress.'));
        }
      }
    };

    void pollJob();

    return () => {
      cancelled = true;
    };
  }, [generationJob?.job_id, generationJob?.poll_url, loadAssets, page, pollingGeneration, resetAiFormState, resetAiGenerationState]);

  // --- Handlers ---
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Clear previous preview
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }

      // Basic validation
      if (
        !file.type.startsWith('image/') &&
        !file.type.startsWith('video/') &&
        !file.type.startsWith('audio/')
      ) {
        alert('Please select an image, video, or audio file.');
        setSelectedFile(null);
        setFilePreviewUrl(null);
        return;
      }

      setSelectedFile(file);
      setFilePreviewUrl(file.type.startsWith('audio/') ? null : URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
      setFilePreviewUrl(null);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const assetType: AssetType = selectedFile.type.startsWith('image/')
        ? 'image'
        : selectedFile.type.startsWith('video/')
          ? 'video'
          : 'audio';
      await assetsApi.upload(
        selectedFile,
        selectedFile.name.replace(/\.[^/.]+$/, ''),
        assetType
      );
      if (page === 1) {
        await loadAssets('refresh');
      } else {
        setPage(1);
      }
      setShowUploadModal(false);
      setSelectedFile(null);
      setFilePreviewUrl(null);
    } catch (error) {
      console.error('Upload failed:', error);
      alert(getApiErrorMessage(error, 'Upload failed. Please try again.'));
    } finally {
      setUploading(false);
    }
  };

  const handleAICreateSubmit = async () => {
    if (!canSubmitAICreate) return;
    if (uploadingReferenceImages) return;
    if (hasPendingReferenceImages) {
      setGenerationError('Please wait for reference images to finish uploading before generating.');
      return;
    }
    if (hasPendingBaseImage) {
      setGenerationError('Please wait for the selected base image to finish processing before generating.');
      return;
    }

    setGenerationError(null);
    setGeneratingAI(true);
    try {
      const trimmedPrompt = aiPrompt.trim();
      const trimmedMotionPrompt = aiMotionPrompt.trim();
      const response = await assetsApi.generate(
        aiContentType === 'image'
          ? {
              asset_type: 'image',
              title: buildGeneratedAssetTitle(trimmedPrompt, 'image'),
              image_prompt: trimmedPrompt,
              aspect_ratio: aiAspectRatio,
              remove_background: aiRemoveBackground,
              reference_image_asset_ids: selectedReferenceImages.map((asset) => asset.id),
              extra_metadata: {},
            }
          : aiContentType === 'video'
            ? (
                isVideoUsingBaseImage
                  ? {
                      asset_type: 'video',
                      title: selectedBaseImage
                        ? `Animated ${selectedBaseImage.title}`
                        : buildGeneratedAssetTitle(trimmedMotionPrompt, 'video'),
                      base_image_asset_id: selectedBaseImage?.id,
                      motion_prompt: trimmedMotionPrompt,
                      aspect_ratio: aiAspectRatio,
                      duration_seconds: Number(aiDurationSeconds) || 5,
                      extra_metadata: {
                        workflow: 'base-image-animation',
                      },
                    }
                  : {
                      asset_type: 'video',
                      title: buildGeneratedAssetTitle(trimmedPrompt, 'video'),
                      image_prompt: trimmedPrompt,
                      prompt: trimmedPrompt,
                      reference_image_asset_ids: selectedReferenceImages.map((asset) => asset.id),
                      motion_prompt: trimmedMotionPrompt,
                      aspect_ratio: aiAspectRatio,
                      duration_seconds: Number(aiDurationSeconds) || 5,
                      extra_metadata: {},
                    }
              )
          : {
              asset_type: aiContentType,
              prompt: aiContentType === 'audio' ? undefined : trimmedPrompt,
              text: aiContentType === 'audio' ? trimmedPrompt : undefined,
              aspect_ratio: aiContentType === 'audio' ? undefined : aiAspectRatio,
              duration_seconds: Number(aiDurationSeconds) || 5,
              elevenlabs_voice_id: aiContentType === 'audio' && selectedVoice ? selectedVoice.voice_id : undefined,
            }
      );

      if (response.asset) {
        if (page === 1) {
          await loadAssets('refresh');
        } else {
          setPage(1);
        }
        setShowAICreateModal(false);
        resetAiFormState();
        setGenerationJob(null);
      } else {
        setGenerationJob(response);
        if (response.job_id) {
          setPollingGeneration(true);
        } else {
          setGenerationError('Generation started, but no polling information was returned.');
        }
      }
    } catch (error) {
      console.error('AI generation failed:', error);
      setGenerationError(getApiErrorMessage(error, 'AI generation failed. Please try again.'));
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleReferenceImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    const invalidFile = files.find((file) => !file.type.startsWith('image/'));

    if (invalidFile) {
      alert('Only image files can be used as reference images.');
      event.target.value = '';
      return;
    }

    setGenerationError(null);
    setUploadingReferenceImages(true);

    try {
      const uploadedAssets = await Promise.all(
        files.map((file) =>
          assetsApi.upload(file, file.name.replace(/\.[^/.]+$/, ''), 'image')
        )
      );

      const mappedUploadedAssets = uploadedAssets.map(mapAsset);
      const hasProcessingUpload = mappedUploadedAssets.some((asset) => asset.status !== 'ready');

      setSelectedReferenceImages((currentAssets) => mergeAssetsById(currentAssets, mappedUploadedAssets));
      setReferenceAssets((currentAssets) => mergeAssetsById(mappedUploadedAssets, currentAssets));

      if (hasProcessingUpload) {
        setGenerationError('Some uploaded reference images are still processing. They will become usable once ready.');
      }

      if (page === 1) {
        await loadAssets('refresh');
      } else {
        setPage(1);
      }
    } catch (error) {
      console.error('Failed to upload reference image assets:', error);
      setGenerationError(getApiErrorMessage(error, 'Failed to upload reference images.'));
    } finally {
      setUploadingReferenceImages(false);
      event.target.value = '';
    }
  };

  const toggleReferenceImageSelection = (asset: Asset) => {
    setSelectedReferenceImages((currentAssets) => {
      const alreadySelected = currentAssets.some((currentAsset) => currentAsset.id === asset.id);

      if (alreadySelected) {
        return currentAssets.filter((currentAsset) => currentAsset.id !== asset.id);
      }

      return [...currentAssets, asset];
    });
  };

  const handleSelectBaseImage = (asset: Asset) => {
    setSelectedBaseImage(asset);
    setShowBaseImagePickerModal(false);
  };

  const handleDeleteAsset = async () => {
    if (!assetToDelete) return;

    setDeletingAssetId(assetToDelete.id);
    try {
      await assetsApi.delete(assetToDelete.id);
      if (showVideoPlayerModal?.id === assetToDelete.id) {
        setShowVideoPlayerModal(null);
      }
      if (showImageModal?.id === assetToDelete.id) {
        setShowImageModal(null);
      }
      if (showAudioPlayerModal?.id === assetToDelete.id) {
        setShowAudioPlayerModal(null);
      }
      if (assets.length === 1 && page > 1) {
        setPage((currentPage) => currentPage - 1);
      } else {
        await loadAssets('refresh');
      }
      setAssetToDelete(null);
    } catch (error) {
      console.error('Failed to delete asset:', error);
      alert(getApiErrorMessage(error, 'Failed to delete asset.'));
    } finally {
      setDeletingAssetId(null);
    }
  };

  const handleCloseAICreateModal = () => {
    setShowAICreateModal(false);
    setShowReferencePickerModal(false);
    setShowBaseImagePickerModal(false);

    if (!isGenerationBusy) {
      resetAiFormState();
      resetAiGenerationState();
    }
  };

  return (
    <DashboardLayout>
      <ConfirmDialog
        open={!!assetToDelete}
        title="Delete asset?"
        description={
          assetToDelete
            ? `"${assetToDelete.title}" will be permanently removed from your assets.`
            : ''
        }
        confirmLabel="Delete Asset"
        loading={deletingAssetId === assetToDelete?.id}
        onClose={() => {
          if (!deletingAssetId) {
            setAssetToDelete(null);
          }
        }}
        onConfirm={() => {
          void handleDeleteAsset();
        }}
      />

      <VoicePickerModal
        open={showVoicePickerModal}
        onClose={() => setShowVoicePickerModal(false)}
        voices={voices}
        loading={loadingVoices}
        loadingMore={loadingMoreVoices}
        hasMore={voicesHasMore}
        searchValue={voiceSearchInput}
        selectedVoiceId={selectedVoice?.voice_id || null}
        onSearchChange={setVoiceSearchInput}
        onSelect={(voice) => {
          setSelectedVoice(voice);
          setShowVoicePickerModal(false);
        }}
        onScrollEnd={() => {
          if (voicesHasMore && voicesNextPageToken) {
            void loadVoices('append', voicesNextPageToken);
          }
        }}
      />

      {showReferencePickerModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setShowReferencePickerModal(false)}
        >
          <Card
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden border-slate-700/70 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-slate-700/50 p-6">
              <h2 className="text-2xl font-semibold text-white">Select Reference Images</h2>
              <p className="mt-2 text-sm text-slate-400">
                {aiContentType === 'video'
                  ? 'Choose existing image assets to guide the generated base image for this video.'
                  : 'Choose existing image assets to guide the new image generation.'}
              </p>
              <button
                type="button"
                onClick={() => setShowReferencePickerModal(false)}
                className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Close reference image picker"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-4 pr-1">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      value={referenceSearchInput}
                      onChange={(event) => setReferenceSearchInput(event.target.value)}
                      placeholder="Search image assets"
                      className="pl-10"
                    />
                  </div>

                  {loadingReferenceAssets ? (
                    <div className="flex min-h-64 items-center justify-center text-slate-400">
                      <Loader2 className="mr-3 h-5 w-5 animate-spin text-violet-400" />
                      Loading image assets...
                    </div>
                  ) : referenceAssets.length === 0 ? (
                    <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-700 text-center text-slate-400">
                      No image assets found for this search.
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {referenceAssets.map((asset) => {
                        const isSelected = selectedReferenceImages.some((selectedAsset) => selectedAsset.id === asset.id);

                        return (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => toggleReferenceImageSelection(asset)}
                            className={`group overflow-hidden rounded-2xl border text-left transition-all ${
                              isSelected
                                ? 'border-violet-500 bg-violet-500/10'
                                : 'border-slate-800 bg-slate-950 hover:border-slate-700 hover:bg-slate-900'
                            }`}
                          >
                            <div className="relative aspect-video overflow-hidden bg-slate-950">
                              {asset.url ? (
                                <img
                                  src={asset.thumbnailUrl || asset.url || ''}
                                  alt={asset.title}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <ImageIcon className="h-8 w-8 text-slate-500" />
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-violet-500 px-2.5 py-1 text-xs font-medium text-white">
                                  <Check className="h-3.5 w-3.5" />
                                  Selected
                                </div>
                              )}
                            </div>
                            <div className="p-4">
                              <p className="truncate text-sm font-semibold text-white">{asset.title}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {asset.source === 'uploaded' ? 'Uploaded asset' : 'AI generated asset'}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {referenceHasMore && (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="outline"
                        onClick={() => setReferencePage((currentPage) => currentPage + 1)}
                        loading={loadingMoreReferenceAssets}
                        disabled={loadingReferenceAssets || loadingMoreReferenceAssets}
                      >
                        Load More
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-700/50 px-6 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-400">
                    {selectedReferenceImages.length === 0
                      ? 'Select one or more images, then confirm.'
                      : `${selectedReferenceImages.length} reference image${selectedReferenceImages.length === 1 ? '' : 's'} selected`}
                  </p>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <Button variant="ghost" onClick={() => setShowReferencePickerModal(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => setShowReferencePickerModal(false)}>
                      Use Selected Images
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showBaseImagePickerModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setShowBaseImagePickerModal(false)}
        >
          <Card
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden border-slate-700/70 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-slate-700/50 p-6">
              <h2 className="text-2xl font-semibold text-white">Select Base Image</h2>
              <p className="mt-2 text-sm text-slate-400">
                Choose an existing image asset to animate into a video.
              </p>
              <button
                type="button"
                onClick={() => setShowBaseImagePickerModal(false)}
                className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Close base image picker"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-4 pr-1">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      value={referenceSearchInput}
                      onChange={(event) => setReferenceSearchInput(event.target.value)}
                      placeholder="Search image assets"
                      className="pl-10"
                    />
                  </div>

                  {loadingReferenceAssets ? (
                    <div className="flex min-h-64 items-center justify-center text-slate-400">
                      <Loader2 className="mr-3 h-5 w-5 animate-spin text-violet-400" />
                      Loading image assets...
                    </div>
                  ) : referenceAssets.length === 0 ? (
                    <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-700 text-center text-slate-400">
                      No image assets found for this search.
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {referenceAssets.map((asset) => {
                        const isSelected = selectedBaseImage?.id === asset.id;

                        return (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => handleSelectBaseImage(asset)}
                            className={`group overflow-hidden rounded-2xl border text-left transition-all ${
                              isSelected
                                ? 'border-violet-500 bg-violet-500/10'
                                : 'border-slate-800 bg-slate-950 hover:border-slate-700 hover:bg-slate-900'
                            }`}
                          >
                            <div className="relative aspect-video overflow-hidden bg-slate-950">
                              {asset.url ? (
                                <img
                                  src={asset.thumbnailUrl || asset.url || ''}
                                  alt={asset.title}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <ImageIcon className="h-8 w-8 text-slate-500" />
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-violet-500 px-2.5 py-1 text-xs font-medium text-white">
                                  <Check className="h-3.5 w-3.5" />
                                  Selected
                                </div>
                              )}
                            </div>
                            <div className="p-4">
                              <p className="truncate text-sm font-semibold text-white">{asset.title}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {asset.source === 'uploaded' ? 'Uploaded asset' : 'AI generated asset'}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {referenceHasMore && (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="outline"
                        onClick={() => setReferencePage((currentPage) => currentPage + 1)}
                        loading={loadingMoreReferenceAssets}
                        disabled={loadingReferenceAssets || loadingMoreReferenceAssets}
                      >
                        Load More
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-700/50 px-6 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-400">
                    {selectedBaseImage ? `Base image selected: ${selectedBaseImage.title}` : 'Select one image to use as the video base.'}
                  </p>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <Button variant="ghost" onClick={() => setShowBaseImagePickerModal(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => setShowBaseImagePickerModal(false)} disabled={!selectedBaseImage}>
                      Use Base Image
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!uploading) {
              setShowUploadModal(false);
              setSelectedFile(null);
              setFilePreviewUrl(null);
            }
          }}
        >
          <Card
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Upload Asset</h2>
                <button
                  type="button"
                  onClick={() => {
                    if (!uploading) {
                      setShowUploadModal(false);
                      setSelectedFile(null);
                      setFilePreviewUrl(null);
                    }
                  }}
                  className="rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                  aria-label="Close upload modal"
                  disabled={uploading}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*,audio/*"
                onChange={handleFileSelect}
              />

              {!selectedFile && (
                <div
                  className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-700 rounded-lg text-center cursor-pointer hover:border-violet-500 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-12 w-12 text-slate-500 mb-4" />
                  <p className="text-white font-medium mb-2">Drag & Drop or Click to Browse</p>
                  <p className="text-sm text-slate-400">Image, video, or audio files are supported.</p>
                </div>
              )}

              {selectedFile && (
                <div className="space-y-4">
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center">
                    {selectedFile.type.startsWith('image/') && filePreviewUrl ? (
                      <img src={filePreviewUrl} alt="File preview" className="max-h-full max-w-full object-contain" />
                    ) : selectedFile.type.startsWith('video/') && filePreviewUrl ? (
                      <video src={filePreviewUrl} controls className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <AudioLines className="h-16 w-16" />
                        <p className="text-sm">Audio files do not have an inline preview here.</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setFilePreviewUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input
                      }}
                      className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
                      aria-label="Remove selected file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-300">Selected: <span className="font-medium text-white">{selectedFile.name}</span></p>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <Button variant="ghost" onClick={() => {
                  if (!uploading) {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    setFilePreviewUrl(null);
                  }
                }} className="flex-1" disabled={uploading}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUploadSubmit}
                  loading={uploading}
                  disabled={!selectedFile || uploading}
                  className="flex-1"
                >
                  {uploading ? 'Uploading...' : 'Confirm Upload'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Create Modal */}
      {showAICreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={handleCloseAICreateModal}
        >
          <Card
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <div className="flex items-center justify-between border-b border-slate-700/50 px-6 py-5">
                <h2 className="text-xl font-semibold text-white">AI Generate Asset</h2>
                <button
                  type="button"
                  onClick={handleCloseAICreateModal}
                  className="rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                  aria-label="Close AI create modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-4 pr-1">
                  <div>
                  <label htmlFor="ai-content-type" className="mb-2 block text-sm font-medium text-slate-300">Content Type</label>
                  <div className="relative">
                    <select
                      id="ai-content-type"
                      value={aiContentType}
                      onChange={(e) => setAiContentType(e.target.value as AssetType)}
                      disabled={isGenerationBusy}
                      className="block w-full appearance-none rounded-md border border-slate-700 bg-slate-800 py-2 pl-3 pr-10 text-base text-white placeholder-slate-500 focus:border-violet-500 focus:ring-violet-500 sm:text-sm"
                    >
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                      <option value="audio">Audio</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                      </svg>
                    </div>
                  </div>
                  </div>

                  {(aiContentType === 'image' || aiContentType === 'audio') && (
                    <div>
                      <label htmlFor="ai-prompt" className="mb-2 block text-sm font-medium text-slate-300">
                        {aiContentType === 'audio' ? 'What should the voice say?' : 'Describe what you want to create'}
                      </label>
                      <textarea
                        id="ai-prompt"
                        placeholder={
                          aiContentType === 'audio'
                            ? 'Enter the text you want converted to audio'
                            : `Describe the ${aiContentType} you want to generate`
                        }
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        disabled={isGenerationBusy}
                        rows={4}
                        className="block w-full rounded-md border border-slate-700 bg-slate-800 p-3 text-base text-white placeholder-slate-500 shadow-sm focus:border-violet-500 focus:ring-violet-500 sm:text-sm"
                      />
                    </div>
                  )}

                  <input
                    ref={referenceUploadInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleReferenceImageUpload}
                  />

                  {aiContentType !== 'audio' && (
                    <div>
                      <label htmlFor="ai-aspect-ratio" className="mb-2 block text-sm font-medium text-slate-300">Aspect Ratio</label>
                      <select
                        id="ai-aspect-ratio"
                        value={aiAspectRatio}
                        onChange={(e) => setAiAspectRatio(e.target.value as '16:9' | '9:16' | '1:1')}
                        disabled={isGenerationBusy}
                        className="block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:ring-violet-500"
                      >
                        <option value="1:1">1:1</option>
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                      </select>
                    </div>
                  )}

                  {aiContentType === 'image' && (
                    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">Reference Images</p>
                          <p className="mt-1 max-w-md text-xs leading-5 text-slate-400">
                            Add optional image assets to guide the output. You can mix uploaded and existing assets.
                          </p>
                        </div>
                        <span className="w-fit rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300">
                          {selectedReferenceImages.length} selected
                        </span>
                      </div>

                      {selectedReferenceImages.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {selectedReferenceImages.map((asset) => (
                            <div
                              key={asset.id}
                              className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3"
                            >
                              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-950">
                                {asset.url ? (
                                  <img
                                    src={asset.thumbnailUrl || asset.url || ''}
                                    alt={asset.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center">
                                    <ImageIcon className="h-5 w-5 text-slate-500" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-white">{asset.title}</p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {asset.status === 'ready' ? 'Ready to use' : `Status: ${asset.status}`}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedReferenceImages((currentAssets) =>
                                    currentAssets.filter((currentAsset) => currentAsset.id !== asset.id)
                                  )
                                }
                                className="rounded-full border border-slate-700 bg-slate-950 p-2 text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
                                aria-label={`Remove ${asset.title}`}
                                disabled={isGenerationBusy || uploadingReferenceImages}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm leading-6 text-slate-400">
                          No reference images selected. The prompt alone will be used.
                        </div>
                      )}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowReferencePickerModal(true)}
                          disabled={isGenerationBusy || uploadingReferenceImages}
                          className="w-full justify-center"
                        >
                          <ImageIcon className="h-4 w-4" />
                          Select From Assets
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => referenceUploadInputRef.current?.click()}
                          loading={uploadingReferenceImages}
                          disabled={isGenerationBusy || uploadingReferenceImages}
                          className="w-full justify-center"
                        >
                          <Upload className="h-4 w-4" />
                          Upload Reference Images
                        </Button>
                      </div>

                      <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                        <input
                          type="checkbox"
                          checked={aiRemoveBackground}
                          onChange={(event) => setAiRemoveBackground(event.target.checked)}
                          disabled={isGenerationBusy}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-950 text-violet-500 focus:ring-violet-500"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">Remove background</p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            Turn this on when you want the generated image delivered as a clean cutout.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}

                  {aiContentType === 'video' && (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-300">Video Source</label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => setVideoGenerationMode('prompt')}
                            disabled={isGenerationBusy}
                            className={`rounded-xl border p-4 text-left transition-all ${
                              videoGenerationMode === 'prompt'
                                ? 'border-violet-500 bg-violet-500/10'
                                : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                            }`}
                          >
                            <p className="text-sm font-medium text-white">Generate From Prompt</p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">
                              Describe the visual, optionally add reference images, then animate it.
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setVideoGenerationMode('base-image')}
                            disabled={isGenerationBusy}
                            className={`rounded-xl border p-4 text-left transition-all ${
                              videoGenerationMode === 'base-image'
                                ? 'border-violet-500 bg-violet-500/10'
                                : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                            }`}
                          >
                            <p className="text-sm font-medium text-white">Animate Base Image</p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">
                              Pick an existing image asset, then provide the motion prompt only.
                            </p>
                          </button>
                        </div>
                      </div>

                      {videoGenerationMode === 'base-image' ? (
                        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white">Base Image</p>
                              <p className="mt-1 max-w-md text-xs leading-5 text-slate-400">
                                Select the image asset you want to animate into a video.
                              </p>
                            </div>
                            {selectedBaseImage && (
                              <span className="w-fit rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300">
                                Selected
                              </span>
                            )}
                          </div>

                          {selectedBaseImage ? (
                            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-950">
                                {selectedBaseImage.url ? (
                                  <img
                                    src={selectedBaseImage.thumbnailUrl || selectedBaseImage.url || ''}
                                    alt={selectedBaseImage.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center">
                                    <ImageIcon className="h-5 w-5 text-slate-500" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-white">{selectedBaseImage.title}</p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {selectedBaseImage.status === 'ready' ? 'Ready to animate' : `Status: ${selectedBaseImage.status}`}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedBaseImage(null)}
                                className="rounded-full border border-slate-700 bg-slate-950 p-2 text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
                                aria-label={`Remove ${selectedBaseImage.title}`}
                                disabled={isGenerationBusy}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm leading-6 text-slate-400">
                              No base image selected yet.
                            </div>
                          )}

                          <div className="flex flex-wrap gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShowBaseImagePickerModal(true)}
                              disabled={isGenerationBusy}
                            >
                              <ImageIcon className="h-4 w-4" />
                              {selectedBaseImage ? 'Change Base Image' : 'Select Base Image'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label htmlFor="ai-video-image-prompt" className="mb-2 block text-sm font-medium text-slate-300">
                              Base Image Prompt
                            </label>
                            <textarea
                              id="ai-video-image-prompt"
                              placeholder="Describe the base image you want to generate for this video"
                              value={aiPrompt}
                              onChange={(e) => setAiPrompt(e.target.value)}
                              disabled={isGenerationBusy}
                              rows={4}
                              className="block w-full rounded-md border border-slate-700 bg-slate-800 p-3 text-base text-white placeholder-slate-500 shadow-sm focus:border-violet-500 focus:ring-violet-500 sm:text-sm"
                            />
                          </div>

                          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-white">Reference Images</p>
                                <p className="mt-1 max-w-md text-xs leading-5 text-slate-400">
                                  Add optional image assets to guide the generated base image before animation.
                                </p>
                              </div>
                              <span className="w-fit rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300">
                                {selectedReferenceImages.length} selected
                              </span>
                            </div>

                            {selectedReferenceImages.length > 0 ? (
                              <div className="grid gap-3 sm:grid-cols-2">
                                {selectedReferenceImages.map((asset) => (
                                  <div
                                    key={asset.id}
                                    className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3"
                                  >
                                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-950">
                                      {asset.url ? (
                                        <img
                                          src={asset.thumbnailUrl || asset.url || ''}
                                          alt={asset.title}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-full items-center justify-center">
                                          <ImageIcon className="h-5 w-5 text-slate-500" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium text-white">{asset.title}</p>
                                      <p className="mt-1 text-xs text-slate-400">
                                        {asset.status === 'ready' ? 'Ready to use' : `Status: ${asset.status}`}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedReferenceImages((currentAssets) =>
                                          currentAssets.filter((currentAsset) => currentAsset.id !== asset.id)
                                        )
                                      }
                                      className="rounded-full border border-slate-700 bg-slate-950 p-2 text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
                                      aria-label={`Remove ${asset.title}`}
                                      disabled={isGenerationBusy || uploadingReferenceImages}
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm leading-6 text-slate-400">
                                No reference images selected. The base image prompt alone will be used.
                              </div>
                            )}

                            <div className="grid gap-3 sm:grid-cols-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowReferencePickerModal(true)}
                                disabled={isGenerationBusy || uploadingReferenceImages}
                                className="w-full justify-center"
                              >
                                <ImageIcon className="h-4 w-4" />
                                Select From Assets
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => referenceUploadInputRef.current?.click()}
                                loading={uploadingReferenceImages}
                                disabled={isGenerationBusy || uploadingReferenceImages}
                                className="w-full justify-center"
                              >
                                <Upload className="h-4 w-4" />
                                Upload Reference Images
                              </Button>
                            </div>
                          </div>
                        </>
                      )}

                      <div>
                        <label htmlFor="ai-motion-prompt" className="mb-2 block text-sm font-medium text-slate-300">
                          Motion Prompt
                        </label>
                        <textarea
                          id="ai-motion-prompt"
                          placeholder={
                            videoGenerationMode === 'base-image'
                              ? 'Describe how the selected base image should move'
                              : 'Describe the camera and scene motion for the generated video'
                          }
                          value={aiMotionPrompt}
                          onChange={(e) => setAiMotionPrompt(e.target.value)}
                          disabled={isGenerationBusy}
                          rows={3}
                          className="block w-full rounded-md border border-slate-700 bg-slate-800 p-3 text-base text-white placeholder-slate-500 shadow-sm focus:border-violet-500 focus:ring-violet-500 sm:text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {aiContentType === 'video' ? (
                    <div>
                      <label htmlFor="ai-video-duration" className="mb-2 block text-sm font-medium text-slate-300">Duration (seconds)</label>
                      <select
                        id="ai-video-duration"
                        value={aiDurationSeconds}
                        onChange={(e) => setAiDurationSeconds(e.target.value)}
                        disabled={isGenerationBusy}
                        className="block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:ring-violet-500"
                      >
                        <option value="5">5 seconds</option>
                        <option value="10">10 seconds</option>
                      </select>
                    </div>
                  ) : aiContentType === 'audio' ? (
                    <Input
                      label="Duration (seconds)"
                      type="number"
                      min="1"
                      step="1"
                      value={aiDurationSeconds}
                      onChange={(e) => setAiDurationSeconds(e.target.value)}
                      disabled={isGenerationBusy}
                    />
                  ) : null}

                  {aiContentType === 'audio' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-slate-300">ElevenLabs Voice</label>
                        {selectedVoice && (
                          <button
                            type="button"
                            onClick={() => setSelectedVoice(null)}
                            className="text-xs font-medium text-slate-400 transition-colors hover:text-white"
                            disabled={isGenerationBusy}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {selectedVoice ? (
                        <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">{selectedVoice.name}</p>
                              {(selectedVoice.description || getVoiceMeta(selectedVoice)) && (
                                <p className="mt-1 text-xs text-slate-300">
                                  {selectedVoice.description || getVoiceMeta(selectedVoice)}
                                </p>
                              )}
                            </div>
                            <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-1 text-[11px] font-medium text-violet-200">
                              Selected
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowVoicePickerModal(true)}
                              disabled={isGenerationBusy}
                            >
                              Change Voice
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between"
                          onClick={() => setShowVoicePickerModal(true)}
                          disabled={isGenerationBusy}
                        >
                          <span>Select ElevenLabs Voice</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}

                  {generationJob && (
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">Generation Progress</p>
                          <p className="mt-1 text-xs text-slate-300">
                            Status: {generationJob.status}
                          </p>
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

                      {generationJob.error && (
                        <p className="mt-3 text-sm text-red-300">{generationJob.error}</p>
                      )}
                    </div>
                  )}

                  {generationError && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                      <p className="text-sm font-medium text-red-200">{generationError}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-700/50 px-6 py-4">
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Button variant="ghost" onClick={handleCloseAICreateModal} className="flex-1">
                    {isGenerationBusy ? 'Close' : 'Cancel'}
                  </Button>
                  <Button
                    onClick={handleAICreateSubmit}
                    loading={generatingAI}
                    disabled={!canSubmitAICreate}
                    className="flex-1"
                  >
                    {generatingAI ? 'Starting...' : pollingGeneration ? 'Generating...' : `Generate ${getAssetTypeLabel(aiContentType)}`}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Video Player Modal */}
      {showVideoPlayerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setShowVideoPlayerModal(null)}
        >
          <Card
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden border-slate-700/70 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-slate-700/50 p-6">
              <h2 className="text-2xl font-semibold text-white">{showVideoPlayerModal.title}</h2>
              <button
                type="button"
                onClick={() => setShowVideoPlayerModal(null)}
                className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Close video player"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <CardContent className="flex flex-col items-center justify-center space-y-4 p-6">
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoPlayerRef}
                  src={showVideoPlayerModal.url || undefined}
                  poster={showVideoPlayerModal.thumbnailUrl || undefined}
                  className="w-full h-full object-contain"
                  controls // Add native controls for full functionality within modal
                />
              </div>

              <div className="flex flex-wrap gap-3 mt-4">
                <a href={showVideoPlayerModal.url || '#'} download>
                  <Button variant="outline">
                    <Download className="h-4 w-4" />
                    Download Original
                  </Button>
                </a>
                <Button
                  variant="danger"
                  onClick={() => {
                    setShowVideoPlayerModal(null); // Close player before showing delete dialog
                    setAssetToDelete(showVideoPlayerModal);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setShowImageModal(null)}
        >
          <Card
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden border-slate-700/70 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-slate-700/50 p-6">
              <h2 className="text-2xl font-semibold text-white">{showImageModal.title}</h2>
              <button
                type="button"
                onClick={() => setShowImageModal(null)}
                className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Close image preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <CardContent className="flex flex-col items-center justify-center space-y-4 p-6">
              <div className="relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-slate-950">
                <img
                  src={showImageModal.url || ''}
                  alt={showImageModal.title}
                  className="max-h-[70vh] w-auto max-w-full object-contain"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <a href={showImageModal.url || '#'} download>
                  <Button variant="outline">
                    <Download className="h-4 w-4" />
                    Download Image
                  </Button>
                </a>
                <Button
                  variant="danger"
                  onClick={() => {
                    setShowImageModal(null);
                    setAssetToDelete(showImageModal);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showAudioPlayerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setShowAudioPlayerModal(null)}
        >
          <Card
            className="flex w-full max-w-2xl flex-col overflow-hidden border-slate-700/70 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-slate-700/50 p-6">
              <h2 className="text-2xl font-semibold text-white">{showAudioPlayerModal.title}</h2>
              <button
                type="button"
                onClick={() => setShowAudioPlayerModal(null)}
                className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Close audio player"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <CardContent className="space-y-6 p-6">
              <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                  <AudioLines className="h-8 w-8" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-white">{showAudioPlayerModal.title}</p>
                  <p className="text-sm text-slate-400">Audio preview</p>
                </div>
              </div>

              <audio
                src={showAudioPlayerModal.url || undefined}
                controls
                className="w-full"
              />

              <div className="flex flex-wrap gap-3">
                <a href={showAudioPlayerModal.url || '#'} download>
                  <Button variant="outline">
                    <Download className="h-4 w-4" />
                    Download Audio
                  </Button>
                </a>
                <Button
                  variant="danger"
                  onClick={() => {
                    setShowAudioPlayerModal(null);
                    setAssetToDelete(showAudioPlayerModal);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}


      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-violet-200">
            Your Assets
            <span className="rounded-full bg-white/10 px-2 py-0.5 tracking-normal text-white">{totalAssets}</span>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">Manage your creative assets</h1>
          <p className="max-w-2xl text-slate-400">
            Upload or generate image, video, and audio assets from the new backend endpoints.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              void loadAssets('refresh');
            }}
            loading={refreshingAssets}
            disabled={loadingAssets || refreshingAssets}
          >
            <RefreshCw className="h-5 w-5" />
            Refresh
          </Button>
          <Button variant="secondary" onClick={() => setShowUploadModal(true)}>
            <Upload className="h-5 w-5" />
            Upload
          </Button>
          <Button onClick={() => setShowAICreateModal(true)}>
            <Sparkles className="h-5 w-5" />
            AI Create
          </Button>
        </div>
      </div>

      {/* Asset Stats Cards (Optional, but good for dashboard feel) */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">
                <Video className="h-3.5 w-3.5" />
                Total Assets
              </span>
              <p className="mt-3 text-2xl font-semibold text-white">{totalAssets}</p>
            </div>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-slate-200">
              <VideoIcon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/12 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-blue-200">
                <ImageIcon className="h-3.5 w-3.5" />
                Images On Page
              </span>
              <p className="mt-3 text-2xl font-semibold text-blue-300">{assets.filter(a => a.type === 'image').length}</p>
            </div>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-200">
              <ImageIcon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-200">
                <VideoIcon className="h-3.5 w-3.5" />
                Videos On Page
              </span>
              <p className="mt-3 text-2xl font-semibold text-emerald-300">{assets.filter(a => a.type === 'video').length}</p>
            </div>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-200">
              <VideoIcon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-cyan-500/12 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-200">
                <AudioLines className="h-3.5 w-3.5" />
                Audio On Page
              </span>
              <p className="mt-3 text-2xl font-semibold text-cyan-300">{assets.filter((a) => a.type === 'audio').length}</p>
            </div>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-cyan-500/12 text-cyan-200">
              <AudioLines className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6 overflow-hidden">
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search assets by title"
                className="pl-10"
              />
            </div>

            <div className="relative">
              <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={assetTypeFilter}
                onChange={(event) => setAssetTypeFilter(event.target.value as AssetTypeFilter)}
                className="block w-full rounded-md border border-slate-700 bg-slate-800 py-2 pl-10 pr-3 text-sm text-white focus:border-violet-500 focus:ring-violet-500"
              >
                <option value="all">All types</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
              </select>
            </div>

            <div className="relative">
              <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={sourceTypeFilter}
                onChange={(event) => setSourceTypeFilter(event.target.value as AssetSourceFilter)}
                className="block w-full rounded-md border border-slate-700 bg-slate-800 py-2 pl-10 pr-3 text-sm text-white focus:border-violet-500 focus:ring-violet-500"
              >
                <option value="all">All sources</option>
                <option value="generated">AI Generated</option>
                <option value="uploaded">Uploaded</option>
              </select>
            </div>

            <Button
              variant="ghost"
              onClick={() => {
                setSearchInput('');
                setDebouncedSearch('');
                setAssetTypeFilter('all');
                setSourceTypeFilter('all');
                setPage(1);
              }}
              disabled={!hasActiveFilters}
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* Main Asset Grid */}
      {loadingAssets ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : assets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-800">
              <ImageIcon className="h-10 w-10 text-slate-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-white">
              {hasActiveFilters ? 'No assets match these filters' : 'No assets yet'}
            </h3>
            <p className="mb-6 text-center text-slate-400">
              {hasActiveFilters
                ? 'Try changing your search or filters to see more assets.'
                : 'Upload or generate image, video, and audio assets to populate your library.'}
            </p>
            {hasActiveFilters ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchInput('');
                  setDebouncedSearch('');
                  setAssetTypeFilter('all');
                  setSourceTypeFilter('all');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowUploadModal(true)}>
                  <Upload className="h-5 w-5" />
                  Upload
                </Button>
                <Button onClick={() => setShowAICreateModal(true)}>
                  <Sparkles className="h-5 w-5" />
                  AI Create
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assets.map((asset) => (
              <Card
                key={asset.id}
                hover
                className="group relative cursor-pointer overflow-hidden border-slate-700/70 bg-slate-900 shadow-xl transition-all duration-300 ease-in-out hover:scale-[1.02]"
              >
                <div
                  className="relative w-full pt-[75%] overflow-hidden"
                  onClick={() => {
                    if (asset.type === 'video' && asset.url) {
                      setShowVideoPlayerModal(asset as VideoAsset);
                    } else if (asset.type === 'image' && asset.url) {
                      setShowImageModal(asset as ImageAsset);
                    } else if (asset.type === 'audio' && asset.url) {
                      setShowAudioPlayerModal(asset as AudioAsset);
                    }
                  }}
                >
                  {asset.type === 'image' && asset.url ? (
                    <img
                      src={asset.url}
                      alt={asset.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : asset.type === 'video' && (asset.thumbnailUrl || asset.url) ? (
                    <>
                      <img
                        src={asset.thumbnailUrl || asset.url || ''}
                        alt={asset.title}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <PlayCircle className="h-16 w-16 text-white/90" />
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                      {getAssetIcon(asset.type)}
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                    {asset.type === 'image' ? <ImageIcon className="h-3 w-3" /> : asset.type === 'video' ? <VideoIcon className="h-3 w-3" /> : <AudioLines className="h-3 w-3" />}
                    {getAssetTypeLabel(asset.type)}
                  </div>
                  <div className={`absolute top-3 right-3 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(asset.status)}`}>
                    {asset.status}
                  </div>
                  {asset.status !== 'ready' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-sm font-medium text-white">
                      {asset.status === 'processing' ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Unavailable
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <CardContent className="flex flex-col gap-4 p-5">
                  <div>
                    <h3 className="truncate text-base font-semibold leading-6 text-white" title={asset.title}>
                      {asset.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-slate-300 ${asset.source === 'uploaded' ? 'bg-blue-500/12 text-blue-200' : 'bg-violet-500/12 text-violet-200'}`}>
                        {asset.source === 'uploaded' ? 'Uploaded' : 'AI Generated'}
                      </span>
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-slate-400">
                        {formatDateTime(asset.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-stretch gap-2">
                    {asset.type === 'video' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full min-w-0 whitespace-nowrap px-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (asset.url) {
                            setShowVideoPlayerModal(asset as VideoAsset);
                          }
                        }}
                        disabled={!asset.url}
                      >
                        <PlayCircle className="h-4 w-4" />
                        Preview
                      </Button>
                    ) : asset.type === 'audio' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full min-w-0 whitespace-nowrap px-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (asset.url) {
                            setShowAudioPlayerModal(asset as AudioAsset);
                          }
                        }}
                        disabled={!asset.url}
                      >
                        <AudioLines className="h-4 w-4" />
                        Open Audio
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full min-w-0 whitespace-nowrap px-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (asset.url) {
                            setShowImageModal(asset as ImageAsset);
                          }
                        }}
                        disabled={!asset.url}
                      >
                        <ImageIcon className="h-4 w-4" />
                        View Image
                      </Button>
                    )}
                    <a
                      href={asset.url || '#'}
                      download={asset.title}
                      className="min-w-0"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button variant="outline" className="w-full min-w-0 whitespace-nowrap px-3" size="sm" disabled={!asset.url}>
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    </a>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setAssetToDelete(asset);
                      }}
                      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400"
                      aria-label={`Delete ${asset.title}`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-300">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
