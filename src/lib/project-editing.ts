import { EditProject, ProjectBrollSceneInput, ProjectScene } from '@/types';

export type SubtitleConfigMode = 'default' | 'custom';

export interface ProjectSubtitleConfig {
  font: {
    size: number;
    style: string;
    family: string;
    weight: number;
    transform: string;
    lineHeight: number;
    letterSpacing: string;
  };
  colors: {
    active: [string, string];
    inactive: string;
  };
  animation: {
    scaleEntry: number;
    rotateRange: number;
    blurIntensity: number;
    shakeIntensity: number;
  };
  structure: {
    maxWords: number;
    displayMode: string;
    verticalAlign: string;
  };
  decoration: {
    shadowColor: string;
    strokeColor: string;
    strokeWidth: number;
    shadowOffset: number;
  };
}

export const DEFAULT_PROJECT_SUBTITLE_CONFIG: ProjectSubtitleConfig = {
  font: {
    size: 95,
    style: 'normal',
    family: '"Archivo Black", "Impact", sans-serif',
    weight: 900,
    transform: 'uppercase',
    lineHeight: 1,
    letterSpacing: '-2px',
  },
  colors: {
    active: ['#FFEA00', '#FFFFFF'],
    inactive: '#FFFFFF',
  },
  animation: {
    scaleEntry: 0.3,
    rotateRange: 5,
    blurIntensity: 0,
    shakeIntensity: 1,
  },
  structure: {
    maxWords: 1,
    displayMode: 'word_by_word',
    verticalAlign: 'bottom',
  },
  decoration: {
    shadowColor: '#000000',
    strokeColor: '#000000',
    strokeWidth: 5,
    shadowOffset: 12,
  },
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function getNumberValue(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function getActiveColors(value: unknown, fallback: [string, string]): [string, string] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return [
    typeof value[0] === 'string' && value[0].trim() ? value[0] : fallback[0],
    typeof value[1] === 'string' && value[1].trim() ? value[1] : fallback[1],
  ];
}

export function normalizeProjectSubtitleConfig(value: unknown): ProjectSubtitleConfig {
  const root = isRecord(value) ? value : {};
  const font = isRecord(root.font) ? root.font : {};
  const colors = isRecord(root.colors) ? root.colors : {};
  const animation = isRecord(root.animation) ? root.animation : {};
  const structure = isRecord(root.structure) ? root.structure : {};
  const decoration = isRecord(root.decoration) ? root.decoration : {};

  return {
    font: {
      size: getNumberValue(font.size, DEFAULT_PROJECT_SUBTITLE_CONFIG.font.size),
      style: getStringValue(font.style, DEFAULT_PROJECT_SUBTITLE_CONFIG.font.style),
      family: getStringValue(font.family, DEFAULT_PROJECT_SUBTITLE_CONFIG.font.family),
      weight: getNumberValue(font.weight, DEFAULT_PROJECT_SUBTITLE_CONFIG.font.weight),
      transform: getStringValue(font.transform, DEFAULT_PROJECT_SUBTITLE_CONFIG.font.transform),
      lineHeight: getNumberValue(font.lineHeight, DEFAULT_PROJECT_SUBTITLE_CONFIG.font.lineHeight),
      letterSpacing: getStringValue(font.letterSpacing, DEFAULT_PROJECT_SUBTITLE_CONFIG.font.letterSpacing),
    },
    colors: {
      active: getActiveColors(colors.active, DEFAULT_PROJECT_SUBTITLE_CONFIG.colors.active),
      inactive: getStringValue(colors.inactive, DEFAULT_PROJECT_SUBTITLE_CONFIG.colors.inactive),
    },
    animation: {
      scaleEntry: getNumberValue(animation.scaleEntry, DEFAULT_PROJECT_SUBTITLE_CONFIG.animation.scaleEntry),
      rotateRange: getNumberValue(animation.rotateRange, DEFAULT_PROJECT_SUBTITLE_CONFIG.animation.rotateRange),
      blurIntensity: getNumberValue(animation.blurIntensity, DEFAULT_PROJECT_SUBTITLE_CONFIG.animation.blurIntensity),
      shakeIntensity: getNumberValue(animation.shakeIntensity, DEFAULT_PROJECT_SUBTITLE_CONFIG.animation.shakeIntensity),
    },
    structure: {
      maxWords: getNumberValue(structure.maxWords, DEFAULT_PROJECT_SUBTITLE_CONFIG.structure.maxWords),
      displayMode: getStringValue(structure.displayMode, DEFAULT_PROJECT_SUBTITLE_CONFIG.structure.displayMode),
      verticalAlign: getStringValue(structure.verticalAlign, DEFAULT_PROJECT_SUBTITLE_CONFIG.structure.verticalAlign),
    },
    decoration: {
      shadowColor: getStringValue(decoration.shadowColor, DEFAULT_PROJECT_SUBTITLE_CONFIG.decoration.shadowColor),
      strokeColor: getStringValue(decoration.strokeColor, DEFAULT_PROJECT_SUBTITLE_CONFIG.decoration.strokeColor),
      strokeWidth: getNumberValue(decoration.strokeWidth, DEFAULT_PROJECT_SUBTITLE_CONFIG.decoration.strokeWidth),
      shadowOffset: getNumberValue(decoration.shadowOffset, DEFAULT_PROJECT_SUBTITLE_CONFIG.decoration.shadowOffset),
    },
  };
}

export function resolveProjectSubtitleConfigState(value: unknown) {
  const mode: SubtitleConfigMode = isRecord(value) ? 'custom' : 'default';

  return {
    mode,
    config: normalizeProjectSubtitleConfig(value),
  };
}

export function buildProjectSubtitleConfigOverride(
  mode: SubtitleConfigMode,
  config: ProjectSubtitleConfig
): Record<string, unknown> | null {
  if (mode === 'default') {
    return null;
  }

  return {
    font: {
      size: config.font.size,
      style: config.font.style,
      family: config.font.family,
      weight: config.font.weight,
      transform: config.font.transform,
      lineHeight: config.font.lineHeight,
      letterSpacing: config.font.letterSpacing,
    },
    colors: {
      active: [config.colors.active[0], config.colors.active[1]],
      inactive: config.colors.inactive,
    },
    animation: {
      scaleEntry: config.animation.scaleEntry,
      rotateRange: config.animation.rotateRange,
      blurIntensity: config.animation.blurIntensity,
      shakeIntensity: config.animation.shakeIntensity,
    },
    structure: {
      maxWords: config.structure.maxWords,
      displayMode: config.structure.displayMode,
      verticalAlign: config.structure.verticalAlign,
    },
    decoration: {
      shadowColor: config.decoration.shadowColor,
      strokeColor: config.decoration.strokeColor,
      strokeWidth: config.decoration.strokeWidth,
      shadowOffset: config.decoration.shadowOffset,
    },
  };
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
