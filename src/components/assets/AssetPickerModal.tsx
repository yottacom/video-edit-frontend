'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  ChevronRight,
  Check,
  Image as ImageIcon,
  Loader2,
  Play,
  PlayCircle,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { VideoThumbnail } from '@/components/media/VideoThumbnail';
import { assetsApi, getApiErrorMessage } from '@/lib/api';
import {
  formatLibraryAssetDuration,
  getFileAssetType,
  LibraryAsset,
  LibraryAssetSourceFilter,
  mapAssetItemToLibraryAsset,
  mergeLibraryAssetsById,
} from '@/lib/library-assets';
import { AssetGenerationJobResponse, AssetType, ElevenLabsVoice } from '@/types';

interface AssetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAsset: (asset: LibraryAsset) => void;
  allowedTypes?: AssetType[];
}

export function AssetPickerModal({
  isOpen,
  onClose,
  onSelectAsset,
  allowedTypes,
}: AssetPickerModalProps) {
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState<AssetType | 'all'>('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<LibraryAssetSourceFilter>('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<LibraryAsset | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiContentType, setAiContentType] = useState<AssetType>('image');
  const [aiAspectRatio, setAiAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('1:1');
  const [aiDurationSeconds, setAiDurationSeconds] = useState('5');
  const [selectedVoice, setSelectedVoice] = useState<ElevenLabsVoice | null>(null);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [loadingMoreVoices, setLoadingMoreVoices] = useState(false);
  const [voicesNextPageToken, setVoicesNextPageToken] = useState<string | null>(null);
  const [voicesHasMore, setVoicesHasMore] = useState(false);
  const [showVoicePickerModal, setShowVoicePickerModal] = useState(false);
  const [voiceSearchInput, setVoiceSearchInput] = useState('');
  const [debouncedVoiceSearch, setDebouncedVoiceSearch] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [pollingGeneration, setPollingGeneration] = useState(false);
  const [generationJob, setGenerationJob] = useState<AssetGenerationJobResponse | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastQueryKeyRef = useRef<string | null>(null);
  const pageSize = 24;

  const availableAssetTypes = allowedTypes && allowedTypes.length > 0
    ? allowedTypes
    : (['image', 'video', 'audio'] as AssetType[]);

  const filteredAssets = assets.filter((asset) => !allowedTypes || allowedTypes.includes(asset.type));
  const isGenerationBusy = generatingAI || pollingGeneration;
  const pickerQueryKey = JSON.stringify({
    search: debouncedSearch,
    type: assetTypeFilter,
    source: sourceTypeFilter,
    allowed: allowedTypes || [],
  });

  const resetUploadState = useCallback(() => {
    setSelectedFile(null);
    setFilePreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }
      return null;
    });
    setUploadError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const loadAssets = useCallback(async (mode: 'replace' | 'append' | 'refresh' = 'replace') => {
    if (!isOpen) {
      return;
    }

    if (mode === 'append') {
      setLoadingMore(true);
    } else if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const assetTypeParam =
        allowedTypes?.length === 1
          ? allowedTypes[0]
          : assetTypeFilter === 'all'
            ? undefined
            : assetTypeFilter;

      const response = await assetsApi.list({
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        asset_type: assetTypeParam,
        source_type: sourceTypeFilter === 'all' ? undefined : sourceTypeFilter,
      });

      const nextAssets = response.items
        .filter((item) => item.status === 'ready')
        .map(mapAssetItemToLibraryAsset)
        .filter((asset) => !allowedTypes || allowedTypes.includes(asset.type));

      setAssets((currentAssets) => {
        if (mode === 'append') {
          return mergeLibraryAssetsById(currentAssets, nextAssets);
        }

        return nextAssets;
      });

      const totalLoaded = mode === 'append' ? filteredAssets.length + nextAssets.length : nextAssets.length;
      setHasMore(totalLoaded < response.total);
    } catch (error) {
      console.error('Failed to load asset picker library:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [
    allowedTypes,
    assetTypeFilter,
    debouncedSearch,
    filteredAssets.length,
    isOpen,
    page,
    pageSize,
    sourceTypeFilter,
  ]);

  const refreshAssets = useCallback(async () => {
    if (page === 1) {
      await loadAssets('refresh');
      return;
    }

    setPage(1);
  }, [loadAssets, page]);

  const resetPickerSession = useCallback(() => {
    setSearchInput('');
    setDebouncedSearch('');
    setSourceTypeFilter('all');
    setAssetTypeFilter(allowedTypes && allowedTypes.length === 1 ? allowedTypes[0] : 'all');
    setAiContentType(allowedTypes && allowedTypes.length > 0 ? allowedTypes[0] : 'image');
    setAiAspectRatio('1:1');
    setAiDurationSeconds('5');
    setAiPrompt('');
    setSelectedVoice(null);
    setVoiceSearchInput('');
    setDebouncedVoiceSearch('');
    setShowVoicePickerModal(false);
    setGenerationJob(null);
    setGenerationError(null);
    setPollingGeneration(false);
    setPage(1);
    resetUploadState();
  }, [allowedTypes, resetUploadState]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    resetPickerSession();
  }, [isOpen, resetPickerSession]);

  const handleClosePicker = useCallback(() => {
    setShowUploadDialog(false);
    setShowGenerateDialog(false);
    setPreviewAsset(null);
    onClose();
  }, [onClose]);

  const handleAssetSelection = useCallback((asset: LibraryAsset) => {
    onSelectAsset(asset);
    handleClosePicker();
  }, [handleClosePicker, onSelectAsset]);

  const handleFileSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      resetUploadState();
      return;
    }

    const assetType = getFileAssetType(file);

    if (!assetType) {
      setSelectedFile(null);
      setFilePreviewUrl((currentPreviewUrl) => {
        if (currentPreviewUrl) {
          URL.revokeObjectURL(currentPreviewUrl);
        }
        return null;
      });
      setUploadError('Please choose an image, video, or audio file.');
      return;
    }

    if (allowedTypes && !allowedTypes.includes(assetType)) {
      setSelectedFile(null);
      setFilePreviewUrl((currentPreviewUrl) => {
        if (currentPreviewUrl) {
          URL.revokeObjectURL(currentPreviewUrl);
        }
        return null;
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setUploadError(`This picker only accepts ${allowedTypes.join(', ')} assets.`);
      return;
    }

    setUploadError(null);
    setSelectedFile(file);
    setFilePreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }

      return assetType === 'audio' ? null : URL.createObjectURL(file);
    });
  }, [allowedTypes, resetUploadState]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      return;
    }

    const assetType = getFileAssetType(selectedFile);

    if (!assetType) {
      setUploadError('Unsupported file type.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const uploadedAsset = await assetsApi.upload(
        selectedFile,
        selectedFile.name.replace(/\.[^/.]+$/, ''),
        assetType
      );
      const mappedAsset = mapAssetItemToLibraryAsset(uploadedAsset);

      setAssets((currentAssets) => mergeLibraryAssetsById(currentAssets, [mappedAsset]));
      resetUploadState();

      if (page === 1) {
        await loadAssets('refresh');
      } else {
        setPage(1);
      }
    } catch (error) {
      console.error('Failed to upload asset from picker:', error);
      setUploadError(getApiErrorMessage(error, 'Failed to upload asset.'));
    } finally {
      setUploading(false);
    }
  }, [loadAssets, page, resetUploadState, selectedFile]);

  const handleGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) {
      return;
    }

    setGeneratingAI(true);
    setGenerationError(null);

    try {
      const response = await assetsApi.generate({
        asset_type: aiContentType,
        prompt: aiContentType === 'audio' ? undefined : aiPrompt,
        text: aiContentType === 'audio' ? aiPrompt : undefined,
        aspect_ratio: aiContentType === 'audio' ? undefined : aiAspectRatio,
        duration_seconds: Number(aiDurationSeconds) || 5,
        elevenlabs_voice_id: aiContentType === 'audio' && selectedVoice ? selectedVoice.voice_id : undefined,
      });

      if (response.asset) {
        const mappedAsset = mapAssetItemToLibraryAsset(response.asset);
        setAssets((currentAssets) => mergeLibraryAssetsById(currentAssets, [mappedAsset]));
        setAiPrompt('');

        if (page === 1) {
          await loadAssets('refresh');
        } else {
          setPage(1);
        }
      } else {
        setGenerationJob(response);

        if (response.job_id) {
          setPollingGeneration(true);
        } else {
          setGenerationError('Generation started, but the backend did not return polling details.');
        }
      }
    } catch (error) {
      console.error('Failed to generate asset from picker:', error);
      setGenerationError(getApiErrorMessage(error, 'Failed to generate asset.'));
    } finally {
      setGeneratingAI(false);
    }
  }, [
    aiAspectRatio,
    aiContentType,
    aiDurationSeconds,
    aiPrompt,
    loadAssets,
    page,
    selectedVoice,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedVoiceSearch(voiceSearchInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [voiceSearchInput]);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

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
  }, [debouncedVoiceSearch, loadVoices, showVoicePickerModal]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (
      lastQueryKeyRef.current &&
      lastQueryKeyRef.current !== pickerQueryKey &&
      page !== 1
    ) {
      lastQueryKeyRef.current = pickerQueryKey;
      setPage(1);
      return;
    }

    lastQueryKeyRef.current = pickerQueryKey;
    void loadAssets(page === 1 ? 'replace' : 'append');
  }, [isOpen, loadAssets, page, pickerQueryKey]);

  useEffect(() => {
    const jobId = generationJob?.job_id;
    const pollUrl = generationJob?.poll_url || undefined;

    if (!jobId || !pollingGeneration) {
      return;
    }

    let cancelled = false;

    const pollGenerationJob = async () => {
      try {
        const result = await assetsApi.pollGenerationJob(
          jobId,
          pollUrl
        );

        if (cancelled) {
          return;
        }

        setGenerationJob(result);

        if (result.asset) {
          const mappedAsset = mapAssetItemToLibraryAsset(result.asset);
          setAssets((currentAssets) => mergeLibraryAssetsById(currentAssets, [mappedAsset]));
          setPollingGeneration(false);
          setAiPrompt('');
          setGenerationJob(null);
          setGenerationError(null);

          if (page === 1) {
            await loadAssets('refresh');
          } else {
            setPage(1);
          }
          return;
        }

        if (result.status === 'failed') {
          setPollingGeneration(false);
          setGenerationError(result.error || 'AI generation failed.');
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
          setPollingGeneration(false);
          setGenerationError(getApiErrorMessage(error, 'Failed to poll generation progress.'));
        }
      }
    };

    void pollGenerationJob();

    return () => {
      cancelled = true;
    };
  }, [generationJob?.job_id, generationJob?.poll_url, loadAssets, page, pollingGeneration]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={handleClosePicker}>
      <Card className="flex h-[88vh] w-full max-w-7xl flex-col overflow-hidden border-slate-700/70 bg-slate-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={availableAssetTypes.map((type) => `${type}/*`).join(',')}
          onChange={handleFileSelect}
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
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by asset title"
                className="block w-full rounded-md border border-slate-700 bg-slate-800 py-2 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div className="relative">
              <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={assetTypeFilter}
                onChange={(event) => setAssetTypeFilter(event.target.value as AssetType | 'all')}
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
                onChange={(event) => setSourceTypeFilter(event.target.value as LibraryAssetSourceFilter)}
                className="block w-full rounded-md border border-slate-700 bg-slate-800 py-2 pl-10 pr-3 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="all">All sources</option>
                <option value="generated">AI generated</option>
                <option value="uploaded">Uploaded</option>
              </select>
            </div>

            <Button variant="outline" onClick={() => { void refreshAssets(); }} loading={refreshing} disabled={loading || refreshing || loadingMore}>
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
              setPage((currentPage) => currentPage + 1);
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
                  onClick={() => handleAssetSelection(asset)}
                  className="cursor-pointer overflow-hidden border-slate-700/70 bg-slate-950 transition-all duration-200 hover:scale-[1.01] hover:border-violet-500/50"
                >
                  <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-slate-900">
                    {asset.type === 'image' && (
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url("${asset.url}")` }}
                      />
                    )}
                    {asset.type === 'video' && (
                      <>
                        <VideoThumbnail
                          videoUrl={asset.url}
                          thumbnailUrl={asset.thumbnailUrl}
                          title={asset.title}
                          className="absolute inset-0 h-full w-full object-cover"
                          fallbackIconClassName="h-12 w-12 text-white/70"
                        />
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
                      <span>{asset.type === 'image' ? 'Still image' : formatLibraryAssetDuration(asset.duration_seconds)}</span>
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
                      <p className="text-sm text-slate-400">{formatLibraryAssetDuration(previewAsset.duration_seconds)}</p>
                    </div>
                  </div>
                  <audio src={previewAsset.url} controls autoPlay className="w-full" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showVoicePickerModal && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setShowVoicePickerModal(false)}
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
                onClick={() => setShowVoicePickerModal(false)}
                className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Close voice picker"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-6">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  placeholder="Search voices by name, accent, or description"
                  value={voiceSearchInput}
                  onChange={(event) => setVoiceSearchInput(event.target.value)}
                  className="block w-full rounded-md border border-slate-700 bg-slate-800 py-2 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div
                className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
                onScroll={(event) => {
                  const target = event.currentTarget;
                  const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
                  if (distanceFromBottom < 120 && voicesHasMore && !loadingVoices && !loadingMoreVoices && voicesNextPageToken) {
                    void loadVoices('append', voicesNextPageToken);
                  }
                }}
              >
                {loadingVoices ? (
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
                      onClick={() => {
                        setSelectedVoice(voice);
                        setShowVoicePickerModal(false);
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition-all ${
                        selectedVoice?.voice_id === voice.voice_id
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
                            <span className="rounded-full bg-slate-900 px-2.5 py-1">
                              {[voice.gender, voice.age, voice.accent || voice.language || voice.locale].filter(Boolean).join(' • ')}
                            </span>
                            {voice.locale && (
                              <span className="rounded-full bg-slate-900 px-2.5 py-1">{voice.locale}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {selectedVoice?.voice_id === voice.voice_id && (
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

                {loadingMoreVoices && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showUploadDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowUploadDialog(false)}>
          <Card className="w-full max-w-xl border-slate-700/70 bg-slate-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
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
                  onClick={() => fileInputRef.current?.click()}
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
                      <div
                        className="h-full w-full bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: `url("${filePreviewUrl}")` }}
                      />
                    ) : selectedFile.type.startsWith('video/') && filePreviewUrl ? (
                      <video src={filePreviewUrl} controls className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <AudioLines className="h-14 w-14" />
                        <p className="text-sm">Audio files are ready to upload.</p>
                      </div>
                    )}
                    <button type="button" onClick={resetUploadState} className="absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white transition-colors hover:bg-black">
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
                <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="h-4 w-4" />
                  Browse
                </Button>
                <Button className="flex-1" onClick={() => { void handleUpload(); }} loading={uploading} disabled={!selectedFile || uploading}>
                  <Upload className="h-4 w-4" />
                  Upload Asset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showGenerateDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowGenerateDialog(false)}>
          <Card className="w-full max-w-xl border-slate-700/70 bg-slate-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
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
                    onChange={(event) => setAiContentType(event.target.value as AssetType)}
                    disabled={isGenerationBusy}
                    className="block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                  >
                    {availableAssetTypes.includes('image') && <option value="image">Image</option>}
                    {availableAssetTypes.includes('video') && <option value="video">Video</option>}
                    {availableAssetTypes.includes('audio') && <option value="audio">Audio</option>}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    {aiContentType === 'audio' ? 'What should the voice say?' : 'Prompt'}
                  </label>
                  <textarea
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    rows={4}
                    disabled={isGenerationBusy}
                    placeholder={
                      aiContentType === 'audio'
                        ? 'Enter the text you want converted to audio'
                        : `Describe the ${aiContentType} you want to generate`
                    }
                    className="block w-full rounded-md border border-slate-700 bg-slate-800 p-3 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>

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
                            {(selectedVoice.description || [selectedVoice.gender, selectedVoice.age, selectedVoice.accent || selectedVoice.language || selectedVoice.locale].filter(Boolean).join(' • ')) && (
                              <p className="mt-1 text-xs text-slate-300">
                                {selectedVoice.description || [selectedVoice.gender, selectedVoice.age, selectedVoice.accent || selectedVoice.language || selectedVoice.locale].filter(Boolean).join(' • ')}
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

                {aiContentType !== 'audio' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Aspect Ratio</label>
                    <select
                      value={aiAspectRatio}
                      onChange={(event) => setAiAspectRatio(event.target.value as '16:9' | '9:16' | '1:1')}
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
                      onChange={(event) => setAiDurationSeconds(event.target.value)}
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
                      onChange={(event) => setAiDurationSeconds(event.target.value)}
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

                <Button onClick={() => { void handleGenerate(); }} loading={generatingAI} disabled={!aiPrompt.trim() || isGenerationBusy} className="w-full">
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
}
