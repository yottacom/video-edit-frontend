'use client';

import { useEffect, useState, useRef } from 'react';
import { Music, Sparkles, Upload, Trash2, Loader2, Play, Pause, Volume2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { musicTracksApi } from '@/lib/api';
import { MusicTrack } from '@/types';

export default function MusicPage() {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [generateMood, setGenerateMood] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTracks = async () => {
    try {
      const data = await musicTracksApi.list();
      setTracks(data.items);
    } catch (error) {
      console.error('Failed to load tracks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracks();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handleGenerate = async () => {
    if (!generatePrompt.trim()) return;
    
    setGenerating(true);
    try {
      const track = await musicTracksApi.generate({
        prompt: generatePrompt,
        mood: generateMood || undefined,
        duration_seconds: 20,
      });
      setTracks([track, ...tracks]);
      setGeneratePrompt('');
      setGenerateMood('');
      setShowGenerate(false);
    } catch (error) {
      console.error('Failed to generate:', error);
      alert('Generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }

    setUploading(true);
    try {
      const track = await musicTracksApi.upload(file, file.name);
      setTracks([track, ...tracks]);
    } catch (error) {
      console.error('Failed to upload:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this track?')) return;
    try {
      await musicTracksApi.delete(id);
      setTracks(tracks.filter(t => t.id !== id));
      if (playingId === id) {
        audioRef.current?.pause();
        setPlayingId(null);
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const togglePlay = (track: MusicTrack) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(track.audio_url);
      audio.play();
      audio.onended = () => setPlayingId(null);
      audioRef.current = audio;
      setPlayingId(track.id);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const moodColors: Record<string, string> = {
    upbeat: 'from-yellow-500 to-orange-500',
    chill: 'from-blue-500 to-cyan-500',
    dramatic: 'from-purple-500 to-pink-500',
    inspirational: 'from-green-500 to-emerald-500',
    default: 'from-violet-500 to-indigo-500',
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Music Library</h1>
          <p className="text-slate-400">Generate AI music or upload your own tracks</p>
        </div>
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button 
            variant="secondary" 
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
          >
            <Upload className="w-5 h-5" />
            Upload
          </Button>
          <Button onClick={() => setShowGenerate(true)}>
            <Sparkles className="w-5 h-5" />
            Generate
          </Button>
        </div>
      </div>

      {/* Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Generate AI Music</h2>
              
              <div className="space-y-4">
                <Input
                  label="Describe the music"
                  placeholder="e.g., Upbeat electronic music for a tech video"
                  value={generatePrompt}
                  onChange={(e) => setGeneratePrompt(e.target.value)}
                />
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Mood</label>
                  <div className="flex flex-wrap gap-2">
                    {['upbeat', 'chill', 'dramatic', 'inspirational', 'energetic'].map((mood) => (
                      <button
                        key={mood}
                        onClick={() => setGenerateMood(mood)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          generateMood === mood
                            ? 'bg-violet-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {mood}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <Button variant="ghost" onClick={() => setShowGenerate(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleGenerate} 
                  loading={generating}
                  disabled={!generatePrompt.trim()}
                  className="flex-1"
                >
                  Generate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tracks List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      ) : tracks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <Music className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No music tracks yet</h3>
            <p className="text-slate-400 mb-6">Generate AI music or upload your own</p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-5 h-5" />
                Upload
              </Button>
              <Button onClick={() => setShowGenerate(true)}>
                <Sparkles className="w-5 h-5" />
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tracks.map((track) => {
            const gradientClass = moodColors[track.mood || 'default'] || moodColors.default;
            const isPlaying = playingId === track.id;
            
            return (
              <Card key={track.id} hover>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Play Button */}
                    <button
                      onClick={() => togglePlay(track)}
                      className={`
                        w-14 h-14 rounded-xl flex items-center justify-center
                        bg-gradient-to-br ${gradientClass}
                        hover:scale-105 transition-transform
                      `}
                    >
                      {isPlaying ? (
                        <Pause className="w-6 h-6 text-white" />
                      ) : (
                        <Play className="w-6 h-6 text-white ml-1" />
                      )}
                    </button>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">{track.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                        {track.track_type === 'generated' && (
                          <span className="flex items-center gap-1 text-violet-400">
                            <Sparkles className="w-3 h-3" />
                            AI Generated
                          </span>
                        )}
                        {track.mood && (
                          <span className="capitalize">{track.mood}</span>
                        )}
                        {track.duration_ms && (
                          <span>{formatDuration(track.duration_ms)}</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <a
                        href={track.audio_url}
                        download
                        className="p-2 text-slate-500 hover:text-white transition-colors"
                        title="Download"
                      >
                        <Volume2 className="w-5 h-5" />
                      </a>
                      <button
                        onClick={() => handleDelete(track.id)}
                        className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
