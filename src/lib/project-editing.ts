import { EditProject, ProjectBrollSceneInput, ProjectScene } from '@/types';

export const PROJECT_PROCESSING_STATUSES = [
  'pending',
  'transcribing',
  'planning',
  'generating',
  'rendering',
] as const;

const processingStatusSet = new Set<string>(PROJECT_PROCESSING_STATUSES);

export function isProcessingStatus(status?: string | null) {
  return typeof status === 'string' && processingStatusSet.has(status);
}

export function shouldPollProject(project?: EditProject | null) {
  if (!project) return false;

  if (isProcessingStatus(project.status)) {
    return true;
  }

  return (project.shorts || []).some((short) => isProcessingStatus(short.status));
}

export function formatJsonInput(value: unknown, emptyValue = '') {
  if (value === undefined || value === null) {
    return emptyValue;
  }

  return JSON.stringify(value, null, 2);
}

export function parseJsonArrayInput<T>(value: string, fieldLabel: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return [] as T[];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`${fieldLabel} must be valid JSON.`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON array.`);
  }

  return parsed as T[];
}

export function parseJsonObjectOrNullInput(value: string, fieldLabel: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`${fieldLabel} must be valid JSON.`);
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(`${fieldLabel} must be a JSON object.`);
  }

  return parsed as Record<string, unknown>;
}

export function sanitizeProjectBrollScene(scene: ProjectScene): ProjectBrollSceneInput {
  return {
    id: scene.id,
    order: scene.order,
    scene_type: scene.scene_type,
    start_ms: scene.start_ms,
    end_ms: scene.end_ms,
    position: scene.position,
    image_prompt: scene.image_prompt,
    motion_prompt: scene.motion_prompt,
    image_url: scene.image_url,
    video_url: scene.video_url,
    sfx_url: scene.sfx_url,
    status: scene.status,
    error: scene.error,
  };
}

export function sanitizeProjectBrollScenes(scenes?: ProjectScene[] | null) {
  return (scenes || []).map(sanitizeProjectBrollScene);
}
