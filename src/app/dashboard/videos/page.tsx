'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Clock,
  HardDrive,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { VideoThumbnail } from '@/components/media/VideoThumbnail';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { sourceVideosApi, uploadsApi } from '@/lib/api';
import { MultipartListPart, SourceVideo, UploadItem } from '@/types';

const LARGE_UPLOAD_THRESHOLD_BYTES = 100 * 1024 * 1024;
const MULTIPART_PART_SIZE_BYTES = 5 * 1024 * 1024;
const MULTIPART_MAX_RETRIES = 4;
const MULTIPART_CONCURRENCY = 6;

type UploadMode = 'direct' | 'multipart' | null;

interface MultipartUploadSession {
  file: File | null;
  key: string | null;
  uploadId: string | null;
  partSize: number;
  totalParts: number;
  nextPart: number;
  completed: MultipartListPart[];
  paused: boolean;
  aborting: boolean;
  controllers: Map<number, AbortController>;
  uploadedBytes: number;
  perPart: Map<number, number>;
}

function createMultipartSession(): MultipartUploadSession {
  return {
    file: null,
    key: null,
    uploadId: null,
    partSize: MULTIPART_PART_SIZE_BYTES,
    totalParts: 0,
    nextPart: 1,
    completed: [],
    paused: false,
    aborting: false,
    controllers: new Map(),
    uploadedBytes: 0,
    perPart: new Map(),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getErrorMessage(error: unknown) {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Something went wrong during upload.';
}

export default function VideosPage() {
  const [videos, setVideos] = useState<SourceVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMode, setUploadMode] = useState<UploadMode>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [multipartPaused, setMultipartPaused] = useState(false);
  const [lastUpload, setLastUpload] = useState<UploadItem | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<SourceVideo | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadStateRef = useRef<MultipartUploadSession>(createMultipartSession());

  const loadVideos = async () => {
    try {
      const data = await sourceVideosApi.list(1, 100);
      setVideos(data.items);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  useEffect(() => {
    if (!previewVideo) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewVideo(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewVideo]);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const finishUpload = () => {
    setUploading(false);
    setUploadMode(null);
    setMultipartPaused(false);
    uploadStateRef.current = createMultipartSession();
    resetFileInput();
  };

  const abortMultipartUpload = async (reason = 'User cancelled') => {
    const session = uploadStateRef.current;
    if (session.aborting || !session.uploadId || !session.key) return;

    session.aborting = true;
    session.controllers.forEach((controller) => controller.abort());
    setMultipartPaused(false);
    setUploadStatus(`Aborting upload... (${reason})`);

    try {
      await uploadsApi.abortMultipart(session.key, session.uploadId);
    } catch (error) {
      console.error('Failed to abort multipart upload:', error);
    } finally {
      setUploadStatus('Multipart upload aborted.');
    }
  };

  const collectMultipartParts = async (
    key: string,
    uploadId: string,
    expectedCount: number
  ): Promise<MultipartListPart[]> => {
    const session = uploadStateRef.current;
    if (session.completed.length === expectedCount) {
      return [...session.completed].sort((a, b) => a.PartNumber - b.PartNumber);
    }

    while (!session.aborting) {
      const data = await uploadsApi.listMultipartParts(key, uploadId);
      const listed = (data.parts || []).map((part) => ({
        PartNumber: part.PartNumber,
        ETag: part.ETag.replaceAll('"', ''),
      }));

      if (listed.length === expectedCount) {
        return listed.sort((a, b) => a.PartNumber - b.PartNumber);
      }

      await sleep(1000);
    }

    throw new Error('Multipart upload was aborted.');
  };

  const uploadMultipartPart = async (partNumber: number, blob: Blob) => {
    const session = uploadStateRef.current;
    if (!session.file || !session.key || !session.uploadId) {
      throw new Error('Multipart upload is not initialized.');
    }

    const { url } = await uploadsApi.getMultipartPartUrl(
      session.key,
      session.uploadId,
      partNumber,
      session.file.type || 'application/octet-stream'
    );

    let attempt = 0;
    while (true) {
      attempt += 1;

      if (session.aborting) {
        throw new Error('Aborted');
      }

      const controller = new AbortController();
      session.controllers.set(partNumber, controller);

      try {
        const put = await fetch(url, {
          method: 'PUT',
          body: blob,
          signal: controller.signal,
        });

        if (!put.ok) {
          throw new Error(`PUT ${put.status}`);
        }

        const etag = put.headers.get('ETag');
        if (etag) {
          session.completed.push({
            PartNumber: partNumber,
            ETag: etag.replaceAll('"', ''),
          });
        }

        session.perPart.set(partNumber, blob.size);
        session.uploadedBytes = [...session.perPart.values()].reduce((sum, size) => sum + size, 0);
        setUploadProgress(Math.round((session.uploadedBytes / session.file.size) * 100));
        return;
      } catch (error) {
        if (attempt > MULTIPART_MAX_RETRIES) {
          throw error;
        }

        await sleep(400 * Math.pow(2, attempt));
      } finally {
        session.controllers.delete(partNumber);
      }
    }
  };

  const multipartWorker = async () => {
    while (true) {
      const session = uploadStateRef.current;

      if (session.aborting) return;
      if (session.paused) {
        await sleep(200);
        continue;
      }
      if (!session.file) return;

      const partNumber = session.nextPart;
      session.nextPart += 1;

      if (partNumber > session.totalParts) return;

      const start = (partNumber - 1) * session.partSize;
      const end = Math.min(start + session.partSize, session.file.size);
      const chunk = session.file.slice(start, end);

      try {
        await uploadMultipartPart(partNumber, chunk);
      } catch (error) {
        await abortMultipartUpload(`Part ${partNumber} failed: ${getErrorMessage(error)}`);
        return;
      }
    }
  };

  const startDirectUpload = async (file: File) => {
    setUploading(true);
    setUploadMode('direct');
    setUploadProgress(0);
    setUploadStatus(`Uploading "${file.name}" with direct upload...`);
    setLastUpload(null);

    try {
      const result = await uploadsApi.directUpload(file, setUploadProgress);
      setLastUpload(result);
      setUploadProgress(100);
      setUploadStatus('Direct upload complete. Refreshing source videos...');
      await loadVideos();
      setUploadStatus(`Direct upload complete: ${result.title}`);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error('Failed to upload with direct upload:', error);
      setUploadStatus(`Upload failed: ${message}`);
      alert(`Upload failed. ${message}`);
    } finally {
      finishUpload();
    }
  };

  const startMultipartUpload = async (file: File) => {
    const session = createMultipartSession();
    session.file = file;
    session.totalParts = Math.ceil(file.size / session.partSize);
    uploadStateRef.current = session;

    setUploading(true);
    setUploadMode('multipart');
    setUploadProgress(0);
    setUploadStatus(`1/3: Initializing multipart upload for "${file.name}"...`);
    setMultipartPaused(false);
    setLastUpload(null);

    try {
      const { key, upload_id } = await uploadsApi.startMultipart(
        file.name,
        file.type || 'application/octet-stream',
        file.size
      );
      session.key = key;
      session.uploadId = upload_id;

      setUploadStatus('2/3: Uploading parts...');
      const workers = Array.from({ length: MULTIPART_CONCURRENCY }, () => multipartWorker());
      await Promise.all(workers);

      if (session.aborting || !session.key || !session.uploadId) {
        return;
      }

      setUploadStatus('3/3: Finalizing upload...');
      const parts = await collectMultipartParts(session.key, session.uploadId, session.totalParts);
      const result = await uploadsApi.completeMultipart(session.key, session.uploadId, parts);

      setLastUpload(result);
      setUploadProgress(100);
      setUploadStatus('Multipart upload complete. Refreshing source videos...');
      await loadVideos();
      setUploadStatus(`Multipart upload complete: ${result.title}`);
    } catch (error) {
      if (!session.aborting) {
        const message = getErrorMessage(error);
        console.error('Failed to upload with multipart upload:', error);
        setUploadStatus(`Multipart upload failed: ${message}`);
        alert(`Multipart upload failed. ${message}`);
      }
    } finally {
      finishUpload();
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || uploading) return;

    const file = files[0];
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      resetFileInput();
      return;
    }

    if (file.size > LARGE_UPLOAD_THRESHOLD_BYTES) {
      await startMultipartUpload(file);
      return;
    }

    await startDirectUpload(file);
  };

  const pauseMultipartUpload = () => {
    uploadStateRef.current.paused = true;
    setMultipartPaused(true);
    setUploadStatus('Multipart upload paused.');
  };

  const resumeMultipartUpload = () => {
    uploadStateRef.current.paused = false;
    setMultipartPaused(false);
    setUploadStatus('2/3: Uploading parts...');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;
    try {
      await sourceVideosApi.delete(id);
      setVideos(videos.filter((video) => video.id !== id));
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Source Videos</h1>
          <p className="text-slate-400">Upload and manage your source videos</p>
        </div>
      </div>

      <Card className="mb-8">
        <CardContent className="p-0">
          <div
            className={`
              relative border-2 border-dashed rounded-xl p-12
              transition-all duration-200 cursor-pointer
              ${dragOver ? 'border-violet-500 bg-violet-500/10' : 'border-slate-700 hover:border-slate-600'}
              ${uploading ? 'pointer-events-none opacity-90' : ''}
            `}
            onDragOver={(e) => {
              e.preventDefault();
              if (!uploading) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              if (uploading) return;
              setDragOver(false);
              void handleUpload(e.dataTransfer.files);
            }}
            onClick={() => {
              if (!uploading) fileInputRef.current?.click();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                void handleUpload(e.target.files);
              }}
            />

            <div className="flex flex-col items-center text-center">
              {uploading ? (
                <>
                  <Loader2 className="w-12 h-12 text-violet-500 animate-spin mb-4" />
                  <p className="text-white font-medium mb-2">
                    {uploadMode === 'multipart' ? 'Uploading with multipart...' : 'Uploading with direct upload...'}
                  </p>
                  <p className="text-slate-400 text-sm mb-4">{uploadStatus}</p>
                  <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-slate-500 text-sm mt-2">{uploadProgress}%</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/20 flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8 text-violet-500" />
                  </div>
                  <p className="text-white font-medium mb-1">
                    Drop your video here or click to browse
                  </p>
                  <p className="text-slate-500 text-sm">
                    Supports MP4, MOV, WebM up to 2GB
                  </p>
                  <p className="text-slate-500 text-sm mt-1">
                    Files larger than {Math.round(LARGE_UPLOAD_THRESHOLD_BYTES / (1024 * 1024))} MB automatically use multipart upload.
                  </p>
                </>
              )}
            </div>
          </div>

          {(uploading || uploadStatus || lastUpload) && (
            <div className="border-t border-slate-800 px-6 py-5">
              {uploadMode === 'multipart' && uploading && (
                <div className="flex flex-wrap gap-3 mb-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={pauseMultipartUpload}
                    disabled={multipartPaused}
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={resumeMultipartUpload}
                    disabled={!multipartPaused}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Resume
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void abortMultipartUpload();
                    }}
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                </div>
              )}

              {uploadStatus && (
                <p className="text-sm text-slate-300">{uploadStatus}</p>
              )}

            </div>
          )}
        </CardContent>
      </Card>

      {previewVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
          onClick={() => setPreviewVideo(null)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4 lg:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
                  Video Preview
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">{previewVideo.title}</h2>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                  {previewVideo.duration_ms && (
                    <span>{formatDuration(previewVideo.duration_ms)}</span>
                  )}
                  {previewVideo.width && previewVideo.height && (
                    <span>{previewVideo.width}x{previewVideo.height}</span>
                  )}
                  {previewVideo.file_size_bytes && (
                    <span>{formatSize(previewVideo.file_size_bytes)}</span>
                  )}
                  <span>{new Date(previewVideo.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <Button variant="ghost" size="sm" onClick={() => setPreviewVideo(null)}>
                <X className="w-4 h-4" />
                Close
              </Button>
            </div>

            <div className="p-4 lg:p-6">
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black">
                <video
                  key={previewVideo.id}
                  src={previewVideo.video_url}
                  poster={previewVideo.thumbnail_url || undefined}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-[72vh] bg-black"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      ) : videos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <Video className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No videos yet</h3>
            <p className="text-slate-400">Upload your first video to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <Card key={video.id} hover className="group overflow-hidden">
              <div className="aspect-video bg-slate-800 relative overflow-hidden">
                <VideoThumbnail
                  videoUrl={video.video_url}
                  thumbnailUrl={video.thumbnail_url}
                  title={video.title}
                  className="w-full h-full object-cover"
                  fallbackIconClassName="w-12 h-12 text-slate-600"
                />

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    onClick={() => setPreviewVideo(video)}
                    className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    aria-label={`Preview ${video.title}`}
                  >
                    <Play className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={() => handleDelete(video.id)}
                    className="p-3 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors"
                  >
                    <Trash2 className="w-6 h-6 text-red-400" />
                  </button>
                </div>

                {video.duration_ms && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium">
                    {formatDuration(video.duration_ms)}
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                <h3 className="font-medium text-white truncate mb-2">{video.title}</h3>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  {video.width && video.height && (
                    <span>{video.width}×{video.height}</span>
                  )}
                  {video.file_size_bytes && (
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      {formatSize(video.file_size_bytes)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(video.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
