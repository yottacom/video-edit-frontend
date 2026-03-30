// Debug Store - Tracks all API calls with localStorage persistence
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ApiCall {
  id: string;
  timestamp: string; // ISO string for serialization
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: any;
  status?: number;
  responseBody?: any;
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

export const useDebugStore = create<DebugState>()(
  persist(
    (set, get) => ({
      calls: [],
      isOpen: false,
      
      addCall: (call) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({
          calls: [
            { ...call, id, timestamp: new Date().toISOString() },
            ...state.calls.slice(0, 99), // Keep last 100 calls
          ],
        }));
        return id;
      },
      
      updateCall: (id, update) => {
        set((state) => ({
          calls: state.calls.map((call) =>
            call.id === id ? { ...call, ...update } : call
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
    }
  )
);
