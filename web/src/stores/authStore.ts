import { create } from 'zustand';
import { api } from '../api/client';

interface UserHandle {
  handle: string;
  name: string;
  avatar: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser: { handle: string; name: string } | null;
  availableUsers: UserHandle[];
  error: string | null;

  // Actions
  checkAuth: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  login: (handle: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  currentUser: null,
  availableUsers: [],
  error: null,

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const user = await api.getCurrentUser();
      if (user) {
        set({ isAuthenticated: true, currentUser: user, isLoading: false });
      } else {
        set({ isAuthenticated: false, currentUser: null, isLoading: false });
      }
    } catch {
      set({ isAuthenticated: false, currentUser: null, isLoading: false });
    }
  },

  fetchUsers: async () => {
    try {
      const response = await api.getUsers();
      set({ availableUsers: response.handles || [] });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch users' });
    }
  },

  login: async (handle: string, password?: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.login(handle, password);
      set({
        isAuthenticated: true,
        currentUser: { handle: result.handle, name: result.handle },
        isLoading: false,
      });
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      });
      return false;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } finally {
      set({ isAuthenticated: false, currentUser: null });
    }
  },

  clearError: () => set({ error: null }),
}));
