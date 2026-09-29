import { create } from 'zustand';

type Status = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface SocketState {
  status: Status;
  error: string | null;
  setStatus: (s: Status) => void;
  setError: (e: string | null) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  status: 'idle',
  error: null,
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
}));
