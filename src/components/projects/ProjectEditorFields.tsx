'use client';

import { AudioLines, Music, Type } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { MusicTrack, SubtitleStyle } from '@/types';

interface JsonEditorFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  minHeightClassName?: string;
  placeholder?: string;
}

interface SubtitleStylePickerProps {
  subtitleStyles: SubtitleStyle[];
  value: string;
  onChange: (value: string) => void;
}

interface MusicTrackPickerProps {
  musicTracks: MusicTrack[];
  selectedMusicId: string;
  onSelect: (value: string) => void;
  musicVolume: number;
  onVolumeChange: (value: number) => void;
}

function formatDuration(ms: number | null) {
  if (!ms) return 'Unknown';

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function JsonEditorField({
  label,
  description,
  value,
  onChange,
  error,
  minHeightClassName = 'min-h-[280px]',
  placeholder,
}: JsonEditorFieldProps) {
  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-slate-300">{label}</label>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className={`w-full rounded-xl border px-4 py-3 font-mono text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 ${
          error
            ? 'border-red-500 bg-red-500/5 text-red-100'
            : 'border-slate-700 bg-slate-900/80 text-slate-100'
        } ${minHeightClassName}`}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function SubtitleStylePicker({
  subtitleStyles,
  value,
  onChange,
}: SubtitleStylePickerProps) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Type className="h-4 w-4 text-violet-300" />
        <label className="text-sm font-medium text-slate-300">Subtitle Style</label>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {subtitleStyles.map((style) => (
          <Card
            key={style.id}
            hover
            className={`cursor-pointer transition-all ${
              value === style.id ? 'border-violet-500 ring-2 ring-violet-500/80' : ''
            }`}
            onClick={() => onChange(style.id)}
          >
            <CardContent className="p-4">
              <div className="mb-3 flex h-16 items-center justify-center rounded-lg bg-slate-900">
                <span className="text-lg font-semibold text-white">{style.name}</span>
              </div>
              <p className="text-sm text-slate-400">{style.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function MusicTrackPicker({
  musicTracks,
  selectedMusicId,
  onSelect,
  musicVolume,
  onVolumeChange,
}: MusicTrackPickerProps) {
  const selectedTrack = musicTracks.find((track) => track.id === selectedMusicId) || null;

  return (
    <div className="space-y-5">
      <div className="mb-3 flex items-center gap-2">
        <Music className="h-4 w-4 text-cyan-300" />
        <label className="text-sm font-medium text-slate-300">Background Music</label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          hover
          className={`cursor-pointer ${!selectedMusicId ? 'border-violet-500 ring-2 ring-violet-500/80' : ''}`}
          onClick={() => onSelect('')}
        >
          <CardContent className="p-4 text-center">
            <p className="font-medium text-white">No Music</p>
            <p className="mt-1 text-sm text-slate-400">Keep this render without a background track.</p>
          </CardContent>
        </Card>

        {musicTracks.map((track) => (
          <Card
            key={track.id}
            hover
            className={`cursor-pointer ${selectedMusicId === track.id ? 'border-violet-500 ring-2 ring-violet-500/80' : ''}`}
            onClick={() => onSelect(track.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/40 to-violet-500/40 text-white">
                  <Music className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{track.title}</p>
                  <p className="truncate text-xs text-slate-400">
                    {[track.mood, track.genre, track.track_type].filter(Boolean).join(' • ')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedTrack && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-slate-400">
            <AudioLines className="h-4 w-4" />
            <p className="text-sm">Selected Track</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
              {selectedTrack.track_type}
            </span>
            {selectedTrack.mood && (
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs capitalize text-slate-300">
                {selectedTrack.mood}
              </span>
            )}
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
              {formatDuration(selectedTrack.duration_ms)}
            </span>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Music Volume: {Math.round(musicVolume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={musicVolume}
              onChange={(event) => onVolumeChange(parseFloat(event.target.value))}
              className="w-full"
            />
          </div>

          <audio controls preload="metadata" src={selectedTrack.audio_url} className="mt-4 w-full" />
        </div>
      )}
    </div>
  );
}
