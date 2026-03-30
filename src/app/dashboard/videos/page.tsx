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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
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
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [selectedUploadPreviewUrl, setSelectedUploadPreviewUrl] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<SourceVideo | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<SourceVideo | null>(null);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadStateRef = useRef<MultipartUploadSession>(createMultipartSession());
  const uploadPreviewUrlRef = useRef<string | null>(null);

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
    return () => {
      if (uploadPreviewUrlRef.current) {
        URL.revokeObjectURL(uploadPreviewUrlRef.current);
      }
    };
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

  useEffect(() => {
    if (!uploadModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !uploading) {
        if (uploadPreviewUrlRef.current) {
          URL.revokeObjectURL(uploadPreviewUrlRef.current);
          uploadPreviewUrlRef.current = null;
        }

        setUploadModalOpen(false);
        setSelectedUploadFile(null);
        setSelectedUploadPreviewUrl(null);
        setDragOver(false);
        resetFileInput();
        setUploadStatus('');
        setUploadProgress(0);
        setUploadMode(null);
        setMultipartPaused(false);
        setLastUpload(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [uploadModalOpen, uploading]);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateSelectedUploadFile = (file: File | null) => {
    if (uploadPreviewUrlRef.current) {
      URL.revokeObjectURL(uploadPreviewUrlRef.current);
      uploadPreviewUrlRef.current = null;
    }

    if (!file) {
      setSelectedUploadFile(null);
      setSelectedUploadPreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    uploadPreviewUrlRef.current = previewUrl;
    setSelectedUploadFile(file);
    setSelectedUploadPreviewUrl(previewUrl);
  };

  const clearSelectedUpload = () => {
    updateSelectedUploadFile(null);
    setDragOver(false);
    resetFileInput();
  };

  const closeUploadModal = () => {
    if (uploading) return;

    setUploadModalOpen(false);
    clearSelectedUpload();
    setUploadStatus('');
    setUploadProgress(0);
    setUploadMode(null);
    setMultipartPaused(false);
    setLastUpload(null);
  };

  const openUploadModal = () => {
    setUploadModalOpen(true);
  };

  const finishUpload = () => {
    setUploading(false);
    setUploadMode(null);
    setMultipartPaused(false);
    uploadStateRef.current = createMultipartSession();
    resetFileInput();
  };

  const finalizeSuccessfulUpload = async (statusMessage: string) => {
    await loadVideos();
    finishUpload();
    closeUploadModal();
    setLastUpload(null);
    setUploadStatus('');
    setUploadProgress(0);
    setUploadMode(null);
    setMultipartPaused(false);
    return statusMessage;
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
      await finalizeSuccessfulUpload(`Direct upload complete: ${result.title}`);
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
      await finalizeSuccessfulUpload(`Multipart upload complete: ${result.title}`);
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

  const prepareUpload = (files: FileList | null) => {
    if (!files || files.length === 0 || uploading) return;

    const file = files[0];
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      resetFileInput();
      return;
    }

    updateSelectedUploadFile(file);
    setUploadStatus('');
    setUploadProgress(0);
    setUploadMode(null);
    setMultipartPaused(false);
    setLastUpload(null);
    setUploadModalOpen(true);
    setDragOver(false);
    resetFileInput();
  };

  const handleUpload = async () => {
    if (!selectedUploadFile || uploading) return;

    if (selectedUploadFile.size > LARGE_UPLOAD_THRESHOLD_BYTES) {
      await startMultipartUpload(selectedUploadFile);
      return;
    }

    await startDirectUpload(selectedUploadFile);
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

  const handleDelete = async () => {
    if (!videoToDelete) return;

    setDeletingVideoId(videoToDelete.id);

    try {
      await sourceVideosApi.delete(videoToDelete.id);
      setVideos((currentVideos) => currentVideos.filter((video) => video.id !== videoToDelete.id));
      if (previewVideo?.id === videoToDelete.id) {
        setPreviewVideo(null);
      }
      setVideoToDelete(null);
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setDeletingVideoId(null);
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

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

  return (
    <DashboardLayout>
      <ConfirmDialog
        open={!!videoToDelete}
        title="Delete video?"
        description={
          videoToDelete
            ? `"${videoToDelete.title}" will be permanently removed from your source videos.`
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
          void handleDelete();
        }}
      />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Source Videos</h1>
          <p className="text-slate-400">Upload and manage your source videos</p>
        </div>
        <Button onClick={openUploadModal}>
          <Upload className="w-5 h-5" />
          Upload Video
        </Button>
      </div>

      {uploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md"
          onClick={() => {
            if (!uploading) {
              closeUploadModal();
            }
          }}
        >
          <div
            className="w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4 lg:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
                  Upload Video
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">Review your file before uploading</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Drag a video here or browse from your device, preview it, then start the upload when you are ready.
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={closeUploadModal}
                disabled={uploading}
              >
                <X className="w-4 h-4" />
                Close
              </Button>
            </div>

            <div className="grid gap-6 p-4 lg:grid-cols-[0.95fr_1.35fr] lg:p-6">
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    prepareUpload(e.target.files);
                  }}
                />

                <div
                  className={`
                    relative rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200
                    ${dragOver ? 'border-violet-500 bg-violet-500/10' : 'border-slate-700 hover:border-slate-600'}
                    ${uploading ? 'pointer-events-none opacity-90' : 'cursor-pointer'}
                  `}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!uploading) setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (uploading) return;
                    prepareUpload(e.dataTransfer.files);
                  }}
                  onClick={() => {
                    if (!uploading) fileInputRef.current?.click();
                  }}
                >
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/20">
                    {uploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                    ) : (
                      <Upload className="h-8 w-8 text-violet-500" />
                    )}
                  </div>

                  <p className="text-white font-medium mb-1">
                    {selectedUploadFile ? selectedUploadFile.name : 'Drop your video here or click to browse'}
                  </p>
                  <p className="text-slate-500 text-sm">
                    Supports MP4, MOV, WebM up to 2GB
                  </p>
                  <p className="text-slate-500 text-sm mt-1">
                    Files larger than {Math.round(LARGE_UPLOAD_THRESHOLD_BYTES / (1024 * 1024))} MB automatically use multipart upload.
                  </p>
                </div>

                {selectedUploadFile && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                      <span className="font-medium text-white">{selectedUploadFile.name}</span>
                      <span>{formatSize(selectedUploadFile.size)}</span>
                      <span>{selectedUploadFile.type || 'video/*'}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        onClick={() => {
                          void handleUpload();
                        }}
                        loading={uploading}
                        disabled={!selectedUploadFile}
                      >
                        <Upload className="w-4 h-4" />
                        {uploading ? 'Uploading...' : 'Start Upload'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        <RotateCcw className="w-4 h-4" />
                        Choose Another
                      </Button>
                    </div>
                  </div>
                )}

                {(uploading || uploadStatus || lastUpload) && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    {uploadMode === 'multipart' && uploading && (
                      <div className="mb-4 flex flex-wrap gap-3">
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

                    {(uploading || uploadProgress > 0) && (
                      <>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="mt-2 text-sm text-slate-500">{uploadProgress}%</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950/40 p-4 lg:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Video Preview
                </p>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-black">
                  {selectedUploadPreviewUrl ? (
                    <video
                      key={selectedUploadPreviewUrl}
                      src={selectedUploadPreviewUrl}
                      controls
                      playsInline
                      className="w-full max-h-[70vh] bg-black"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-slate-900 text-slate-500">
                      Select a video to preview it before upload
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <p className="text-slate-400 mb-6">Upload your first video to get started</p>
            <Button onClick={openUploadModal}>
              <Upload className="w-5 h-5" />
              Upload Video
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <Card key={video.id} hover className="overflow-hidden">
              <div className="aspect-video bg-slate-800 relative overflow-hidden">
                <VideoThumbnail
                  videoUrl={video.video_url}
                  thumbnailUrl={video.thumbnail_url}
                  title={video.title}
                  className="w-full h-full object-cover"
                  fallbackIconClassName="w-12 h-12 text-slate-600"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-slate-950/10" />

                <button
                  onClick={() => setPreviewVideo(video)}
                  className="absolute inset-0 flex items-center justify-center"
                  aria-label={`Preview ${video.title}`}
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-slate-950/70 text-white shadow-2xl shadow-black/40 transition-transform duration-200 hover:scale-105">
                    <Play className="ml-1 h-7 w-7" />
                  </span>
                </button>

                {video.duration_ms && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium">
                    {formatDuration(video.duration_ms)}
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                <h3 className="font-medium text-white truncate mb-2">{video.title}</h3>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
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
                      {formatDateTime(video.created_at)}
                    </span>
                  </div>

                  <button
                    onClick={() => setVideoToDelete(video)}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-900 hover:text-red-400"
                    aria-label={`Delete ${video.title}`}
                  >
                    <Trash2 className="w-5 h-5" />
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
