'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Sparkles,
  Image as ImageIcon,
  Video as VideoIcon,
  X,
  Plus,
  Trash2,
  Download,
  Loader2,
  FileText,
  PlayCircle,
  Clock,
  Video,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input'; // Assuming Input component still exists

// --- Asset Data Types ---
interface BaseAsset {
  id: string;
  title: string;
  type: 'image' | 'video';
  source: 'uploaded' | 'ai_generated';
  created_at: string;
}

interface ImageAsset extends BaseAsset {
  type: 'image';
  url: string; // URL for the image
  prompt?: string; // Only for AI-generated images
}

interface VideoAsset extends BaseAsset {
  type: 'video';
  url: string; // URL for the video
  thumbnailUrl: string; // Thumbnail for video preview
  duration_seconds: number;
  prompt?: string; // Only for AI-generated videos
}

type Asset = ImageAsset | VideoAsset;

// --- Dummy Data ---
const dummyAssets: Asset[] = [
  {
    id: 'asset-1',
    title: 'Uploaded Product Shot',
    type: 'image',
    source: 'uploaded',
    url: 'https://via.placeholder.com/400x300?text=Uploaded+Image',
    created_at: '2023-10-28T10:00:00Z',
  },
  {
    id: 'asset-2',
    title: 'AI Cityscape',
    type: 'image',
    source: 'ai_generated',
    url: 'https://via.placeholder.com/400x300?text=AI+Cityscape',
    prompt: 'A futuristic cityscape at sunset with flying cars',
    created_at: '2023-10-27T15:30:00Z',
  },
  {
    id: 'asset-3',
    title: 'Uploaded Explainer Video',
    type: 'video',
    source: 'uploaded',
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    thumbnailUrl: 'https://via.placeholder.com/400x225?text=Explainer+Video+Thumb',
    duration_seconds: 120,
    created_at: '2023-10-26T09:00:00Z',
  },
  {
    id: 'asset-4',
    title: 'AI Abstract Animation',
    type: 'video',
    source: 'ai_generated',
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    thumbnailUrl: 'https://via.placeholder.com/400x225?text=AI+Video+Thumb',
    duration_seconds: 60,
    prompt: 'Short abstract animation with glowing particles',
    created_at: '2023-10-25T11:45:00Z',
  },
  {
    id: 'asset-5',
    title: 'Uploaded Selfie',
    type: 'image',
    source: 'uploaded',
    url: 'https://via.placeholder.com/400x300?text=User+Selfie',
    created_at: '2023-10-24T18:00:00Z',
  },
];

// --- Helper Functions ---
function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
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
  const [aiContentType, setAiContentType] = useState<'image' | 'video'>('image');
  const [generatingAI, setGeneratingAI] = useState(false);

  // Video Player Modal State
  const [showVideoPlayerModal, setShowVideoPlayerModal] = useState<VideoAsset | null>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  // --- Effects ---
  useEffect(() => {
    // Simulate API call to load assets
    const fetchAssets = async () => {
      setLoadingAssets(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setAssets(dummyAssets);
      setLoadingAssets(false);
    };
    void fetchAssets();
  }, []);

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
    if (showUploadModal || showAICreateModal || showVideoPlayerModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = previousOverflow;
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showUploadModal, showAICreateModal, showVideoPlayerModal]);

  // --- Handlers ---
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Clear previous preview
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }

      // Basic validation
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        alert('Please select an image or video file.');
        setSelectedFile(null);
        setFilePreviewUrl(null);
        return;
      }

      setSelectedFile(file);
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
      setFilePreviewUrl(null);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate upload
      const newAsset: Asset = {
        id: `uploaded-${Date.now()}`,
        title: selectedFile.name.split('.')[0] || 'Untitled Asset',
        type: selectedFile.type.startsWith('image/') ? 'image' : 'video',
        source: 'uploaded',
        url: filePreviewUrl!, // Use the preview URL as the final URL for dummy data
        created_at: new Date().toISOString(),
        ...(selectedFile.type.startsWith('video/') && {
          thumbnailUrl: 'https://via.placeholder.com/400x225?text=Video+Thumb', // Placeholder for video thumbnail
          duration_seconds: 30, // Dummy duration
        }),
      };
      setAssets((prev) => [newAsset, ...prev]);
      setShowUploadModal(false);
      setSelectedFile(null);
      setFilePreviewUrl(null);
      alert('File uploaded successfully!');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleAICreateSubmit = async () => {
    if (!aiPrompt.trim()) return;

    setGeneratingAI(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2500)); // Simulate AI generation
      const newAsset: Asset = {
        id: `ai-${aiContentType}-${Date.now()}`,
        title: `AI Generated ${aiContentType === 'image' ? 'Image' : 'Video'}`,
        type: aiContentType,
        source: 'ai_generated',
        url:
          aiContentType === 'image'
            ? `https://via.placeholder.com/400x300?text=AI+${aiContentType}+Generated`
            : 'https://www.w3schools.com/html/mov_bbb.mp4',
        created_at: new Date().toISOString(),
        prompt: aiPrompt,
        ...(aiContentType === 'video' && {
          thumbnailUrl: `https://via.placeholder.com/400x225?text=AI+${aiContentType}+Thumb`,
          duration_seconds: 45, // Dummy duration
        }),
      };
      setAssets((prev) => [newAsset, ...prev]);
      setShowAICreateModal(false);
      setAiPrompt('');
      setAiContentType('image');
      alert('AI content generated successfully!');
    } catch (error) {
      console.error('AI generation failed:', error);
      alert('AI generation failed. Please try again.');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleDeleteAsset = async () => {
    if (!assetToDelete) return;

    setDeletingAssetId(assetToDelete.id);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate deletion
      setAssets((prev) => prev.filter((asset) => asset.id !== assetToDelete.id));

      // Close video player if the deleted asset was playing
      if (showVideoPlayerModal?.id === assetToDelete.id) {
        setShowVideoPlayerModal(null);
      }
      setAssetToDelete(null);
      alert('Asset deleted successfully!');
    } catch (error) {
      console.error('Failed to delete asset:', error);
      alert('Failed to delete asset. Please try again.');
    } finally {
      setDeletingAssetId(null);
    }
  };

  const toggleVideoPlayPause = () => {
    if (videoPlayerRef.current) {
      if (isPlayingVideo) {
        videoPlayerRef.current.pause();
      } else {
        videoPlayerRef.current.play();
      }
      setIsPlayingVideo(!isPlayingVideo);
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
                accept="image/*,video/*"
                onChange={handleFileSelect}
              />

              {!selectedFile && (
                <div
                  className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-700 rounded-lg text-center cursor-pointer hover:border-violet-500 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-12 w-12 text-slate-500 mb-4" />
                  <p className="text-white font-medium mb-2">Drag & Drop or Click to Browse</p>
                  <p className="text-sm text-slate-400">Image (JPG, PNG, GIF) or Video (MP4, MOV)</p>
                </div>
              )}

              {selectedFile && filePreviewUrl && (
                <div className="space-y-4">
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center">
                    {selectedFile.type.startsWith('image/') ? (
                      <img src={filePreviewUrl} alt="File preview" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <video src={filePreviewUrl} controls className="max-h-full max-w-full object-contain" />
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
          onClick={() => {
            if (!generatingAI) {
              setShowAICreateModal(false);
              setAiPrompt('');
            }
          }}
        >
          <Card
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">AI Generate Asset</h2>
                <button
                  type="button"
                  onClick={() => {
                    if (!generatingAI) {
                      setShowAICreateModal(false);
                      setAiPrompt('');
                    }
                  }}
                  className="rounded-full border border-white/10 bg-slate-800/50 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                  aria-label="Close AI create modal"
                  disabled={generatingAI}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="ai-content-type" className="mb-2 block text-sm font-medium text-slate-300">Content Type</label>
                  <div className="relative">
                    <select
                      id="ai-content-type"
                      value={aiContentType}
                      onChange={(e) => setAiContentType(e.target.value as 'image' | 'video')}
                      disabled={generatingAI}
                      className="block w-full appearance-none rounded-md border border-slate-700 bg-slate-800 py-2 pl-3 pr-10 text-base text-white placeholder-slate-500 focus:border-violet-500 focus:ring-violet-500 sm:text-sm"
                    >
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="ai-prompt" className="mb-2 block text-sm font-medium text-slate-300">Describe what you want to create</label>
                  <textarea
                    id="ai-prompt"
                    placeholder={`e.g., A majestic dragon flying over a snowy mountain at dawn (for an ${aiContentType})`}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    disabled={generatingAI}
                    rows={4}
                    className="block w-full rounded-md border border-slate-700 bg-slate-800 p-3 text-base text-white placeholder-slate-500 shadow-sm focus:border-violet-500 focus:ring-violet-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button variant="ghost" onClick={() => {
                  if (!generatingAI) {
                    setShowAICreateModal(false);
                    setAiPrompt('');
                  }
                }} className="flex-1" disabled={generatingAI}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAICreateSubmit}
                  loading={generatingAI}
                  disabled={!aiPrompt.trim() || generatingAI}
                  className="flex-1"
                >
                  {generatingAI ? 'Generating...' : `Generate ${aiContentType === 'image' ? 'Image' : 'Video'}`}
                </Button>
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
              {showVideoPlayerModal.prompt && (
                <p className="mt-1 text-sm text-slate-400 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Prompt: "{showVideoPlayerModal.prompt}"
                </p>
              )}
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
                  src={showVideoPlayerModal.url}
                  poster={showVideoPlayerModal.thumbnailUrl}
                  className="w-full h-full object-contain"
                  onPlay={() => setIsPlayingVideo(true)}
                  onPause={() => setIsPlayingVideo(false)}
                  onEnded={() => setIsPlayingVideo(false)}
                  controls // Add native controls for full functionality within modal
                />
              </div>

              <div className="flex flex-wrap gap-3 mt-4">
                <a href={showVideoPlayerModal.url} download>
                  <Button variant="outline">
                    <Download className="h-4 w-4" />
                    Download Original
                  </Button>
                </a>
                <Button
                  variant="destructive"
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


      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-violet-200">
            Your Assets
            <span className="rounded-full bg-white/10 px-2 py-0.5 tracking-normal text-white">{assets.length}</span>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">Manage your creative assets</h1>
          <p className="max-w-2xl text-slate-400">
            Upload your images and videos, or generate new ones using AI. All your media in one place.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
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
              <p className="mt-3 text-2xl font-semibold text-white">{assets.length}</p>
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
                Images
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
                Videos
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
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-500/12 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-violet-200">
                <Sparkles className="h-3.5 w-3.5" />
                AI Generated
              </span>
              <p className="mt-3 text-2xl font-semibold text-violet-300">{assets.filter(a => a.source === 'ai_generated').length}</p>
            </div>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-200">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>


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
            <h3 className="mb-2 text-xl font-semibold text-white">No assets yet</h3>
            <p className="mb-6 text-slate-400">Upload your own images and videos, or generate stunning new ones with AI.</p>
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
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => (
            <Card
              key={asset.id}
              hover
              className="group relative cursor-pointer overflow-hidden border-slate-700/70 bg-slate-900 shadow-xl transition-all duration-300 ease-in-out hover:scale-[1.02]"
            >
              <div
                className="relative w-full pt-[75%] overflow-hidden" // 4:3 aspect ratio for images, adjusted for videos
                onClick={() => {
                  if (asset.type === 'video') {
                    setShowVideoPlayerModal(asset as VideoAsset);
                  }
                  // For images, you might want to open a lightbox or full-size view
                }}
              >
                {asset.type === 'image' ? (
                  <img
                    src={asset.url}
                    alt={asset.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <>
                    <img
                      src={(asset as VideoAsset).thumbnailUrl || asset.url} // Use thumbnailUrl if available
                      alt={asset.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <PlayCircle className="h-16 w-16 text-white/90" />
                    </div>
                  </>
                )}
                <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                  {asset.type === 'image' ? (
                    <ImageIcon className="h-3 w-3" />
                  ) : (
                    <VideoIcon className="h-3 w-3" />
                  )}
                  {asset.type === 'image' ? 'Image' : 'Video'}
                </div>
                {asset.type === 'video' && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                    <Clock className="h-3 w-3" />
                    {formatDuration((asset as VideoAsset).duration_seconds)}
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

                <div className="mt-auto flex gap-2">
                  {asset.type === 'video' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => { e.stopPropagation(); setShowVideoPlayerModal(asset as VideoAsset); }}
                    >
                      <PlayCircle className="h-4 w-4" />
                      Preview
                    </Button>
                  ) : (
                    <a href={asset.url} target="_blank" rel="noopener noreferrer" className="flex-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="secondary" size="sm" className="w-full">
                        <ImageIcon className="h-4 w-4" />
                        View Image
                      </Button>
                    </a>
                  )}
                  <a
                    href={asset.url}
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
      )}
    </DashboardLayout>
  );
}