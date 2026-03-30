'use client';

import { useEffect, useMemo, useState } from 'react';
import { Play } from 'lucide-react';

interface VideoThumbnailProps {
  videoUrl: string | null | undefined;
  thumbnailUrl?: string | null;
  title: string;
  className?: string;
  fallbackIconClassName?: string;
}

export function VideoThumbnail({
  videoUrl,
  thumbnailUrl,
  title,
  className = '',
  fallbackIconClassName = 'w-10 h-10 text-slate-600',
}: VideoThumbnailProps) {
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);
  }, [thumbnailUrl, videoUrl]);

  const previewUrl = useMemo(() => {
    if (!videoUrl) return null;
    return videoUrl.includes('#') ? videoUrl : `${videoUrl}#t=1`;
  }, [videoUrl]);

  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt={title}
        className={className}
      />
    );
  }

  if (previewUrl && !previewFailed) {
    return (
      <video
        src={previewUrl}
        muted
        playsInline
        preload="metadata"
        className={className}
        onError={() => setPreviewFailed(true)}
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <Play className={fallbackIconClassName} />
    </div>
  );
}
