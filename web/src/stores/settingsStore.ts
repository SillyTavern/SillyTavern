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

      // Settings is returned as a JSON string, need to parse it
      let settings: Record<string, unknown> = {};
      if (typeof response.settings === 'string') {
        try {
          settings = JSON.parse(response.settings);
        } catch {
          console.warn('[Settings] Failed to parse settings JSON');
        }
      } else if (response.settings) {
        settings = response.settings as Record<string, unknown>;
      }

      // Extract provider and model from oai_settings (where chat completion settings live)
      const oaiSettings = (settings.oai_settings as Record<string, unknown>) || {};
      const chatCompletionSource = (oaiSettings.chat_completion_source as string) || 'openai';

      // Try to find active model based on provider
      let model = 'gpt-4o';
      if (chatCompletionSource === 'openai') {
        model = (oaiSettings.openai_model as string) || 'gpt-4o';
      } else if (chatCompletionSource === 'claude') {
        model = (oaiSettings.claude_model as string) || 'claude-3-5-sonnet-20241022';
      } else if (chatCompletionSource === 'makersuite') {
        model = (oaiSettings.google_model as string) || 'gemini-1.5-pro';
      }

      console.log('[Settings] Loaded provider:', chatCompletionSource, 'model:', model);

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

      // Delete any existing secrets for this provider first to avoid stale entries
      const { secrets } = get();
      const existingSecrets = secrets[provider.secretKey];
      if (Array.isArray(existingSecrets) && existingSecrets.length > 0) {
        // Delete all existing secrets for this key
        for (const secret of existingSecrets) {
          try {
            await settingsApi.deleteSecret(provider.secretKey, secret.id);
          } catch {
            // Ignore delete errors, continue with save
          }
        }
      }

      // Now save the new secret
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

      // Get current settings first to merge properly
      const response = await settingsApi.getSettings();
      let settings: Record<string, unknown> = {};
      if (typeof response.settings === 'string') {
        try {
          settings = JSON.parse(response.settings);
        } catch {
          settings = {};
        }
      }

      // Update oai_settings with new provider
      const oaiSettings = (settings.oai_settings as Record<string, unknown>) || {};
      oaiSettings.chat_completion_source = provider;

      // Also set the appropriate model for this provider
      if (provider === 'openai') {
        oaiSettings.openai_model = defaultModel;
      } else if (provider === 'claude') {
        oaiSettings.claude_model = defaultModel;
      } else if (provider === 'makersuite') {
        oaiSettings.google_model = defaultModel;
      }

      settings.oai_settings = oaiSettings;

      await settingsApi.saveSettings(settings);

      console.log('[Settings] Saved provider:', provider, 'model:', defaultModel);

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

      // Get current settings first to merge properly
      const response = await settingsApi.getSettings();
      let settings: Record<string, unknown> = {};
      if (typeof response.settings === 'string') {
        try {
          settings = JSON.parse(response.settings);
        } catch {
          settings = {};
        }
      }

      // Update oai_settings with new model
      const oaiSettings = (settings.oai_settings as Record<string, unknown>) || {};

      if (activeProvider === 'openai') {
        oaiSettings.openai_model = model;
      } else if (activeProvider === 'claude') {
        oaiSettings.claude_model = model;
      } else if (activeProvider === 'makersuite') {
        oaiSettings.google_model = model;
      }

      settings.oai_settings = oaiSettings;

      await settingsApi.saveSettings(settings);

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
