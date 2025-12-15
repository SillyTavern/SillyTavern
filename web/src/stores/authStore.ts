import { create } from 'zustand';
import { api, type UserInfo } from '../api/client';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser: { handle: string; name: string } | null;
  availableUsers: UserInfo[];
  error: string | null;
  canSelfRegister: boolean;

  // Actions
  checkAuth: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  checkRegistration: () => Promise<void>;
  register: (handle: string, name: string, password?: string) => Promise<boolean>;
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
  canSelfRegister: false,

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
      const users = await api.getUsers();
      set({ availableUsers: users });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch users' });
    }
  },

  checkRegistration: async () => {
    try {
      const result = await api.checkCanRegister();
      set({ canSelfRegister: result.canRegister });
    } catch {
      set({ canSelfRegister: false });
    }
  },

  register: async (handle: string, name: string, password?: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.register(handle, name, password);
      // After successful registration, log the user in
      const loginResult = await api.login(result.handle, password);
      set({
        isAuthenticated: true,
        currentUser: { handle: loginResult.handle, name },
        isLoading: false,
      });
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      });
      return false;
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
