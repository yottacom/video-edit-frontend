'use client';

import { useEffect, useState, useRef } from 'react';
import { Upload, Video, Trash2, Loader2, Play, Clock, HardDrive, X } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { sourceVideosApi } from '@/lib/api';
import { SourceVideo } from '@/types';

export default function VideosPage() {
  const [videos, setVideos] = useState<SourceVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    
    try {
      const video = await sourceVideosApi.upload(file, file.name, (progress) => {
        setUploadProgress(progress);
      });
      setVideos([video, ...videos]);
    } catch (error) {
      console.error('Failed to upload:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;
    try {
      await sourceVideosApi.delete(id);
      setVideos(videos.filter(v => v.id !== id));
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Source Videos</h1>
          <p className="text-slate-400">Upload and manage your source videos</p>
        </div>
      </div>

      {/* Upload Zone */}
      <Card className="mb-8">
        <CardContent className="p-0">
          <div
            className={`
              relative border-2 border-dashed rounded-xl p-12
              transition-all duration-200 cursor-pointer
              ${dragOver 
                ? 'border-violet-500 bg-violet-500/10' 
                : 'border-slate-700 hover:border-slate-600'}
            `}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { 
              e.preventDefault(); 
              setDragOver(false); 
              handleUpload(e.dataTransfer.files); 
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            
            <div className="flex flex-col items-center text-center">
              {uploading ? (
                <>
                  <Loader2 className="w-12 h-12 text-violet-500 animate-spin mb-4" />
                  <p className="text-white font-medium mb-2">Uploading... {uploadProgress}%</p>
                  <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
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
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Videos Grid */}
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
              {/* Thumbnail */}
              <div className="aspect-video bg-slate-800 relative overflow-hidden">
                {video.thumbnail_url ? (
                  <img 
                    src={video.thumbnail_url} 
                    alt={video.title} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-12 h-12 text-slate-600" />
                  </div>
                )}
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <a 
                    href={video.video_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    <Play className="w-6 h-6 text-white" />
                  </a>
                  <button 
                    onClick={() => handleDelete(video.id)}
                    className="p-3 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors"
                  >
                    <Trash2 className="w-6 h-6 text-red-400" />
                  </button>
                </div>
                
                {/* Duration Badge */}
                {video.duration_ms && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium">
                    {formatDuration(video.duration_ms)}
                  </div>
                )}
              </div>
              
              {/* Info */}
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
