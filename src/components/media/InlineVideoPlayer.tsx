'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { VideoThumbnail } from '@/components/media/VideoThumbnail';

interface InlineVideoPlayerProps {
  videoUrl: string | null | undefined;
  thumbnailUrl?: string | null;
  title: string;
  className?: string;
}

export function InlineVideoPlayer({
  videoUrl,
  thumbnailUrl,
  title,
  className = '',
}: InlineVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isPlaying || !videoRef.current) return;

    videoRef.current.play().catch((error) => {
      console.error('Inline player autoplay failed:', error);
    });
  }, [isPlaying]);

  if (!videoUrl) {
    return (
      <div className={`relative aspect-video overflow-hidden rounded-2xl bg-slate-800 ${className}`}>
        <div className="flex h-full items-center justify-center text-slate-500">
          Preview unavailable
        </div>
      </div>
    );
  }

  return (
    <div className={`relative aspect-video overflow-hidden rounded-2xl bg-slate-950 ${className}`}>
      {isPlaying ? (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={thumbnailUrl || undefined}
          controls
          playsInline
          preload="metadata"
          className="h-full w-full bg-black"
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsPlaying(true)}
          className="group relative block h-full w-full focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          aria-label={`Play ${title}`}
        >
          <VideoThumbnail
            videoUrl={videoUrl}
            thumbnailUrl={thumbnailUrl}
            title={title}
            className="h-full w-full object-cover"
            fallbackIconClassName="h-12 w-12 text-white/70"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-slate-950/10 transition-opacity duration-200 group-hover:opacity-90" />

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-slate-950/75 text-white shadow-2xl shadow-black/40 transition-transform duration-200 group-hover:scale-105">
              <Play className="ml-1 h-7 w-7" />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-4 text-left">
            <p className="truncate text-sm font-medium text-white/95">{title}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-white/60">Click to play</p>
          </div>
        </button>
      )}
    </div>
  );
}
