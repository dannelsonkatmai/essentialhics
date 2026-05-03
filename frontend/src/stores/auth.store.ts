import { create } from 'zustand';
import { setAccessToken } from '../api/client';
import type { AuthUser } from '../types';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: AuthUser | null, token?: string) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user, token) => {
    if (token) setAccessToken(token);
    set({ user, isAuthenticated: !!user, isLoading: false });
  },

  setLoading: (isLoading) => set({ isLoading }),

  logout: () => {
    setAccessToken(null);
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
}));
