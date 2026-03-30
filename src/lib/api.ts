// API Client for Video Editor Backend
import axios, { InternalAxiosRequestConfig } from 'axios';
import { useDebugStore } from './debug-store';
import { MultipartListPart, MultipartStartResponse, PartUrlResponse, UploadItem } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://video-edit.yt1.co';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Extend config to include debug metadata
declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _debugId?: string;
    _startTime?: number;
  }
}

// Helper to serialize request body for debug
function serializeRequestBody(data: any): any {
  if (!data) return null;
  if (data instanceof URLSearchParams) {
    const obj: Record<string, string> = {};
    data.forEach((value, key) => {
      obj[key] = value; // Show all values including password for debug
    });
    return obj;
  }
  if (data instanceof FormData) {
    const obj: Record<string, string> = {};
    data.forEach((value, key) => {
      obj[key] = String(value);
    });
    return obj;
  }
  return data;
}

// Helper to serialize headers for debug (include auth)
function serializeHeaders(headers: any): Record<string, string> {
  const obj: Record<string, string> = {};
  if (!headers) return obj;
  
  // Handle AxiosHeaders class (has toJSON method)
  if (typeof headers.toJSON === 'function') {
    const json = headers.toJSON();
    Object.entries(json).forEach(([key, value]) => {
      if (typeof value === 'string') {
        obj[key] = value;
      } else if (Array.isArray(value)) {
        obj[key] = value.join(', ');
      }
    });
    return obj;
  }
  
  // Fallback for plain objects
  Object.keys(headers).forEach((key) => {
    const value = headers[key];
    if (typeof value === 'string') {
      obj[key] = value;
    }
  });
  return obj;
}

// Add auth token and debug tracking to requests
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Track request in debug store
    const debugId = useDebugStore.getState().addCall({
      method: config.method?.toUpperCase() || 'GET',
      url: `${config.baseURL}${config.url}`,
      requestHeaders: serializeHeaders(config.headers),
      requestBody: serializeRequestBody(config.data),
    });
    config._debugId = debugId;
    config._startTime = Date.now();
  }
  return config;
});

// Handle responses and track in debug
api.interceptors.response.use(
  (response) => {
    if (typeof window !== 'undefined' && response.config._debugId) {
      const duration = response.config._startTime 
        ? Date.now() - response.config._startTime 
        : undefined;
      useDebugStore.getState().updateCall(response.config._debugId, {
        status: response.status,
        responseBody: response.data,
        duration,
      });
    }
    return response;
  },
  (error) => {
    console.error('API Error:', error?.response?.data || error?.message || error);
    
    if (typeof window !== 'undefined' && error.config?._debugId) {
      const duration = error.config._startTime 
        ? Date.now() - error.config._startTime 
        : undefined;
      useDebugStore.getState().updateCall(error.config._debugId, {
        status: error.response?.status,
        responseBody: error.response?.data,
        error: error.message,
        duration,
      });
    }
    
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH API
// ═══════════════════════════════════════════════════════════════════════════════

export const authApi = {
  login: async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    const res = await api.post('/token', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    
    // Save token immediately so subsequent requests can use it
    if (res.data.access_token && typeof window !== 'undefined') {
      localStorage.setItem('token', res.data.access_token);
    }
    
    return res.data;
  },
  
  signup: async (email: string, password: string) => {
    const res = await api.post('/auth/signup/', { email, password });
    return res.data;
  },
  
  me: async (token?: string) => {
    // Allow passing token directly for immediate use after login
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await api.get('/auth/users/me', { headers });
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE VIDEOS API
// ═══════════════════════════════════════════════════════════════════════════════

export const sourceVideosApi = {
  list: async (page = 1, pageSize = 20) => {
    const res = await api.get(`/api/editor/source-videos?page=${page}&page_size=${pageSize}`);
    return res.data;
  },
  
  get: async (id: string) => {
    const res = await api.get(`/api/editor/source-videos/${id}`);
    return res.data;
  },
  
  upload: async (file: File, title?: string, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    
    const res = await api.post('/api/editor/source-videos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    });
    return res.data;
  },
  
  delete: async (id: string) => {
    const res = await api.delete(`/api/editor/source-videos/${id}`);
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MUSIC TRACKS API
// ═══════════════════════════════════════════════════════════════════════════════

export const musicTracksApi = {
  list: async (includePresets = true) => {
    const res = await api.get(`/api/editor/music-tracks?include_presets=${includePresets}`);
    return res.data;
  },
  
  generate: async (params: { prompt?: string; mood?: string; duration_seconds?: number; title?: string }) => {
    const res = await api.post('/api/editor/music-tracks/generate', params);
    return res.data;
  },
  
  upload: async (file: File, title?: string, mood?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (mood) formData.append('mood', mood);
    
    const res = await api.post('/api/editor/music-tracks/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  
  delete: async (id: string) => {
    const res = await api.delete(`/api/editor/music-tracks/${id}`);
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT PROJECTS API
// ═══════════════════════════════════════════════════════════════════════════════

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

export const projectsApi = {
  list: async (page = 1, pageSize = 20, status?: string) => {
    let url = `/api/editor/projects?page=${page}&page_size=${pageSize}`;
    if (status) url += `&status=${status}`;
    const res = await api.get(url);
    return res.data;
  },
  
  get: async (id: string) => {
    const res = await api.get(`/api/editor/projects/${id}`);
    return res.data;
  },
  
  create: async (title: string, sourceVideoId: string, config: Partial<ProjectConfig>) => {
    const res = await api.post('/api/editor/projects', {
      title,
      source_video_id: sourceVideoId,
      config,
    });
    return res.data;
  },
  
  update: async (id: string, config: Partial<ProjectConfig>) => {
    const res = await api.patch(`/api/editor/projects/${id}`, config);
    return res.data;
  },
  
  process: async (id: string) => {
    const res = await api.post(`/api/editor/projects/${id}/process`);
    return res.data;
  },
  
  poll: async (id: string) => {
    const res = await api.get(`/api/editor/projects/${id}/poll`);
    return res.data;
  },
  
  delete: async (id: string) => {
    const res = await api.delete(`/api/editor/projects/${id}`);
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUBTITLE STYLES API
// ═══════════════════════════════════════════════════════════════════════════════

export const subtitleStylesApi = {
  list: async () => {
    const res = await api.get('/api/editor/subtitle-styles');
    return res.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC UPLOADS API
// ═══════════════════════════════════════════════════════════════════════════════

export const uploadsApi = {
  directUpload: async (file: File, onProgress?: (progress: number) => void): Promise<UploadItem> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post('/api/upload-direct', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    });

    return res.data;
  },

  startMultipart: async (
    filename: string,
    contentType?: string,
    sizeBytes?: number
  ): Promise<MultipartStartResponse> => {
    const res = await api.post('/api/multipart/start', {
      filename,
      content_type: contentType || 'application/octet-stream',
      size_bytes: sizeBytes,
    });
    return res.data;
  },

  getMultipartPartUrl: async (
    key: string,
    uploadId: string,
    partNumber: number,
    contentType?: string
  ): Promise<PartUrlResponse> => {
    const res = await api.post('/api/multipart/part-url', {
      key,
      upload_id: uploadId,
      part_number: partNumber,
      content_type: contentType,
    });
    return res.data;
  },

  listMultipartParts: async (key: string, uploadId: string): Promise<{ parts?: MultipartListPart[] }> => {
    const res = await api.post('/api/multipart/list-parts', {
      key,
      upload_id: uploadId,
    });
    return res.data;
  },

  completeMultipart: async (
    key: string,
    uploadId: string,
    parts: MultipartListPart[]
  ): Promise<UploadItem> => {
    const res = await api.post('/api/multipart/complete', {
      key,
      upload_id: uploadId,
      parts,
    });
    return res.data;
  },

  abortMultipart: async (key: string, uploadId: string) => {
    const res = await api.post('/api/multipart/abort', {
      key,
      upload_id: uploadId,
    });
    return res.data;
  },
};
