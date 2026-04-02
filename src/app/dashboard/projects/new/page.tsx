'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, ArrowRight, Video, Type, Music, Scissors,
  Sparkles, Check, Loader2, FileText, AudioLines, Tag
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { InlineVideoPlayer } from '@/components/media/InlineVideoPlayer';
import { VideoThumbnail } from '@/components/media/VideoThumbnail';
import { SubtitleConfigEditor } from '@/components/projects/SubtitleConfigEditor';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { sourceVideosApi, musicTracksApi, projectsApi, subtitleStylesApi } from '@/lib/api';
import {
  buildProjectSubtitleConfigOverride,
  DEFAULT_PROJECT_SUBTITLE_CONFIG,
  ProjectSubtitleConfig,
  SubtitleConfigMode,
} from '@/lib/project-editing';
import { SourceVideo, MusicTrack, SubtitleStyle } from '@/types';

type Step = 'video' | 'subtitles' | 'broll' | 'music' | 'shorts' | 'review';

const steps: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: 'video', label: 'Source Video', icon: Video },
  { id: 'subtitles', label: 'Subtitles', icon: Type },
  { id: 'broll', label: 'B-Roll', icon: Sparkles },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'shorts', label: 'Shorts', icon: Scissors },
  { id: 'review', label: 'Review', icon: Check },
];

function formatDuration(ms: number | null) {
  if (!ms) return 'Unknown';

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('video');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Data
  const [videos, setVideos] = useState<SourceVideo[]>([]);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [subtitleStyles, setSubtitleStyles] = useState<SubtitleStyle[]>([]);
  
  // Form State
  const [projectTitle, setProjectTitle] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<string>('');
  const [subtitleStyle, setSubtitleStyle] = useState('mrbeast');
  const [subtitleConfigMode, setSubtitleConfigMode] = useState<SubtitleConfigMode>('default');
  const [subtitleConfig, setSubtitleConfig] = useState<ProjectSubtitleConfig>(
    DEFAULT_PROJECT_SUBTITLE_CONFIG
  );
  const [addBroll, setAddBroll] = useState(false);
  const [brollSfx, setBrollSfx] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<string>('');
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [generateShorts, setGenerateShorts] = useState(false);
  const [shortsCount, setShortsCount] = useState(3);
  
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [videosRes, musicRes, stylesRes] = await Promise.all([
          sourceVideosApi.list(1, 100),
          musicTracksApi.list(),
          subtitleStylesApi.list(),
        ]);
        setVideos(videosRes.items);
        setMusicTracks(musicRes.items);
        setSubtitleStyles(stylesRes.styles);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  
  const goNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  };
  
  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const project = await projectsApi.create(
        projectTitle || 'Untitled Project',
        selectedVideo,
        {
          add_broll: addBroll,
          broll_sfx: brollSfx,
          music_track_id: selectedMusic || null,
          music_volume: musicVolume,
          subtitle_style: subtitleStyle,
          subtitle_config_override: buildProjectSubtitleConfigOverride(
            subtitleConfigMode,
            subtitleConfig
          ),
          generate_shorts: generateShorts,
          shorts_count: shortsCount,
        }
      );
      
      // Start processing
      await projectsApi.process(project.id);
      
      router.push('/dashboard/projects');
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setCreating(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'video': return !!selectedVideo;
      case 'subtitles': return !!subtitleStyle;
      default: return true;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'video':
        return (
          <div className="space-y-6">
            <Input
              label="Project Title"
              placeholder="My Awesome Video"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
            />
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Select Source Video
              </label>
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                </div>
              ) : videos.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <p className="text-slate-400 mb-4">No videos uploaded yet</p>
                    <Button variant="secondary" onClick={() => router.push('/dashboard/videos')}>
                      Upload Video
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {videos.map((video) => (
                    <Card
                      key={video.id}
                      hover
                      className={`cursor-pointer transition-all ${
                        selectedVideo === video.id 
                          ? 'ring-2 ring-violet-500 border-violet-500' 
                          : ''
                      }`}
                      onClick={() => setSelectedVideo(video.id)}
                    >
                      <CardContent className="p-4">
                        <div className="aspect-video bg-slate-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                          <VideoThumbnail
                            videoUrl={video.video_url}
                            thumbnailUrl={video.thumbnail_url}
                            title={video.title}
                            className="w-full h-full object-cover"
                            fallbackIconClassName="w-10 h-10 text-slate-600"
                          />
                        </div>
                        <p className="font-medium text-white truncate">{video.title}</p>
                        {video.duration_ms && (
                          <p className="text-sm text-slate-500">
                            {Math.floor(video.duration_ms / 60000)}:{String(Math.floor((video.duration_ms % 60000) / 1000)).padStart(2, '0')}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
        
      case 'subtitles':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Choose Subtitle Style
              </label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {subtitleStyles.map((style) => (
                  <Card
                    key={style.id}
                    hover
                    className={`cursor-pointer transition-all ${
                      subtitleStyle === style.id 
                        ? 'ring-2 ring-violet-500 border-violet-500' 
                        : ''
                    }`}
                    onClick={() => setSubtitleStyle(style.id)}
                  >
                    <CardContent className="p-4 text-center">
                      <div className="h-16 bg-slate-800 rounded-lg mb-3 flex items-center justify-center">
                        <span className="text-lg font-bold text-white">{style.name}</span>
                      </div>
                      <p className="text-xs text-slate-400">{style.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Card>
              <CardContent className="p-6">
                <SubtitleConfigEditor
                  mode={subtitleConfigMode}
                  value={subtitleConfig}
                  onModeChange={setSubtitleConfigMode}
                  onChange={setSubtitleConfig}
                />
              </CardContent>
            </Card>
          </div>
        );
        
      case 'broll':
        return (
          <div className="space-y-6">
            <Card className={`cursor-pointer transition-all ${addBroll ? 'ring-2 ring-violet-500' : ''}`}>
              <CardContent className="p-6">
                <label className="flex items-center gap-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addBroll}
                    onChange={(e) => setAddBroll(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-600 text-violet-600 focus:ring-violet-500"
                  />
                  <div>
                    <p className="font-medium text-white">Enable AI B-Roll</p>
                    <p className="text-sm text-slate-400">AI will identify key moments and add relevant visuals</p>
                  </div>
                </label>
              </CardContent>
            </Card>
            
            {addBroll && (
              <Card>
                <CardContent className="p-6">
                  <label className="flex items-center gap-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={brollSfx}
                      onChange={(e) => setBrollSfx(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-600 text-violet-600 focus:ring-violet-500"
                    />
                    <div>
                      <p className="font-medium text-white">Add Sound Effects</p>
                      <p className="text-sm text-slate-400">Generate matching audio for B-roll clips</p>
                    </div>
                  </label>
                </CardContent>
              </Card>
            )}
          </div>
        );
        
      case 'music':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Background Music (Optional)
              </label>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card
                  hover
                  className={`cursor-pointer ${!selectedMusic ? 'ring-2 ring-violet-500' : ''}`}
                  onClick={() => setSelectedMusic('')}
                >
                  <CardContent className="p-4 text-center">
                    <p className="font-medium text-white">No Music</p>
                  </CardContent>
                </Card>
                
                {musicTracks.map((track) => (
                  <Card
                    key={track.id}
                    hover
                    className={`cursor-pointer ${selectedMusic === track.id ? 'ring-2 ring-violet-500' : ''}`}
                    onClick={() => setSelectedMusic(track.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Music className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{track.title}</p>
                          <p className="text-xs text-slate-400">{track.mood || track.track_type}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            
            {selectedMusic && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Music Volume: {Math.round(musicVolume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            )}
          </div>
        );
        
      case 'shorts':
        return (
          <div className="space-y-6">
            <Card className={`cursor-pointer transition-all ${generateShorts ? 'ring-2 ring-violet-500' : ''}`}>
              <CardContent className="p-6">
                <label className="flex items-center gap-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateShorts}
                    onChange={(e) => setGenerateShorts(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-600 text-violet-600 focus:ring-violet-500"
                  />
                  <div>
                    <p className="font-medium text-white">Generate Shorts</p>
                    <p className="text-sm text-slate-400">AI will extract viral-worthy clips for TikTok/YouTube Shorts</p>
                  </div>
                </label>
              </CardContent>
            </Card>
            
            {generateShorts && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Number of Shorts: {shortsCount}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={shortsCount}
                  onChange={(e) => setShortsCount(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            )}
          </div>
        );
        
      case 'review':
        const selectedVideoData = videos.find(v => v.id === selectedVideo);
        const selectedMusicData = musicTracks.find(t => t.id === selectedMusic);
        
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
                <Check className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Project Summary</h3>
                <p className="text-sm text-slate-400">Review your media and project settings before creating the job.</p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-violet-300">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Project Title</p>
                        <h4 className="text-lg font-semibold text-white">{projectTitle || 'Untitled Project'}</h4>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-cyan-300">
                        <Video className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Source Video</p>
                        <h4 className="text-lg font-semibold text-white">{selectedVideoData?.title || 'No video selected'}</h4>
                      </div>
                    </div>

                    {selectedVideoData && (
                      <>
                        <InlineVideoPlayer
                          key={selectedVideoData.id}
                          videoUrl={selectedVideoData.video_url}
                          thumbnailUrl={selectedVideoData.thumbnail_url}
                          title={selectedVideoData.title}
                        />
                        <div className="mt-4 flex flex-wrap gap-2">
                          {selectedVideoData.duration_ms && (
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                              {formatDuration(selectedVideoData.duration_ms)}
                            </span>
                          )}
                          {selectedVideoData.width && selectedVideoData.height && (
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                              {selectedVideoData.width}x{selectedVideoData.height}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-emerald-300">
                        <AudioLines className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Music Preview</p>
                        <h4 className="text-lg font-semibold text-white">{selectedMusicData?.title || 'No music selected'}</h4>
                      </div>
                    </div>

                    {selectedMusicData ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                        <audio controls preload="metadata" src={selectedMusicData.audio_url} className="w-full" />
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                            {selectedMusicData.track_type}
                          </span>
                          {selectedMusicData.duration_ms && (
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                              {formatDuration(selectedMusicData.duration_ms)}
                            </span>
                          )}
                          {selectedMusicData.mood && (
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs capitalize text-slate-300">
                              {selectedMusicData.mood}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-5 text-sm text-slate-500">
                        No background music will be attached to this project.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-amber-300">
                        <Tag className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Configuration Tags</p>
                        <h4 className="text-lg font-semibold text-white">Processing Setup</h4>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-violet-500/15 px-3 py-1.5 text-sm text-violet-200">
                        <Type className="h-4 w-4" />
                        {subtitleStyle}
                      </span>
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${
                          subtitleConfigMode === 'custom'
                            ? 'bg-fuchsia-500/15 text-fuchsia-200'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <Type className="h-4 w-4" />
                        {subtitleConfigMode === 'custom' ? 'Custom subtitle config' : 'Default subtitle config'}
                      </span>
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${addBroll ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>
                        <Sparkles className="h-4 w-4" />
                        {addBroll ? 'B-Roll enabled' : 'B-Roll disabled'}
                      </span>
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${brollSfx ? 'bg-fuchsia-500/15 text-fuchsia-200' : 'bg-slate-800 text-slate-400'}`}>
                        <Sparkles className="h-4 w-4" />
                        {brollSfx ? 'SFX on' : 'SFX off'}
                      </span>
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${selectedMusicData ? 'bg-cyan-500/15 text-cyan-200' : 'bg-slate-800 text-slate-400'}`}>
                        <Music className="h-4 w-4" />
                        {selectedMusicData ? 'Music selected' : 'No music'}
                      </span>
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${generateShorts ? 'bg-orange-500/15 text-orange-200' : 'bg-slate-800 text-slate-400'}`}>
                        <Scissors className="h-4 w-4" />
                        {generateShorts ? `${shortsCount} shorts` : 'Shorts disabled'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Type className="h-4 w-4 text-violet-300" />
                          <span className="text-sm text-slate-400">Subtitle Style</span>
                        </div>
                        <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-200">
                          {subtitleStyle}
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Type className="h-4 w-4 text-fuchsia-300" />
                          <span className="text-sm text-slate-400">Subtitle Config</span>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            subtitleConfigMode === 'custom'
                              ? 'bg-fuchsia-500/15 text-fuchsia-200'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {subtitleConfigMode === 'custom' ? 'Custom override' : 'Default'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Sparkles className="h-4 w-4 text-emerald-300" />
                          <span className="text-sm text-slate-400">B-Roll</span>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${addBroll ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>
                          {addBroll ? `Enabled${brollSfx ? ' + SFX' : ''}` : 'Disabled'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Music className="h-4 w-4 text-cyan-300" />
                          <span className="text-sm text-slate-400">Music</span>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${selectedMusicData ? 'bg-cyan-500/15 text-cyan-200' : 'bg-slate-800 text-slate-400'}`}>
                          {selectedMusicData ? selectedMusicData.title : 'None'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Scissors className="h-4 w-4 text-orange-300" />
                          <span className="text-sm text-slate-400">Shorts</span>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${generateShorts ? 'bg-orange-500/15 text-orange-200' : 'bg-slate-800 text-slate-400'}`}>
                          {generateShorts ? `${shortsCount} clips` : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        );
    }
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
        <div>
          <h1 className="text-2xl font-bold text-white">New Project</h1>
          <p className="text-slate-400">Configure your video editing settings</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = index < currentStepIndex;
          
          return (
            <div key={step.id} className="flex items-center gap-2">
              <button
                onClick={() => index <= currentStepIndex && setCurrentStep(step.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap
                  transition-all duration-200
                  ${isActive 
                    ? 'bg-violet-600 text-white' 
                    : isCompleted 
                      ? 'bg-slate-800 text-violet-400 hover:bg-slate-700' 
                      : 'bg-slate-800/50 text-slate-500'}
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{step.label}</span>
              </button>
              {index < steps.length - 1 && (
                <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card className="mb-8">
        <CardContent className="p-8">
          {renderStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button 
          variant="ghost" 
          onClick={goBack}
          disabled={currentStepIndex === 0}
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </Button>
        
        {currentStep === 'review' ? (
          <Button onClick={handleCreate} loading={creating}>
            <Sparkles className="w-5 h-5" />
            Create & Process
          </Button>
        ) : (
          <Button onClick={goNext} disabled={!canProceed()}>
            Next
            <ArrowRight className="w-5 h-5" />
          </Button>
        )}
      </div>
    </DashboardLayout>
  );
}
