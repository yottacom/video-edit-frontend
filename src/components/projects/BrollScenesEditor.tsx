'use client';

import { AudioLines, Clock3, Film, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { VideoThumbnail } from '@/components/media/VideoThumbnail';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ProjectBrollSceneInput } from '@/types';

interface BrollScenesEditorProps {
  scenes: ProjectBrollSceneInput[];
  onChange: (scenes: ProjectBrollSceneInput[]) => void;
  onReplaceAsset: (sceneId: string) => void;
}

const fieldClassName =
  'block w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-violet-500 focus:outline-none';

function formatMilliseconds(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0.0s';
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

function getSceneDuration(scene: ProjectBrollSceneInput) {
  return Math.max(0, scene.end_ms - scene.start_ms);
}

function getSceneAssetType(scene: ProjectBrollSceneInput) {
  if (scene.video_url) return 'video';
  if (scene.image_url) return 'image';
  return null;
}

function getSceneAssetUrl(scene: ProjectBrollSceneInput) {
  return scene.video_url || scene.image_url || null;
}

function getStatusTone(status: string) {
  switch (status) {
    case 'completed':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';
    case 'failed':
    case 'error':
      return 'border-red-500/25 bg-red-500/10 text-red-200';
    default:
      return 'border-slate-700 bg-slate-800/70 text-slate-200';
  }
}

export function BrollScenesEditor({
  scenes,
  onChange,
  onReplaceAsset,
}: BrollScenesEditorProps) {
  const updateScene = (sceneId: string, updater: (scene: ProjectBrollSceneInput) => ProjectBrollSceneInput) => {
    onChange(
      scenes.map((scene) => (scene.id === sceneId ? updater(scene) : scene))
    );
  };

  const sortedScenes = [...scenes].sort((left, right) => left.order - right.order);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">B-Roll Scenes</h2>
        <p className="mt-1 text-sm text-slate-400">
          Review each scene, adjust timing or prompts, and replace the current image or video without editing raw JSON.
        </p>
      </div>

      {sortedScenes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 px-6 py-10 text-center">
          <p className="text-sm font-medium text-white">No B-roll scenes available</p>
          <p className="mt-2 text-sm text-slate-400">
            This project does not currently include any editable B-roll scenes.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedScenes.map((scene) => {
            const assetType = getSceneAssetType(scene);
            const assetUrl = getSceneAssetUrl(scene);

            return (
              <Card key={scene.id} className="border-slate-800 bg-slate-950/40">
                <CardContent className="p-5">
                  <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.15fr)]">
                    <div className="space-y-4">
                      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                        {assetType === 'video' && (
                          <VideoThumbnail
                            videoUrl={scene.video_url}
                            title={`Scene ${scene.order + 1}`}
                            className="h-full w-full object-cover"
                            fallbackIconClassName="h-12 w-12 text-white/70"
                          />
                        )}

                        {assetType === 'image' && assetUrl && (
                          <div
                            className="h-full w-full bg-cover bg-center"
                            style={{ backgroundImage: `url("${assetUrl}")` }}
                          />
                        )}

                        {!assetType && (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-500">
                            <ImageIcon className="h-10 w-10" />
                            <p className="text-sm">No image or video selected</p>
                          </div>
                        )}

                        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-slate-700/80 bg-slate-950/90 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-200">
                            Scene {scene.order + 1}
                          </span>
                          <span className="rounded-full border border-slate-700/80 bg-slate-950/90 px-2.5 py-1 text-[11px] font-medium text-slate-200">
                            {scene.scene_type}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getStatusTone(scene.status)}`}
                          >
                            {scene.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onReplaceAsset(scene.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                          Replace Asset
                        </Button>

                        <div className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
                          {assetType === 'video' ? 'Video Asset' : assetType === 'image' ? 'Image Asset' : 'No Asset'}
                        </div>

                        <div className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
                          Duration {formatMilliseconds(getSceneDuration(scene))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                          Current Asset
                        </p>
                        <p className="mt-2 break-all text-sm text-slate-300">
                          {assetUrl || 'No asset URL on this scene yet.'}
                        </p>
                      </div>

                      {scene.sfx_url && (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
                            <AudioLines className="h-4 w-4 text-cyan-300" />
                            Scene SFX
                          </div>
                          <audio controls preload="metadata" src={scene.sfx_url} className="w-full" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                            <Clock3 className="h-4 w-4 text-violet-300" />
                            Start (ms)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={scene.start_ms}
                            onChange={(event) => {
                              updateScene(scene.id, (currentScene) => ({
                                ...currentScene,
                                start_ms: Number(event.target.value) || 0,
                              }));
                            }}
                            className={fieldClassName}
                          />
                        </div>

                        <div>
                          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                            <Clock3 className="h-4 w-4 text-violet-300" />
                            End (ms)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={scene.end_ms}
                            onChange={(event) => {
                              updateScene(scene.id, (currentScene) => ({
                                ...currentScene,
                                end_ms: Number(event.target.value) || 0,
                              }));
                            }}
                            className={fieldClassName}
                          />
                        </div>

                        <div>
                          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                            <Film className="h-4 w-4 text-violet-300" />
                            Position
                          </label>
                          <input
                            type="text"
                            value={scene.position || ''}
                            onChange={(event) => {
                              updateScene(scene.id, (currentScene) => ({
                                ...currentScene,
                                position: event.target.value.trim() ? event.target.value : null,
                              }));
                            }}
                            placeholder="e.g. fullscreen"
                            className={fieldClassName}
                          />
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                            Scene ID
                          </p>
                          <p className="mt-2 break-all text-sm text-slate-300">{scene.id}</p>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-300">
                          Image Prompt
                        </label>
                        <textarea
                          value={scene.image_prompt || ''}
                          onChange={(event) => {
                            updateScene(scene.id, (currentScene) => ({
                              ...currentScene,
                              image_prompt: event.target.value.trim() ? event.target.value : null,
                            }));
                          }}
                          rows={4}
                          placeholder="Prompt used for the still image"
                          className={`${fieldClassName} min-h-[112px] resize-y`}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-300">
                          Motion Prompt
                        </label>
                        <textarea
                          value={scene.motion_prompt || ''}
                          onChange={(event) => {
                            updateScene(scene.id, (currentScene) => ({
                              ...currentScene,
                              motion_prompt: event.target.value.trim() ? event.target.value : null,
                            }));
                          }}
                          rows={4}
                          placeholder="Prompt used for camera movement or animation"
                          className={`${fieldClassName} min-h-[112px] resize-y`}
                        />
                      </div>

                      {scene.error && (
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                          {scene.error}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
