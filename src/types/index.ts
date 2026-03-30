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

export interface EditProject {
  id: string;
  title: string;
  source_video_id: string;
  status: ProjectStatus;
  progress: number;
  config: ProjectConfig;
  output_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
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
