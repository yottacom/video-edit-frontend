'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, ArrowRight, Video, Type, Music, Scissors, 
  Sparkles, Check, Loader2, Play 
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { sourceVideosApi, musicTracksApi, projectsApi, subtitleStylesApi } from '@/lib/api';
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
                          {video.thumbnail_url ? (
                            <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                          ) : (
                            <Play className="w-10 h-10 text-slate-600" />
                          )}
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
            <h3 className="text-lg font-semibold text-white">Project Summary</h3>
            
            <div className="grid gap-4">
              <Card>
                <CardContent className="p-4 flex justify-between">
                  <span className="text-slate-400">Title</span>
                  <span className="text-white font-medium">{projectTitle || 'Untitled Project'}</span>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 flex justify-between">
                  <span className="text-slate-400">Source Video</span>
                  <span className="text-white font-medium">{selectedVideoData?.title}</span>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 flex justify-between">
                  <span className="text-slate-400">Subtitle Style</span>
                  <span className="text-white font-medium capitalize">{subtitleStyle}</span>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 flex justify-between">
                  <span className="text-slate-400">B-Roll</span>
                  <span className={addBroll ? 'text-green-400' : 'text-slate-500'}>
                    {addBroll ? `Enabled${brollSfx ? ' + SFX' : ''}` : 'Disabled'}
                  </span>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 flex justify-between">
                  <span className="text-slate-400">Music</span>
                  <span className="text-white font-medium">
                    {selectedMusicData?.title || 'None'}
                  </span>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 flex justify-between">
                  <span className="text-slate-400">Shorts</span>
                  <span className={generateShorts ? 'text-cyan-400' : 'text-slate-500'}>
                    {generateShorts ? `${shortsCount} clips` : 'Disabled'}
                  </span>
                </CardContent>
              </Card>
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
