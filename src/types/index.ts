// Video Editor Types

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface SourceVideo {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  transcript_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  track_type: 'generated' | 'uploaded' | 'preset';
  audio_url: string;
  duration_ms: number | null;
  mood: string | null;
  genre: string | null;
  prompt: string | null;
  created_at: string;
}

export type AssetType = 'image' | 'video' | 'audio';

export type AssetSourceType = 'generated' | 'uploaded';

export type AssetStatus = 'processing' | 'ready' | 'failed';

export interface AssetItem {
  id: string;
  title: string;
  asset_type: AssetType;
  source_type: AssetSourceType;
  status: AssetStatus;
  url: string | null;
  thumbnail_url: string | null;
  duration_ms?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface AssetPresignedUploadResponse {
  presigned_url: string;
  s3_key: string;
  asset_type: AssetType;
}

export interface AssetGenerationJobResponse {
  mode: 'async' | 'sync';
  job_id: string | null;
  status: string;
  progress: number;
  error: string | null;
  poll_url: string | null;
  asset: AssetItem | null;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string | null;
  description: string | null;
  preview_url: string | null;
  gender: string | null;
  age: string | null;
  accent: string | null;
  language: string | null;
  locale: string | null;
  labels: Record<string, unknown>;
  high_quality_base_model_ids: string[];
  available_for_tiers: string[];
  verified_languages: Record<string, unknown>[];
  is_legacy: boolean;
  is_owner: boolean;
  is_added_by_user: boolean;
}

export interface ElevenLabsVoiceListResponse {
  items: ElevenLabsVoice[];
  page_size: number;
  next_page_token: string | null;
  has_more: boolean;
  total_count: number;
}

export interface CustomVideoScenePayload {
  order: number;
  title?: string;
  kind?: string;
  use_avatar?: boolean;
  voiceover_text?: string;
  elevenlabs_voice_id?: string;
  audio_asset_id?: string;
  avatar_video_asset_id?: string;
  avatar_image_asset_id?: string;
  avatar_image_prompt?: string;
  avatar_motion_prompt?: string;
  primary_assets: CustomVideoSceneAssetPayload[];
  secondary_assets?: CustomVideoSceneAssetPayload[];
  subtitle_config?: Record<string, unknown>;
  duration_ms?: number;
  extra_metadata?: Record<string, unknown>;
}

export interface CustomVideoSceneAssetPayload {
  asset_id: string;
  start_time?: number;
  end_time?: number;
  description?: string;
  prompt?: string;
  motion_prompt?: string;
  extra_metadata?: Record<string, unknown>;
}

export interface CustomVideoSceneAsset {
  asset_id: string;
  start_time: number;
  end_time: number;
  description: string | null;
  prompt: string | null;
  motion_prompt: string | null;
  extra_metadata: Record<string, unknown> | null;
}

export interface CustomVideoScene {
  id: string;
  order: number;
  title?: string | null;
  kind?: string | null;
  use_avatar?: boolean;
  voiceover_text: string | null;
  elevenlabs_voice_id?: string | null;
  audio_asset_id?: string | null;
  avatar_video_asset_id?: string | null;
  avatar_image_asset_id?: string | null;
  avatar_image_prompt?: string | null;
  avatar_motion_prompt?: string | null;
  primary_assets: CustomVideoSceneAsset[];
  secondary_assets?: CustomVideoSceneAsset[];
  subtitle_config?: Record<string, unknown> | null;
  duration_ms: number | null;
  extra_metadata?: Record<string, unknown> | null;
  transcript?: Record<string, unknown> | null;
  start_ms?: number | null;
  end_ms?: number | null;
  created_at?: string;
  updated_at?: string;
}

export type CustomVideoStatus = 'draft' | 'finalizing' | 'rendering' | 'completed' | 'failed';

export interface CustomVideo {
  id: string;
  title: string | null;
  video_type: 'portrait' | 'landscape';
  background_music_mood: string | null;
  status: CustomVideoStatus;
  progress: number;
  scenes: CustomVideoScene[];
  output_url: string | null;
  error_message: string | null;
  render_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectConfig {
  add_broll: boolean;
  broll_sfx: boolean;
  music_track_id: string | null;
  music_volume: number;
  subtitle_style: string;
  subtitle_config_override: Record<string, unknown> | null;
  generate_shorts: boolean;
  shorts_count: number;
  shorts_subtitle_style: string;
  shorts_music_track_id: string | null;
  shorts_broll: boolean;
}

export type ProjectStatus = 
  | 'draft' 
  | 'pending' 
  | 'transcribing' 
  | 'planning' 
  | 'generating' 
  | 'rendering' 
  | 'completed' 
  | 'failed';

export interface ProjectRender {
  id: string;
  status: string;
  progress: number;
  mode: string | null;
  subtitle_style: string | null;
  subtitle_config_override: Record<string, unknown> | null;
  music_track_id: string | null;
  music_volume: number;
  broll_enabled?: boolean;
  broll_sfx?: boolean;
  broll_snapshot?: Record<string, unknown>[] | null;
  segments_snapshot?: Record<string, unknown>[] | null;
  transcript_snapshot?: Record<string, unknown> | null;
  source_video_url?: string | null;
  remotion_render_id: string | null;
  remotion_bucket_name: string | null;
  render_response: Record<string, unknown> | null;
  output_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectBrollSceneInput {
  id: string;
  order: number;
  scene_type: string;
  start_ms: number;
  end_ms: number;
  position: string | null;
  image_prompt: string | null;
  motion_prompt: string | null;
  image_url: string | null;
  video_url: string | null;
  sfx_url: string | null;
  status: string;
  error: string | null;
}

export interface ProjectScene extends ProjectBrollSceneInput {
  voiceover_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectShort {
  id: string;
  title: string;
  order: number;
  status: ProjectStatus;
  progress: number;
  segments: Record<string, unknown>[];
  total_duration_ms: number | null;
  output_url: string | null;
  thumbnail_url: string | null;
  error: string | null;
  subtitle_style?: string | null;
  subtitle_config_override?: Record<string, unknown> | null;
  music_track_id?: string | null;
  music_volume?: number;
  current_render_id?: string | null;
  renders?: ProjectRender[];
  created_at: string;
  updated_at: string;
}

export interface EditProject {
  id: string;
  title: string;
  source_video_id: string;
  status: ProjectStatus;
  progress: number;
  config: ProjectConfig;
  output_url: string | null;
  error_message: string | null;
  current_render_id?: string | null;
  renders?: ProjectRender[];
  scenes?: ProjectScene[];
  shorts?: ProjectShort[];
  created_at: string;
  updated_at: string;
}

export interface ProjectMainEditPayload {
  music_track_id?: string | null;
  music_volume?: number;
  subtitle_style?: string;
  subtitle_config_override?: Record<string, unknown> | null;
  broll_scenes?: ProjectBrollSceneInput[];
}

export interface ProjectShortEditPayload {
  title?: string;
  segments?: Record<string, unknown>[];
  total_duration_ms?: number;
  subtitle_style?: string;
  subtitle_config_override?: Record<string, unknown> | null;
  music_track_id?: string | null;
  music_volume?: number;
}

export interface SubtitleStyle {
  id: string;
  name: string;
  description: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface UploadItem {
  id: string;
  title: string;
  content_type: string;
  size_bytes: number | null;
  status: 'uploading' | 'completed' | 'failed' | 'aborted';
  progress: number;
  s3_key: string | null;
  url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MultipartStartResponse {
  key: string;
  upload_id: string;
}

export interface PartUrlResponse {
  url: string;
}

export interface MultipartListPart {
  PartNumber: number;
  ETag: string;
}
