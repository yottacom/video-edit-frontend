'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, RefreshCw, Save, Scissors, Wand2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { InlineVideoPlayer } from '@/components/media/InlineVideoPlayer';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SubtitleConfigEditor } from '@/components/projects/SubtitleConfigEditor';
import {
  JsonEditorField,
  MusicTrackPicker,
  SubtitleStylePicker,
} from '@/components/projects/ProjectEditorFields';
import { getApiErrorMessage, musicTracksApi, projectsApi, subtitleStylesApi } from '@/lib/api';
import {
  buildProjectSubtitleConfigOverride,
  DEFAULT_PROJECT_SUBTITLE_CONFIG,
  formatJsonInput,
  parseJsonArrayInput,
  ProjectSubtitleConfig,
  resolveProjectSubtitleConfigState,
  SubtitleConfigMode,
} from '@/lib/project-editing';
import { EditProject, MusicTrack, ProjectShort, ProjectShortEditPayload, SubtitleStyle } from '@/types';

interface JsonFieldErrors {
  segments: string | null;
  duration: string | null;
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
  const [segmentsText, setSegmentsText] = useState('[]');
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

      setTitle(matchingShort.title || '');
      setSegmentsText(formatJsonInput(matchingShort.segments, '[]'));
      setTotalDurationMs(String(matchingShort.total_duration_ms ?? 0));
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

  const buildPayload = useCallback((): ProjectShortEditPayload | null => {
    const nextErrors: JsonFieldErrors = {
      segments: null,
      duration: null,
    };

    let parsedSegments: Record<string, unknown>[] = [];

    try {
      parsedSegments = parseJsonArrayInput<Record<string, unknown>>(
        segmentsText,
        'Short segments'
      );
    } catch (error) {
      nextErrors.segments = error instanceof Error ? error.message : 'Invalid segments JSON.';
    }

    const parsedDuration = Number.parseInt(totalDurationMs, 10);
    if (!Number.isFinite(parsedDuration) || parsedDuration < 0) {
      nextErrors.duration = 'Total duration must be a non-negative number of milliseconds.';
    }

    setJsonErrors(nextErrors);

    if (nextErrors.segments || nextErrors.duration) {
      setErrorMessage('Please fix the highlighted fields before continuing.');
      return null;
    }

    return {
      title,
      segments: parsedSegments,
      total_duration_ms: parsedDuration,
      subtitle_style: subtitleStyle,
      subtitle_config_override: buildProjectSubtitleConfigOverride(subtitleConfigMode, subtitleConfig),
      music_track_id: selectedMusicId || null,
      music_volume: musicVolume,
    };
  }, [musicVolume, selectedMusicId, segmentsText, subtitleConfig, subtitleConfigMode, subtitleStyle, title, totalDurationMs]);

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

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={() => router.push(`/dashboard/projects/${projectId}`)}
          className="p-2 text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Edit Short</h1>
          <p className="text-slate-400">Update {short.title} and regenerate a fresh short render when ready.</p>
        </div>
        <div className="flex items-center gap-3">
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

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-6">
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
                  onChange={(event) => setTotalDurationMs(event.target.value)}
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
              <JsonEditorField
                label="Short Segments"
                description="Editable JSON array sent directly to the short update API as `segments`."
                value={segmentsText}
                onChange={setSegmentsText}
                error={jsonErrors.segments}
                placeholder="[]"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
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
                  <p className="text-sm text-slate-400">Clip Order</p>
                  <p className="mt-1 font-medium text-white">Clip {short.order + 1}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                  <p className="text-sm text-slate-400">Status</p>
                  <p className="mt-1 font-medium capitalize text-white">{short.status}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                  <p className="text-sm text-slate-400">Segments</p>
                  <p className="mt-1 font-medium text-white">{short.segments.length}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                  <p className="text-sm text-slate-400">Current Music</p>
                  <p className="mt-1 font-medium text-white">{selectedTrack?.title || 'No music selected'}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                  <p className="text-sm text-slate-400">Updated</p>
                  <p className="mt-1 font-medium text-white">
                    {new Date(short.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-3 text-sm text-slate-400">
                <p>`Save Changes` updates the short configuration and keeps you on this page.</p>
                <p>`Save + Regenerate` saves the current form, triggers the short regenerate API, and returns you to the project detail page so you can watch progress there.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
