'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Video,
  Loader2,
  Edit,
  Trash2,
  Download,
  CalendarDays,
  Film,
  PlayCircle,
  Clock,
  X,
  MonitorPlay,
  Smartphone,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { customVideosApi, getApiErrorMessage } from '@/lib/api';
import { CustomVideo, CustomVideoStatus } from '@/types';

const CUSTOM_VIDEO_STORAGE_KEY = 'custom_video_recent_ids';

interface VideoProject {
  id: string;
  title: string;
  videoType: 'portrait' | 'landscape';
  updatedAt: string;
  createdAt: string;
  durationSeconds: number;
  status: CustomVideoStatus;
  progress: number;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  errorMessage: string | null;
}

function getStoredCustomVideoIds() {
  if (typeof window === 'undefined') {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_VIDEO_STORAGE_KEY) || '[]') as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rememberCustomVideoId(customVideoId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const nextIds = [customVideoId, ...getStoredCustomVideoIds().filter((id) => id !== customVideoId)].slice(0, 25);
  localStorage.setItem(CUSTOM_VIDEO_STORAGE_KEY, JSON.stringify(nextIds));
}

function removeStoredCustomVideoId(customVideoId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const nextIds = getStoredCustomVideoIds().filter((id) => id !== customVideoId);
  localStorage.setItem(CUSTOM_VIDEO_STORAGE_KEY, JSON.stringify(nextIds));
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDurationSeconds(video: CustomVideo) {
  return Math.max(
    0,
    Math.round(
      video.scenes.reduce((total, scene) => total + ((scene.duration_ms || 0) / 1000), 0)
    )
  );
}

function mapCustomVideoToProject(video: CustomVideo): VideoProject {
  return {
    id: video.id,
    title: video.title || 'Custom Video Draft',
    videoType: video.video_type,
    updatedAt: video.updated_at || video.created_at || new Date().toISOString(),
    createdAt: video.created_at || new Date().toISOString(),
    durationSeconds: getDurationSeconds(video),
    status: video.status,
    progress: video.progress || 0,
    outputUrl: video.output_url || null,
    thumbnailUrl: video.status === 'completed' && video.output_url ? `${video.output_url}#t=1` : null,
    errorMessage: video.error_message || null,
  };
}

function getVideoStatusBadge(status: VideoProject['status']) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20';
    case 'draft':
      return 'bg-blue-500/15 text-blue-200 border-blue-400/20';
    case 'finalizing':
    case 'rendering':
      return 'bg-violet-500/15 text-violet-200 border-violet-400/20';
    case 'failed':
      return 'bg-red-500/15 text-red-200 border-red-400/20';
    default:
      return 'bg-slate-700/50 text-slate-200 border-slate-500/20';
  }
}

function getVideoStatusLabel(status: VideoProject['status']) {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'draft':
      return 'Draft';
    case 'finalizing':
      return 'Finalizing';
    case 'rendering':
      return 'Rendering';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

export default function CustomVideoPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [videos, setVideos] = useState<VideoProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedVideoToPlay, setSelectedVideoToPlay] = useState<VideoProject | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<VideoProject | null>(null);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  const loadVideos = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const response = await customVideosApi.list(1, 100);
      const nextVideos = response.items
        .map(mapCustomVideoToProject)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      setVideos(nextVideos);
    } catch (error) {
      console.error('Failed to load custom videos:', error);
      alert(getApiErrorMessage(error, 'Failed to load custom videos.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    const hasModalOpen = selectedVideoToPlay || showCreateModal || videoToDelete;
    
    if (hasModalOpen) {
      // Store the current overflow value before changing it
      const currentOverflow = document.body.style.overflow || '';
      document.body.style.overflow = 'hidden';
      
      // Return cleanup function that restores the original overflow
      return () => {
        document.body.style.overflow = currentOverflow;
      };
    }
    
    // No modal open, ensure overflow is not hidden
    document.body.style.overflow = '';
    
    return () => {
      // Cleanup: ensure we don't leave overflow hidden
      document.body.style.overflow = '';
    };
  }, [selectedVideoToPlay, showCreateModal, videoToDelete]);

  const stats = useMemo(() => {
    return {
      total: videos.length,
      completed: videos.filter((video) => video.status === 'completed').length,
      drafts: videos.filter((video) => video.status === 'draft').length,
      failed: videos.filter((video) => video.status === 'failed').length,
    };
  }, [videos]);

  const handleCreateNewVideo = async (ratio: 'landscape' | 'portrait') => {
    setCreating(true);

    try {
      const draft = await customVideosApi.start({
        video_type: ratio,
        title: 'Custom Video Draft',
        background_music_mood: 'none',
      });

      rememberCustomVideoId(draft.id);
      setShowCreateModal(false);
      router.push(`/dashboard/custom_video/${draft.id}/create`);
    } catch (error) {
      console.error('Failed to start custom video draft:', error);
      alert(getApiErrorMessage(error, 'Failed to start custom video draft.'));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteVideo = async () => {
    if (!videoToDelete) {
      return;
    }

    setDeletingVideoId(videoToDelete.id);

    try {
      await customVideosApi.delete(videoToDelete.id);
      removeStoredCustomVideoId(videoToDelete.id);
      setVideos((currentVideos) => currentVideos.filter((video) => video.id !== videoToDelete.id));

      if (selectedVideoToPlay?.id === videoToDelete.id) {
        setSelectedVideoToPlay(null);
      }

      setVideoToDelete(null);
    } catch (error) {
      console.error('Failed to delete custom video:', error);
      alert(getApiErrorMessage(error, 'Failed to delete custom video.'));
    } finally {
      setDeletingVideoId(null);
    }
  };

  return (
    <DashboardLayout>
      <ConfirmDialog
        open={!!videoToDelete}
        title="Delete custom video?"
        description={
          videoToDelete
            ? `"${videoToDelete.title}" will be permanently deleted.`
            : ''
        }
        confirmLabel="Delete Video"
        loading={deletingVideoId === videoToDelete?.id}
        onClose={() => {
          if (!deletingVideoId) {
            setVideoToDelete(null);
          }
        }}
        onConfirm={() => {
          void handleDeleteVideo();
        }}
      />

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!creating) {
              setShowCreateModal(false);
            }
          }}
        >
          <Card
            className="w-full max-w-3xl overflow-hidden border-slate-700/70 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-slate-700/50 p-6">
              <h2 className="text-2xl font-semibold text-white">Create New Video</h2>
              <p className="mt-2 text-sm text-slate-400">Choose the aspect ratio to start a backend draft.</p>
              <button
                type="button"
                onClick={() => {
                  if (!creating) {
                    setShowCreateModal(false);
                  }
                }}
                className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Close create video modal"
                disabled={creating}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  void handleCreateNewVideo('landscape');
                }}
                disabled={creating}
                className="group rounded-2xl border border-slate-700 bg-slate-950 p-6 text-left transition-all hover:border-violet-500 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="mb-5 flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-900">
                  <MonitorPlay className="h-10 w-10 text-slate-300 transition-colors group-hover:text-violet-300" />
                </div>
                <h3 className="text-xl font-semibold text-white">Landscape</h3>
                <p className="mt-2 text-sm text-slate-400">Best for desktop and 16:9 videos.</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleCreateNewVideo('portrait');
                }}
                disabled={creating}
                className="group rounded-2xl border border-slate-700 bg-slate-950 p-6 text-left transition-all hover:border-violet-500 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="mb-5 flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-900">
                  <Smartphone className="h-10 w-10 text-slate-300 transition-colors group-hover:text-violet-300" />
                </div>
                <h3 className="text-xl font-semibold text-white">Portrait</h3>
                <p className="mt-2 text-sm text-slate-400">Best for shorts, reels, and 9:16 exports.</p>
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedVideoToPlay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setSelectedVideoToPlay(null)}
        >
          <Card
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden border-slate-700/70 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-slate-700/50 p-6">
              <h2 className="text-2xl font-semibold text-white">{selectedVideoToPlay.title}</h2>
              <button
                type="button"
                onClick={() => setSelectedVideoToPlay(null)}
                className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Close video player"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <CardContent className="space-y-5 p-6">
              {selectedVideoToPlay.outputUrl ? (
                <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                  <video
                    ref={videoRef}
                    src={selectedVideoToPlay.outputUrl || undefined}
                    className="h-full w-full object-contain"
                    controls
                    autoPlay
                  />
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-400">
                  Final video preview is not available yet.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</p>
                  <p className="mt-2 text-sm font-medium text-white">{getVideoStatusLabel(selectedVideoToPlay.status)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Aspect Ratio</p>
                  <p className="mt-2 text-sm font-medium capitalize text-white">{selectedVideoToPlay.videoType}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Duration</p>
                  <p className="mt-2 text-sm font-medium text-white">{formatDuration(selectedVideoToPlay.durationSeconds)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Updated</p>
                  <p className="mt-2 text-sm font-medium text-white">{formatDateTime(selectedVideoToPlay.updatedAt)}</p>
                </div>
              </div>

              {selectedVideoToPlay.errorMessage && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {selectedVideoToPlay.errorMessage}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Link
                  href={
                    selectedVideoToPlay.status === 'completed'
                      ? `/dashboard/custom_video/${selectedVideoToPlay.id}/edit`
                      : `/dashboard/custom_video/${selectedVideoToPlay.id}/create`
                  }
                >
                  <Button variant="secondary">
                    <Edit className="h-4 w-4" />
                    {selectedVideoToPlay.status === 'completed' ? 'Edit Video' : 'Open Editor'}
                  </Button>
                </Link>
                <a href={selectedVideoToPlay.outputUrl || '#'} download={selectedVideoToPlay.title}>
                  <Button variant="outline" disabled={!selectedVideoToPlay.outputUrl}>
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </a>
                <Button
                  variant="danger"
                  onClick={() => {
                    setSelectedVideoToPlay(null);
                    setVideoToDelete(selectedVideoToPlay);
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

      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-violet-200">
            Video Projects
            <span className="rounded-full bg-white/10 px-2 py-0.5 tracking-normal text-white">{stats.total}</span>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">Your custom video drafts</h1>
          <p className="max-w-2xl text-slate-400">
            Start a new video, continue editing drafts, and monitor completed renders from the custom videos API.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              void loadVideos('refresh');
            }}
            loading={refreshing}
            disabled={loading || refreshing}
          >
            <RefreshCw className="h-5 w-5" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-5 w-5" />
            Create New Video
          </Button>
        </div>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">
                <Film className="h-3.5 w-3.5" />
                Total Projects
              </span>
              <p className="mt-3 text-2xl font-semibold text-white">{stats.total}</p>
            </div>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-slate-200">
              <Video className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-200">
                <PlayCircle className="h-3.5 w-3.5" />
                Completed
              </span>
              <p className="mt-3 text-2xl font-semibold text-emerald-300">{stats.completed}</p>
            </div>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-200">
              <PlayCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/12 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-blue-200">
                <Edit className="h-3.5 w-3.5" />
                Drafts
              </span>
              <p className="mt-3 text-2xl font-semibold text-blue-300">{stats.drafts}</p>
            </div>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-200">
              <Edit className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-red-500/12 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-red-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                Failed
              </span>
              <p className="mt-3 text-2xl font-semibold text-red-300">{stats.failed}</p>
            </div>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-red-500/12 text-red-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : videos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-800">
              <Video className="h-10 w-10 text-slate-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-white">No custom video drafts yet</h3>
            <p className="mb-6 max-w-xl text-center text-slate-400">
              Start your first draft from this page. Once created, it will appear here and can be reopened through the custom videos API.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-5 w-5" />
              Create New Video
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((video) => (
            <Card
              key={video.id}
              hover
              className="group relative overflow-hidden border-slate-700/70 bg-slate-900 shadow-xl transition-all duration-300 ease-in-out hover:scale-[1.02] cursor-pointer"
              onClick={() => {
                if (video.outputUrl) {
                  setSelectedVideoToPlay(video);
                }
              }}
            >
              {/* Delete button positioned at top right */}
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setVideoToDelete(video);
                }}
                className="absolute top-3 right-3 z-10 rounded-lg bg-black/60 p-2 text-slate-400 transition-all duration-200 hover:bg-red-600/80 hover:text-white"
                aria-label={`Delete ${video.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <div className="relative overflow-hidden bg-slate-950">
                <div className="flex aspect-[16/9] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.25),_transparent_55%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,1))]">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        // Fallback to placeholder if thumbnail fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  
                  {/* Fallback placeholder - shown when no thumbnail or thumbnail fails */}
                  <div 
                    className={`flex items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-900/70 ${video.thumbnailUrl ? 'hidden' : ''}`}
                    style={video.thumbnailUrl ? { display: 'none' } : {}}
                  >
                    {video.videoType === 'landscape' ? (
                      <MonitorPlay className="h-10 w-10 text-slate-300" />
                    ) : (
                      <Smartphone className="h-10 w-10 text-slate-300" />
                    )}
                  </div>
                </div>

                {video.outputUrl && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <PlayCircle className="h-16 w-16 text-white/90" />
                  </div>
                )}

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium">
                    <Clock className="h-3 w-3" />
                    {formatDuration(video.durationSeconds)}
                  </span>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getVideoStatusBadge(video.status)}`}>
                    {getVideoStatusLabel(video.status)}
                  </span>
                </div>
              </div>

              <CardContent className="flex flex-col gap-4 p-5">
                <div>
                  <h3 className="truncate text-base font-semibold leading-6 text-white" title={video.title}>
                    {video.title}
                  </h3>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>Updated: {formatDateTime(video.updatedAt)}</span>
                  </div>
                  {video.status === 'rendering' && (
                    <p className="mt-2 text-xs text-violet-300">Render progress: {video.progress}%</p>
                  )}
                  {video.status === 'finalizing' && (
                    <p className="mt-2 text-xs text-violet-300">Finalizing: {video.progress}%</p>
                  )}
                  {video.errorMessage && (
                    <p className="mt-2 line-clamp-2 text-xs text-red-300">{video.errorMessage}</p>
                  )}
                </div>

                <div className="mt-auto flex flex-wrap gap-2">
                  {video.status === 'completed' ? (
                    <Link href={`/dashboard/custom_video/${video.id}/edit`} className="min-w-0">
                      <Button 
                        size="sm" 
                        className="min-w-0 whitespace-nowrap"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                    </Link>
                  ) : (
                    <Link href={`/dashboard/custom_video/${video.id}/create`} className="min-w-0">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="min-w-0 whitespace-nowrap"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Edit className="h-4 w-4" />
                        {video.status === 'draft' ? 'Continue' : 'Open'}
                      </Button>
                    </Link>
                  )}

                  <a
                    href={video.outputUrl || '#'}
                    download={video.title}
                    className="min-w-0"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Button variant="outline" className="min-w-0 whitespace-nowrap" size="sm" disabled={!video.outputUrl}>
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
