'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Plus,
  Video,
  Loader2,
  Edit,
  Trash2,
  Share2,
  Download,
  CalendarDays,
  Film,
  PlayCircle,
  Clock,
  X,
  Play,
  Pause,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// Dummy Video Data Type
interface VideoProject {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string; // Added video URL for playback
  lastEdited: string;
  duration_seconds: number;
  status: 'draft' | 'rendered' | 'failed';
}

// Dummy Data
const dummyVideos: VideoProject[] = [
  {
    id: '12345',
    title: 'My First Epic Travel Vlog',
    thumbnailUrl: 'https://via.placeholder.com/400x225?text=Travel+Vlog+Thumbnail',
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', // Sample video URL
    lastEdited: '2023-10-26T10:00:00Z',
    duration_seconds: 185,
    status: 'rendered',
  },
  {
    id: '67890',
    title: 'Product Demo - New Feature Showcase',
    thumbnailUrl: 'https://via.placeholder.com/400x225?text=Product+Demo+Thumbnail',
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', // Sample video URL
    lastEdited: '2023-10-25T14:30:00Z',
    duration_seconds: 92,
    status: 'rendered',
  },
  {
    id: '11223',
    title: 'Unboxing Gadget Review',
    thumbnailUrl: 'https://via.placeholder.com/400x225?text=Unboxing+Thumbnail',
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', // Sample video URL
    lastEdited: '2023-10-24T09:15:00Z',
    duration_seconds: 240,
    status: 'draft',
  },
  {
    id: '44556',
    title: 'AI Generated Explainer Video Draft',
    thumbnailUrl: 'https://via.placeholder.com/400x225?text=Explainer+Video+Thumbnail',
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', // Sample video URL
    lastEdited: '2023-10-23T17:00:00Z',
    duration_seconds: 120,
    status: 'draft',
  },
  {
    id: '77889',
    title: 'Marketing Campaign Ad - Version 2',
    thumbnailUrl: 'https://via.placeholder.com/400x225?text=Marketing+Ad+Thumbnail',
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', // Sample video URL
    lastEdited: '2023-10-22T11:00:00Z',
    duration_seconds: 45,
    status: 'rendered',
  },
  {
    id: '99001',
    title: 'Failed Render - Try Again',
    thumbnailUrl: 'https://via.placeholder.com/400x225?text=Failed+Render',
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', // Sample video URL
    lastEdited: '2023-10-21T18:00:00Z',
    duration_seconds: 60,
    status: 'failed',
  },
];

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

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoToDelete, setVideoToDelete] = useState<VideoProject | null>(null);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [selectedVideoToPlay, setSelectedVideoToPlay] = useState<VideoProject | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Simulate API call
    const fetchVideos = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate network delay
      setVideos(dummyVideos);
      setLoading(false);
    };

    void fetchVideos();
  }, []);

  useEffect(() => {
    // Handle body overflow when modal is open
    const previousOverflow = document.body.style.overflow;
    if (selectedVideoToPlay) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = previousOverflow;
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedVideoToPlay]);

  const handleDeleteVideo = async () => {
    if (!videoToDelete) return;

    setDeletingVideoId(videoToDelete.id);
    try {
      // Simulate API call for deletion
      await new Promise((resolve) => setTimeout(resolve, 500));
      setVideos((currentVideos) => currentVideos.filter((video) => video.id !== videoToDelete.id));

      if (selectedVideoToPlay?.id === videoToDelete.id) {
        setSelectedVideoToPlay(null);
      }
      setVideoToDelete(null);
    } catch (error) {
      console.error('Failed to delete video:', error);
      alert('Failed to delete video. Please try again.');
    } finally {
      setDeletingVideoId(null);
    }
  };

  const getVideoStatusBadge = (status: VideoProject['status']) => {
    switch (status) {
      case 'rendered':
        return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20';
      case 'draft':
        return 'bg-blue-500/15 text-blue-200 border-blue-400/20';
      case 'failed':
        return 'bg-red-500/15 text-red-200 border-red-400/20';
      default:
        return 'bg-slate-700/50 text-slate-200 border-slate-500/20';
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <DashboardLayout>
      <ConfirmDialog
        open={!!videoToDelete}
        title="Delete video project?"
        description={
          videoToDelete
            ? `"${videoToDelete.title}" will be permanently removed from your video library.`
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

            <CardContent className="flex flex-col items-center justify-center space-y-4 p-6">
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={selectedVideoToPlay.videoUrl}
                  poster={selectedVideoToPlay.thumbnailUrl}
                  className="w-full h-full object-contain"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <button
                      onClick={togglePlayPause}
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-white/30 text-white backdrop-blur-sm transition-transform hover:scale-105"
                      aria-label="Play video"
                    >
                      <Play className="ml-1 h-10 w-10" />
                    </button>
                  </div>
                )}
                {isPlaying && (
                  <div className="absolute bottom-4 right-4 z-10">
                    <button
                      onClick={togglePlayPause}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/30 text-white backdrop-blur-sm transition-transform hover:scale-105"
                      aria-label="Pause video"
                    >
                      <Pause className="h-6 w-6" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3 mt-4">
                <Button onClick={togglePlayPause}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
                <a href={selectedVideoToPlay.videoUrl} download>
                  <Button variant="outline">
                    <Download className="h-4 w-4" />
                    Download Original
                  </Button>
                </a>
                <Link href={`http://localhost:3000/dashboard/custom_video/${selectedVideoToPlay.id}/edit`} passHref>
                  <Button variant="secondary">
                    <Edit className="h-4 w-4" />
                    Edit Project
                  </Button>
                </Link>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setSelectedVideoToPlay(null); // Close player before showing delete dialog
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
            <span className="rounded-full bg-white/10 px-2 py-0.5 tracking-normal text-white">{videos.length}</span>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">Your created video projects</h1>
          <p className="max-w-2xl text-slate-400">
            Manage your video projects created with our editor. Preview, edit, download, or share your masterpieces.
          </p>
        </div>

        <Link href="http://localhost:3000/dashboard/custom_video/123123/create" passHref>
          <Button>
            <Plus className="h-5 w-5" />
            Create New Video
          </Button>
        </Link>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Placeholder cards for quick stats */}
        <Card className="overflow-hidden">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">
                <Film className="h-3.5 w-3.5" />
                Total Projects
              </span>
              <p className="mt-3 text-2xl font-semibold text-white">{videos.length}</p>
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
                Rendered Videos
              </span>
              <p className="mt-3 text-2xl font-semibold text-emerald-300">
                {videos.filter((v) => v.status === 'rendered').length}
              </p>
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
              <p className="mt-3 text-2xl font-semibold text-blue-300">
                {videos.filter((v) => v.status === 'draft').length}
              </p>
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
                <Trash2 className="h-3.5 w-3.5" />
                Failed Renders
              </span>
              <p className="mt-3 text-2xl font-semibold text-red-300">
                {videos.filter((v) => v.status === 'failed').length}
              </p>
            </div>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-red-500/12 text-red-200">
              <Trash2 className="h-5 w-5" />
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
            <h3 className="mb-2 text-xl font-semibold text-white">No video projects yet</h3>
            <p className="mb-6 text-slate-400">Start creating amazing videos with our editor!</p>
            <Link href="http://localhost:3000/dashboard/custom_video/123123/create" passHref>
              <Button>
                <Plus className="h-5 w-5" />
                Create New Video
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((video) => (
            <Card
              key={video.id}
              hover
              className="group relative cursor-pointer overflow-hidden border-slate-700/70 bg-slate-900 shadow-xl transition-all duration-300 ease-in-out hover:scale-[1.02]"
            >
              <div
                className="relative w-full overflow-hidden pt-[56.25%]" // 16:9 Aspect Ratio
                onClick={(e) => {
                  e.stopPropagation(); // Prevent card click from opening edit page
                  setSelectedVideoToPlay(video);
                }}
              >
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <PlayCircle className="h-16 w-16 text-white/90" />
                </div>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium">
                    <Clock className="h-3 w-3" />
                    {formatDuration(video.duration_seconds)}
                  </span>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getVideoStatusBadge(video.status)}`}>
                    {video.status === 'rendered' ? 'Rendered' : video.status === 'draft' ? 'Draft' : 'Failed'}
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
                    <span>Last edited: {formatDateTime(video.lastEdited)}</span>
                  </div>
                </div>

                <div className="mt-auto flex gap-2">
                  <Link href={`http://localhost:3000/dashboard/custom_video/${video.id}/edit`} passHref className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                  </Link>

                  <a
                    href={video.videoUrl}
                    download
                    className="flex-1"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Button variant="outline" className="w-full" size="sm">
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </a>

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setVideoToDelete(video);
                    }}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400"
                    aria-label={`Delete ${video.title}`}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}