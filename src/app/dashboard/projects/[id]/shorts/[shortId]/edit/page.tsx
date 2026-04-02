'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  Layers3,
  ListOrdered,
  Loader2,
  Music,
  RefreshCw,
  Save,
  Scissors,
  Wand2,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { InlineVideoPlayer } from '@/components/media/InlineVideoPlayer';
import { ShortSegmentsTimelineEditor } from '@/components/projects/ShortSegmentsTimelineEditor';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SubtitleConfigEditor } from '@/components/projects/SubtitleConfigEditor';
import { MusicTrackPicker, SubtitleStylePicker } from '@/components/projects/ProjectEditorFields';
import { getApiErrorMessage, musicTracksApi, projectsApi, subtitleStylesApi } from '@/lib/api';
import {
  buildProjectSubtitleConfigOverride,
  DEFAULT_PROJECT_SUBTITLE_CONFIG,
  getProjectShortTimelineDuration,
  ProjectSubtitleConfig,
  resolveProjectSubtitleConfigState,
  sanitizeProjectShortSegments,
  SubtitleConfigMode,
} from '@/lib/project-editing';
import {
  EditProject,
  MusicTrack,
  ProjectShort,
  ProjectShortEditPayload,
  ProjectShortSegment,
  SubtitleStyle,
} from '@/types';

interface JsonFieldErrors {
  segments: string | null;
  duration: string | null;
}

function getMaxSegmentEndMs(segments: ProjectShortSegment[]) {
  return segments.reduce((currentMax, segment) => Math.max(currentMax, segment.end_ms), 0);
}

export default function ProjectShortEditPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const shortId = params.shortId as string;

  const [project, setProject] = useState<EditProject | null>(null);
  const [short, setShort] = useState<ProjectShort | null>(null);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [subtitleStyles, setSubtitleStyles] = useState<SubtitleStyle[]>([]);
  const [title, setTitle] = useState('');
  const [segments, setSegments] = useState<ProjectShortSegment[]>([]);
  const [totalDurationMs, setTotalDurationMs] = useState('0');
  const [subtitleStyle, setSubtitleStyle] = useState('');
  const [selectedMusicId, setSelectedMusicId] = useState('');
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [subtitleConfigMode, setSubtitleConfigMode] = useState<SubtitleConfigMode>('default');
  const [subtitleConfig, setSubtitleConfig] = useState<ProjectSubtitleConfig>(
    DEFAULT_PROJECT_SUBTITLE_CONFIG
  );
  const [jsonErrors, setJsonErrors] = useState<JsonFieldErrors>({
    segments: null,
    duration: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const applyProjectToForm = useCallback(
    (data: EditProject) => {
      const matchingShort = (data.shorts || []).find((item) => item.id === shortId) || null;

      setProject(data);
      setShort(matchingShort);

      if (!matchingShort) {
        return;
      }

      const sanitizedSegments = sanitizeProjectShortSegments(matchingShort.segments);
      const maxSegmentEndMs = getMaxSegmentEndMs(sanitizedSegments);
      const normalizedTotalDurationMs = Math.max(matchingShort.total_duration_ms ?? 0, maxSegmentEndMs);

      setTitle(matchingShort.title || '');
      setSegments(sanitizedSegments);
      setTotalDurationMs(String(normalizedTotalDurationMs));
      setSubtitleStyle(matchingShort.subtitle_style || data.config.shorts_subtitle_style || data.config.subtitle_style || '');
      setSelectedMusicId(matchingShort.music_track_id || data.config.shorts_music_track_id || '');
      setMusicVolume(
        typeof matchingShort.music_volume === 'number'
          ? matchingShort.music_volume
          : data.config.music_volume
      );
      const subtitleConfigState = resolveProjectSubtitleConfigState(
        matchingShort.subtitle_config_override
      );
      setSubtitleConfigMode(subtitleConfigState.mode);
      setSubtitleConfig(subtitleConfigState.config);
      setJsonErrors({
        segments: null,
        duration: null,
      });
    },
    [shortId]
  );

  const handleSegmentsChange = useCallback((nextSegments: ProjectShortSegment[]) => {
    const maxSegmentEndMs = getMaxSegmentEndMs(nextSegments);

    setSegments(nextSegments);
    setJsonErrors((currentErrors) => ({
      ...currentErrors,
      segments: null,
      duration: null,
    }));
    setErrorMessage(null);

    setTotalDurationMs((currentValue) => {
      const parsedCurrentDuration = Number.parseInt(currentValue, 10);
      const safeCurrentDuration =
        Number.isFinite(parsedCurrentDuration) && parsedCurrentDuration >= 0 ? parsedCurrentDuration : 0;

      if (maxSegmentEndMs > safeCurrentDuration) {
        return String(maxSegmentEndMs);
      }

      return currentValue;
    });
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [projectData, musicRes, stylesRes] = await Promise.all([
          projectsApi.get(projectId),
          musicTracksApi.list(),
          subtitleStylesApi.list(),
        ]);

        applyProjectToForm(projectData);
        setMusicTracks(musicRes.items || []);
        setSubtitleStyles(stylesRes.styles || []);
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error, 'Failed to load the short editor.'));
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [applyProjectToForm, projectId]);

  const handleAddSegment = useCallback(() => {
    const currentDuration = Number.parseInt(totalDurationMs, 10);
    const safeCurrentDuration = Number.isFinite(currentDuration) && currentDuration >= 0 ? currentDuration : 0;
    const nextStart = segments.length > 0
      ? segments.reduce((currentMax, segment) => Math.max(currentMax, segment.end_ms), 0)
      : 0;
    const nextEnd = nextStart + 5000;

    handleSegmentsChange([
      ...segments,
      {
        start_ms: nextStart,
        end_ms: nextEnd,
      },
    ]);

    if (nextEnd > safeCurrentDuration) {
      setTotalDurationMs(String(nextEnd));
    }
  }, [handleSegmentsChange, segments, totalDurationMs]);

  const handleDeleteSegment = useCallback((segmentIndex: number) => {
    handleSegmentsChange(segments.filter((_, index) => index !== segmentIndex));
  }, [handleSegmentsChange, segments]);

  const buildPayload = useCallback((): ProjectShortEditPayload | null => {
    const nextErrors: JsonFieldErrors = {
      segments: null,
      duration: null,
    };

    const parsedDuration = Number.parseInt(totalDurationMs, 10);
    const maxSegmentEndMs = getMaxSegmentEndMs(segments);
    if (!Number.isFinite(parsedDuration) || parsedDuration < 0) {
      nextErrors.duration = 'Total duration must be a non-negative number of milliseconds.';
    }

    const invalidSegment = segments.find((segment) => {
      return (
        !Number.isFinite(segment.start_ms) ||
        !Number.isFinite(segment.end_ms) ||
        segment.start_ms < 0 ||
        segment.end_ms <= segment.start_ms
      );
    });

    if (invalidSegment) {
      nextErrors.segments = 'Each segment must have a valid start and end time, and the end must be after the start.';
    }

    setJsonErrors(nextErrors);

    if (nextErrors.segments || nextErrors.duration) {
      setErrorMessage('Please fix the highlighted fields before continuing.');
      return null;
    }

    const normalizedDuration = Math.max(parsedDuration, maxSegmentEndMs);
    if (normalizedDuration !== parsedDuration) {
      setTotalDurationMs(String(normalizedDuration));
    }

    return {
      title,
      segments,
      total_duration_ms: normalizedDuration,
      subtitle_style: subtitleStyle,
      subtitle_config_override: buildProjectSubtitleConfigOverride(subtitleConfigMode, subtitleConfig),
      music_track_id: selectedMusicId || null,
      music_volume: musicVolume,
    };
  }, [musicVolume, selectedMusicId, segments, subtitleConfig, subtitleConfigMode, subtitleStyle, title, totalDurationMs]);

  const handleSave = async () => {
    const payload = buildPayload();
    if (!payload || !short) return;

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updatedProject = await projectsApi.updateShort(projectId, short.id, payload);
      applyProjectToForm(updatedProject);
      setSuccessMessage('Short settings saved.');
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Failed to save short edits.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    const payload = buildPayload();
    if (!payload || !short) return;

    setRegenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updatedProject = await projectsApi.updateShort(projectId, short.id, payload);
      applyProjectToForm(updatedProject);
      await projectsApi.regenerateShort(projectId, short.id);
      router.push(`/dashboard/projects/${projectId}`);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Failed to regenerate the short.'));
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project || !short) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl py-16">
          <Card>
            <CardContent className="p-8">
              <p className="text-lg font-semibold text-white">Short editor unavailable</p>
              <p className="mt-2 text-slate-400">
                {errorMessage || 'We could not find the short you are trying to edit.'}
              </p>
              <div className="mt-6">
                <Button variant="secondary" onClick={() => router.push(`/dashboard/projects/${projectId}`)}>
                  Back to Project
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const selectedTrack = musicTracks.find((track) => track.id === selectedMusicId) || null;
  const parsedTimelineDuration = Number.parseInt(totalDurationMs, 10);
  const timelineDurationMs = getProjectShortTimelineDuration(
    Number.isFinite(parsedTimelineDuration) ? parsedTimelineDuration : null,
    segments
  );

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <button
          onClick={() => router.push(`/dashboard/projects/${projectId}`)}
          className="p-2 text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-white">Edit Short</h1>
          <p className="text-slate-400">Update {short.title} and regenerate a fresh short render when ready.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => router.push(`/dashboard/projects/${projectId}`)}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
          <Button onClick={handleRegenerate} loading={regenerating}>
            <RefreshCw className="h-4 w-4" />
            Save + Regenerate
          </Button>
        </div>
      </div>

      {(errorMessage || successMessage) && (
        <div className="mb-6 space-y-3">
          {errorMessage && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {successMessage}
            </div>
          )}
        </div>
      )}

      <div className="space-y-6">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                  <Scissors className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Current Short Output</h2>
                  <p className="text-sm text-slate-400">Preview the current short while you edit its metadata and timing.</p>
                </div>
              </div>

              {short.output_url ? (
                <InlineVideoPlayer
                  key={short.output_url}
                  videoUrl={short.output_url}
                  thumbnailUrl={short.thumbnail_url}
                  title={short.title}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 p-8 text-sm text-slate-500">
                  This short does not have a rendered output yet. You can still save edits and regenerate it.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
                  <Wand2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Short Snapshot</h2>
                  <p className="text-sm text-slate-400">The current clip state inside this project.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-violet-300">
                      <ListOrdered className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Clip Order</p>
                      <p className="mt-1 font-medium text-white">Clip {short.order + 1}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-cyan-300">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Status</p>
                      <p className="mt-1 font-medium capitalize text-white">{short.status}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-emerald-300">
                      <Layers3 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Segments</p>
                      <p className="mt-1 font-medium text-white">{segments.length}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-fuchsia-300">
                      <Music className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Current Music</p>
                      <p className="mt-1 font-medium text-white">{selectedTrack?.title || 'No music selected'}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-amber-300">
                      <CalendarClock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Updated</p>
                      <p className="mt-1 font-medium text-white">
                        {new Date(short.updated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Input
                label="Short Title"
                placeholder="Enter a short title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />

              <div className="mt-5">
              <Input
                label="Total Duration (ms)"
                type="number"
                min="0"
                value={totalDurationMs}
                onChange={(event) => {
                  setTotalDurationMs(event.target.value);
                  setJsonErrors((currentErrors) => ({
                    ...currentErrors,
                    duration: null,
                    segments: null,
                  }));
                  setErrorMessage(null);
                }}
                error={jsonErrors.duration || undefined}
              />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <SubtitleStylePicker
                subtitleStyles={subtitleStyles}
                value={subtitleStyle}
                onChange={setSubtitleStyle}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <MusicTrackPicker
                musicTracks={musicTracks}
                selectedMusicId={selectedMusicId}
                onSelect={setSelectedMusicId}
                musicVolume={musicVolume}
                onVolumeChange={setMusicVolume}
              />
            </CardContent>
          </Card>

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

          <Card>
            <CardContent className="p-6">
              <ShortSegmentsTimelineEditor
                videoUrl={short.output_url}
                thumbnailUrl={short.thumbnail_url}
                segments={segments}
                timelineDurationMs={timelineDurationMs}
                onChange={handleSegmentsChange}
                onAddSegment={handleAddSegment}
                onDeleteSegment={handleDeleteSegment}
                error={jsonErrors.segments}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
