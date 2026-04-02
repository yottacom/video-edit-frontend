// Debug Store - Tracks all API calls with localStorage persistence
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ApiCall {
  id: string;
  timestamp: string; // ISO string for serialization
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  status?: number;
  responseBody?: unknown;
  error?: string;
  duration?: number;
}

interface DebugState {
  calls: ApiCall[];
  isOpen: boolean;
  addCall: (call: Omit<ApiCall, 'id' | 'timestamp'>) => string;
  updateCall: (id: string, update: Partial<ApiCall>) => void;
  clearCalls: () => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
}

// Helper to truncate large data to prevent localStorage quota issues
function truncateForStorage(data: unknown, maxSize: number = 10000): unknown {
  if (!data) return data;

  const jsonString = JSON.stringify(data);
  if (jsonString.length <= maxSize) return data;

  // For large objects, truncate or summarize
  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      // For arrays, keep only first few items
      return data.slice(0, 3).map(item => truncateForStorage(item, maxSize / 3));
    } else {
      // For objects, keep only essential fields and truncate large values
      const truncated: Record<string, unknown> = {};
      Object.entries(data).forEach(([key, value]) => {
        if (key.toLowerCase().includes('data') || key.toLowerCase().includes('content')) {
          // Truncate large data fields
          truncated[key] = typeof value === 'string' && value.length > 100
            ? `${value.substring(0, 100)}... [truncated ${value.length - 100} chars]`
            : truncateForStorage(value, maxSize / Object.keys(data).length);
        } else {
          truncated[key] = truncateForStorage(value, maxSize / Object.keys(data).length);
        }
      });
      return truncated;
    }
  }

  // For strings, truncate if too long
  if (typeof data === 'string' && data.length > 200) {
    return `${data.substring(0, 200)}... [truncated ${data.length - 200} chars]`;
  }

  return data;
}

export const useDebugStore = create<DebugState>()(
  persist(
    (set) => ({
      calls: [],
      isOpen: false,
      
      addCall: (call) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({
          calls: [
            {
              ...call,
              id,
              timestamp: new Date().toISOString(),
              requestBody: truncateForStorage(call.requestBody),
            },
            ...state.calls.slice(0, 49), // Keep last 50 calls instead of 100
          ],
        }));
        return id;
      },
      
      updateCall: (id, update) => {
        set((state) => ({
          calls: state.calls.map((call) =>
            call.id === id ? {
              ...call,
              ...update,
              responseBody: update.responseBody ? truncateForStorage(update.responseBody) : call.responseBody,
            } : call
          ),
        }));
      },
      
      clearCalls: () => set({ calls: [] }),
      toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
      setOpen: (open) => set({ isOpen: open }),
    }),
    {
      name: 'video-edit-debug', // localStorage key
      partialize: (state) => ({ calls: state.calls }), // Only persist calls, not isOpen
      // Handle storage errors gracefully
      storage: {
        getItem: (name) => {
          try {
            const item = localStorage.getItem(name);
            return item ? JSON.parse(item) : null;
          } catch (error) {
            console.warn('Failed to read from localStorage:', error);
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (error) {
            console.warn('Failed to write to localStorage (quota exceeded):', error);
            // Storage failed, but the store will continue to work in memory
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch (error) {
            console.warn('Failed to remove from localStorage:', error);
          }
        },
      },
    }
  )
);
