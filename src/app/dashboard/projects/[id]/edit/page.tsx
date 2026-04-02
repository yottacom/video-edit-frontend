'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clapperboard, Loader2, RefreshCw, Save, Sparkles, Wand2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { InlineVideoPlayer } from '@/components/media/InlineVideoPlayer';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  JsonEditorField,
  MusicTrackPicker,
  SubtitleStylePicker,
} from '@/components/projects/ProjectEditorFields';
import { getApiErrorMessage, musicTracksApi, projectsApi, subtitleStylesApi } from '@/lib/api';
import {
  formatJsonInput,
  parseJsonArrayInput,
  parseJsonObjectOrNullInput,
  sanitizeProjectBrollScenes,
} from '@/lib/project-editing';
import { EditProject, MusicTrack, ProjectBrollSceneInput, ProjectMainEditPayload, SubtitleStyle } from '@/types';

interface JsonFieldErrors {
  subtitleConfig: string | null;
  brollScenes: string | null;
}

export default function ProjectMainEditPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<EditProject | null>(null);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [subtitleStyles, setSubtitleStyles] = useState<SubtitleStyle[]>([]);
  const [subtitleStyle, setSubtitleStyle] = useState('');
  const [selectedMusicId, setSelectedMusicId] = useState('');
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [subtitleConfigText, setSubtitleConfigText] = useState('');
  const [brollScenesText, setBrollScenesText] = useState('[]');
  const [jsonErrors, setJsonErrors] = useState<JsonFieldErrors>({
    subtitleConfig: null,
    brollScenes: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const applyProjectToForm = useCallback((data: EditProject) => {
    setProject(data);
    setSubtitleStyle(data.config.subtitle_style || '');
    setSelectedMusicId(data.config.music_track_id || '');
    setMusicVolume(typeof data.config.music_volume === 'number' ? data.config.music_volume : 0.3);
    setSubtitleConfigText(formatJsonInput(data.config.subtitle_config_override));
    setBrollScenesText(formatJsonInput(sanitizeProjectBrollScenes(data.scenes), '[]'));
    setJsonErrors({
      subtitleConfig: null,
      brollScenes: null,
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
        setErrorMessage(getApiErrorMessage(error, 'Failed to load the project editor.'));
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [applyProjectToForm, projectId]);

  const buildPayload = useCallback((): ProjectMainEditPayload | null => {
    const nextErrors: JsonFieldErrors = {
      subtitleConfig: null,
      brollScenes: null,
    };

    let parsedSubtitleConfig: Record<string, unknown> | null = null;
    let parsedBrollScenes: ProjectBrollSceneInput[] = [];

    try {
      parsedSubtitleConfig = parseJsonObjectOrNullInput(
        subtitleConfigText,
        'Subtitle config override'
      );
    } catch (error) {
      nextErrors.subtitleConfig = error instanceof Error ? error.message : 'Invalid subtitle config JSON.';
    }

    try {
      parsedBrollScenes = parseJsonArrayInput<ProjectBrollSceneInput>(
        brollScenesText,
        'B-roll scenes'
      );
    } catch (error) {
      nextErrors.brollScenes = error instanceof Error ? error.message : 'Invalid B-roll scenes JSON.';
    }

    setJsonErrors(nextErrors);

    if (nextErrors.subtitleConfig || nextErrors.brollScenes) {
      setErrorMessage('Please fix the highlighted JSON fields before continuing.');
      return null;
    }

    return {
      music_track_id: selectedMusicId || null,
      music_volume: musicVolume,
      subtitle_style: subtitleStyle,
      subtitle_config_override: parsedSubtitleConfig,
      broll_scenes: parsedBrollScenes,
    };
  }, [brollScenesText, musicVolume, selectedMusicId, subtitleConfigText, subtitleStyle]);

  const handleSave = async () => {
    const payload = buildPayload();
    if (!payload) return;

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updatedProject = await projectsApi.updateMainEdit(projectId, payload);
      applyProjectToForm(updatedProject);
      setSuccessMessage('Main video settings saved.');
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Failed to save main video edits.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    const payload = buildPayload();
    if (!payload) return;

    setRegenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updatedProject = await projectsApi.updateMainEdit(projectId, payload);
      applyProjectToForm(updatedProject);
      await projectsApi.regenerateMain(projectId);
      router.push(`/dashboard/projects/${projectId}`);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Failed to regenerate the main video.'));
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

  if (!project) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl py-16">
          <Card>
            <CardContent className="p-8">
              <p className="text-lg font-semibold text-white">Project editor unavailable</p>
              <p className="mt-2 text-slate-400">
                {errorMessage || 'We could not load the main video editor for this project.'}
              </p>
              <div className="mt-6">
                <Button variant="secondary" onClick={() => router.push('/dashboard/projects')}>
                  Back to Projects
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
          <h1 className="text-2xl font-bold text-white">Edit Video</h1>
          <p className="text-slate-400">Adjust render settings for {project.title} and re-render when you are ready.</p>
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
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
                  <Clapperboard className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Current Output</h2>
                  <p className="text-sm text-slate-400">Use this as your before/after reference while editing.</p>
                </div>
              </div>

              {project.output_url ? (
                <InlineVideoPlayer
                  key={project.output_url}
                  videoUrl={project.output_url}
                  title={project.title}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 p-8 text-sm text-slate-500">
                  This project does not have a rendered output yet. You can still update the configuration and regenerate it.
                </div>
              )}
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
              <JsonEditorField
                label="Subtitle Config Override"
                description="Optional JSON object forwarded to the backend as `subtitle_config_override`. Leave blank to send `null`."
                value={subtitleConfigText}
                onChange={setSubtitleConfigText}
                error={jsonErrors.subtitleConfig}
                minHeightClassName="min-h-[220px]"
                placeholder={"{\n  \"font_size\": 42\n}"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <JsonEditorField
                label="B-Roll Scenes"
                description="Editable JSON array for the `broll_scenes` payload. It starts from the scenes returned by the backend, trimmed to the editable fields."
                value={brollScenesText}
                onChange={setBrollScenesText}
                error={jsonErrors.brollScenes}
                placeholder="[]"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                  <Wand2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Project Snapshot</h2>
                  <p className="text-sm text-slate-400">A quick read on the current render state.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                  <p className="text-sm text-slate-400">Status</p>
                  <p className="mt-1 font-medium capitalize text-white">{project.status}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                  <p className="text-sm text-slate-400">Scenes Available</p>
                  <p className="mt-1 font-medium text-white">{project.scenes?.length || 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                  <p className="text-sm text-slate-400">Shorts Attached</p>
                  <p className="mt-1 font-medium text-white">{project.shorts?.length || 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                  <p className="text-sm text-slate-400">Current Music</p>
                  <p className="mt-1 font-medium text-white">{selectedTrack?.title || 'No music selected'}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                  <p className="text-sm text-slate-400">Updated</p>
                  <p className="mt-1 font-medium text-white">
                    {new Date(project.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Next Step</h2>
                  <p className="text-sm text-slate-400">Save to keep the new config, or regenerate to render a fresh output.</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-slate-400">
                <p>`Save Changes` updates the stored project edit settings without starting a new render.</p>
                <p>`Save + Regenerate` first saves the current form, then triggers the main video regenerate API and returns you to the project detail page.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
