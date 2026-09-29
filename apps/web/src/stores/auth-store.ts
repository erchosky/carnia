import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthTokens, PublicUser } from '@carnia/contracts';

interface AuthState {
  user: PublicUser | null;
  tokens: AuthTokens | null;
  hydrated: boolean;
  setSession: (user: PublicUser, tokens: AuthTokens) => void;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: PublicUser) => void;
  clear: () => void;
  markHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      hydrated: false,
      setSession: (user, tokens) => set({ user, tokens }),
      setTokens: (tokens) => set({ tokens }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, tokens: null }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'carnia-auth',
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
