'use client';

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Download, ExternalLink, 
  Loader2, CheckCircle, XCircle, Clock, Sparkles,
  Video, Music, Type, Scissors, RefreshCw
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { InlineVideoPlayer } from '@/components/media/InlineVideoPlayer';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { projectsApi, sourceVideosApi, musicTracksApi } from '@/lib/api';
import { EditProject, SourceVideo, MusicTrack } from '@/types';

const statusConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  draft: { icon: Clock, color: 'text-slate-400', bgColor: 'bg-slate-500/20', label: 'Draft' },
  pending: { icon: Clock, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: 'Pending' },
  transcribing: { icon: Type, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Transcribing' },
  planning: { icon: Sparkles, color: 'text-purple-400', bgColor: 'bg-purple-500/20', label: 'AI Planning' },
  generating: { icon: Video, color: 'text-orange-400', bgColor: 'bg-orange-500/20', label: 'Generating Assets' },
  rendering: { icon: Loader2, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', label: 'Rendering' },
  completed: { icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Failed' },
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<EditProject | null>(null);
  const [sourceVideo, setSourceVideo] = useState<SourceVideo | null>(null);
  const [musicTrack, setMusicTrack] = useState<MusicTrack | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProject = useCallback(async () => {
    try {
      const data = await projectsApi.get(projectId);
      setProject(data);
      
      // Load related data
      if (data.source_video_id) {
        try {
          const video = await sourceVideosApi.get(data.source_video_id);
          setSourceVideo(video);
        } catch (e) {
          console.error('Failed to load source video:', e);
        }
      }
      
      if (data.config.music_track_id) {
        try {
          const tracks = await musicTracksApi.list();
          const track = tracks.items.find((t: MusicTrack) => t.id === data.config.music_track_id);
          if (track) setMusicTrack(track);
        } catch (e) {
          console.error('Failed to load music track:', e);
        }
      }
      
      return data;
    } catch (error) {
      console.error('Failed to load project:', error);
      router.push('/dashboard/projects');
      return null;
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  const pollProjectStatus = useEffectEvent(async () => {
    try {
      const data = await projectsApi.poll(projectId);
      setProject((prev) => (prev ? { ...prev, ...data } : null));

      if (['pending', 'transcribing', 'planning', 'generating', 'rendering'].includes(data.status)) {
        pollTimeoutRef.current = setTimeout(() => {
          void pollProjectStatus();
        }, 3000);
      }
    } catch (error) {
      console.error('Poll failed:', error);
    }
  });

  useEffect(() => {
    void loadProject();
    
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [loadProject]);

  // Poll for updates while processing
  const isProjectProcessing = project
    ? ['pending', 'transcribing', 'planning', 'generating', 'rendering'].includes(project.status)
    : false;

  useEffect(() => {
    if (!project) return;

    if (!isProjectProcessing) {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      return;
    }

    pollTimeoutRef.current = setTimeout(() => {
      void pollProjectStatus();
    }, 3000);

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [isProjectProcessing, project]);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      await projectsApi.process(projectId);
      await loadProject();
    } catch (error) {
      console.error('Failed to reprocess:', error);
    } finally {
      setReprocessing(false);
    }
  };

  if (loading || !project) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const status = statusConfig[project.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const isProcessing = ['pending', 'transcribing', 'planning', 'generating', 'rendering'].includes(project.status);
  const formatDuration = (ms: number | null) => {
    if (!ms) return null;

    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => router.push('/dashboard/projects')}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{project.title}</h1>
          <p className="text-slate-400">
            Created {new Date(project.created_at).toLocaleDateString()}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-3">
          {project.status === 'failed' && (
            <Button onClick={handleReprocess} loading={reprocessing}>
              <RefreshCw className="w-5 h-5" />
              Retry
            </Button>
          )}
          {project.status === 'completed' && project.output_url && (
            <>
              <a href={project.output_url} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary">
                  <ExternalLink className="w-5 h-5" />
                  Open
                </Button>
              </a>
              <a href={project.output_url} download>
                <Button>
                  <Download className="w-5 h-5" />
                  Download
                </Button>
              </a>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-xl ${status.bgColor} flex items-center justify-center`}>
                  <StatusIcon className={`w-8 h-8 ${status.color} ${isProcessing ? 'animate-spin' : ''}`} />
                </div>
                <div className="flex-1">
                  <h2 className={`text-xl font-semibold ${status.color}`}>{status.label}</h2>
                  {isProcessing && (
                    <p className="text-slate-400 mt-1">Processing... {project.progress}%</p>
                  )}
                </div>
              </div>
              
              {/* Progress Bar */}
              {isProcessing && (
                <div className="mt-6">
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-500"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm text-slate-500">
                    <span>Progress</span>
                    <span>{project.progress}%</span>
                  </div>
                </div>
              )}
              
              {/* Error Message */}
              {project.status === 'failed' && project.error_message && (
                <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm">{project.error_message}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Output Preview */}
          {project.status === 'completed' && project.output_url && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Output Video</h3>
                <InlineVideoPlayer
                  key={project.output_url}
                  videoUrl={project.output_url}
                  thumbnailUrl={sourceVideo?.thumbnail_url}
                  title={project.title}
                />
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400">
                  <span>{status.label}</span>
                  <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                  {typeof project.progress === 'number' && project.progress > 0 && (
                    <span>{project.progress}% complete</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Source Video */}
          {sourceVideo && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Source Video</h3>
                <InlineVideoPlayer
                  key={sourceVideo.id}
                  videoUrl={sourceVideo.video_url}
                  thumbnailUrl={sourceVideo.thumbnail_url}
                  title={sourceVideo.title}
                />
                <div className="mt-4">
                  <p className="font-medium text-white">{sourceVideo.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                    {formatDuration(sourceVideo.duration_ms) && (
                      <span>{formatDuration(sourceVideo.duration_ms)}</span>
                    )}
                    {sourceVideo.width && sourceVideo.height && (
                      <span>{sourceVideo.width}x{sourceVideo.height}</span>
                    )}
                    <span>{new Date(sourceVideo.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Configuration */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Configuration</h3>
              
              <div className="space-y-4">
                {/* Subtitles */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <Type className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Subtitle Style</p>
                    <p className="font-medium text-white capitalize">{project.config.subtitle_style}</p>
                  </div>
                </div>
                
                {/* B-Roll */}
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    project.config.add_broll ? 'bg-green-500/20' : 'bg-slate-800'
                  }`}>
                    <Sparkles className={`w-5 h-5 ${project.config.add_broll ? 'text-green-400' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">B-Roll</p>
                    <p className="font-medium text-white">
                      {project.config.add_broll 
                        ? `Enabled${project.config.broll_sfx ? ' + SFX' : ''}`
                        : 'Disabled'
                      }
                    </p>
                  </div>
                </div>
                
                {/* Music */}
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    musicTrack ? 'bg-purple-500/20' : 'bg-slate-800'
                  }`}>
                    <Music className={`w-5 h-5 ${musicTrack ? 'text-purple-400' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Music</p>
                    <p className="font-medium text-white">
                      {musicTrack ? musicTrack.title : 'None'}
                    </p>
                    {musicTrack && (
                      <p className="text-xs text-slate-500">
                        Volume: {Math.round(project.config.music_volume * 100)}%
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Shorts */}
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    project.config.generate_shorts ? 'bg-cyan-500/20' : 'bg-slate-800'
                  }`}>
                    <Scissors className={`w-5 h-5 ${project.config.generate_shorts ? 'text-cyan-400' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Shorts</p>
                    <p className="font-medium text-white">
                      {project.config.generate_shorts 
                        ? `${project.config.shorts_count} clips`
                        : 'Disabled'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Activity</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-slate-500" />
                  <span className="text-slate-400">Created</span>
                  <span className="text-slate-500 ml-auto">
                    {new Date(project.created_at).toLocaleString()}
                  </span>
                </div>
                {project.updated_at !== project.created_at && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full ${
                      project.status === 'completed' ? 'bg-green-500' : 
                      project.status === 'failed' ? 'bg-red-500' : 'bg-violet-500'
                    }`} />
                    <span className="text-slate-400">
                      {project.status === 'completed' ? 'Completed' : 
                       project.status === 'failed' ? 'Failed' : 'Updated'}
                    </span>
                    <span className="text-slate-500 ml-auto">
                      {new Date(project.updated_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
