import { create } from 'zustand';
import { settingsApi, PROVIDERS, type SecretsResponse } from '../api/client';

interface SettingsState {
  secrets: SecretsResponse;
  activeProvider: string;
  activeModel: string;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;

  // Actions
  fetchSecrets: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  saveApiKey: (provider: string, apiKey: string) => Promise<void>;
  deleteApiKey: (secretKey: string) => Promise<void>;
  setActiveProvider: (provider: string) => Promise<void>;
  setActiveModel: (model: string) => Promise<void>;
  clearMessages: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  secrets: {},
  activeProvider: 'openai',
  activeModel: 'gpt-4o',
  isLoading: false,
  isSaving: false,
  error: null,
  successMessage: null,

  fetchSecrets: async () => {
    set({ isLoading: true, error: null });
    try {
      const secrets = await settingsApi.getSecrets();
      set({ secrets, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch secrets',
      });
    }
  },

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await settingsApi.getSettings();
      const settings = response.settings || {};

      // Extract provider and model from settings
      const mainApi = (settings.main_api as string) || 'openai';
      const chatCompletionSource = (settings.chat_completion_source as string) || mainApi;

      // Try to find active model based on provider
      let model = 'gpt-4o';
      if (chatCompletionSource === 'openai') {
        model = (settings.oai_settings as Record<string, unknown>)?.openai_model as string || 'gpt-4o';
      } else if (chatCompletionSource === 'claude') {
        model = (settings.oai_settings as Record<string, unknown>)?.claude_model as string || 'claude-sonnet-4-5-20250929';
      }

      set({
        activeProvider: chatCompletionSource,
        activeModel: model,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch settings',
      });
    }
  },

  saveApiKey: async (providerId: string, apiKey: string) => {
    set({ isSaving: true, error: null, successMessage: null });
    try {
      const provider = PROVIDERS.find((p) => p.id === providerId);
      if (!provider) {
        throw new Error('Unknown provider');
      }

      await settingsApi.writeSecret(provider.secretKey, apiKey, provider.name);

      // Refresh secrets
      await get().fetchSecrets();

      set({
        isSaving: false,
        successMessage: `${provider.name} API key saved successfully`,
      });
    } catch (error) {
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to save API key',
      });
    }
  },

  deleteApiKey: async (secretKey: string) => {
    set({ isSaving: true, error: null, successMessage: null });
    try {
      await settingsApi.deleteSecret(secretKey);
      await get().fetchSecrets();
      set({
        isSaving: false,
        successMessage: 'API key deleted',
      });
    } catch (error) {
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to delete API key',
      });
    }
  },

  setActiveProvider: async (provider: string) => {
    set({ isSaving: true, error: null });
    try {
      const providerInfo = PROVIDERS.find((p) => p.id === provider);
      const defaultModel = providerInfo?.models[0] || 'gpt-4o';

      await settingsApi.saveSettings({
        main_api: 'chat_completions',
        chat_completion_source: provider,
      });

      set({
        activeProvider: provider,
        activeModel: defaultModel,
        isSaving: false,
      });
    } catch (error) {
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to save provider',
      });
    }
  },

  setActiveModel: async (model: string) => {
    set({ isSaving: true, error: null });
    try {
      const { activeProvider } = get();

      // Build the settings object based on provider
      const settingsUpdate: Record<string, unknown> = {};

      if (activeProvider === 'openai') {
        settingsUpdate.oai_settings = { openai_model: model };
      } else if (activeProvider === 'claude') {
        settingsUpdate.oai_settings = { claude_model: model };
      }
      // Add more provider-specific model settings as needed

      await settingsApi.saveSettings(settingsUpdate);

      set({ activeModel: model, isSaving: false });
    } catch (error) {
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to save model',
      });
    }
  },

  clearMessages: () => set({ error: null, successMessage: null }),
}));
