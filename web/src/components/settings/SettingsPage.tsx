import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Eye, EyeOff, Key, Loader2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../../stores/settingsStore';
import { PROVIDERS, type SecretState } from '../../api/client';
import { Button, Input } from '../ui';

export function SettingsPage() {
  const navigate = useNavigate();
  const {
    secrets,
    activeProvider,
    activeModel,
    isLoading,
    isSaving,
    error,
    successMessage,
    fetchSecrets,
    fetchSettings,
    saveApiKey,
    deleteApiKey,
    setActiveProvider,
    setActiveModel,
    clearMessages,
  } = useSettingsStore();

  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchSecrets();
    fetchSettings();
  }, [fetchSecrets, fetchSettings]);

  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(clearMessages, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error, clearMessages]);

  const handleSaveApiKey = async (providerId: string) => {
    const key = apiKeyInputs[providerId];
    if (!key?.trim()) return;

    await saveApiKey(providerId, key.trim());
    setApiKeyInputs((prev) => ({ ...prev, [providerId]: '' }));
  };

  const hasApiKey = (secretKey: string): boolean => {
    const secretData = secrets[secretKey];
    if (Array.isArray(secretData)) {
      return secretData.length > 0;
    }
    return false;
  };

  const getSecretInfo = (secretKey: string): SecretState | null => {
    const secretData = secrets[secretKey];
    if (Array.isArray(secretData) && secretData.length > 0) {
      return secretData.find((s) => s.active) || secretData[0];
    }
    return null;
  };

  const currentProvider = PROVIDERS.find((p) => p.id === activeProvider);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* Header */}
      <header className="h-14 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] flex items-center px-4 gap-3 safe-top">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="p-2"
          aria-label="Back"
        >
          <ArrowLeft size={24} />
        </Button>
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
          AI Settings
        </h1>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Status Messages */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-400">{successMessage}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
          </div>
        ) : (
          <>
            {/* Active Provider Selection */}
            <section className="bg-[var(--color-bg-secondary)] rounded-lg p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                Active Provider
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PROVIDERS.map((provider) => {
                  const configured = hasApiKey(provider.secretKey);
                  const isActive = activeProvider === provider.id;

                  return (
                    <button
                      key={provider.id}
                      onClick={() => setActiveProvider(provider.id)}
                      disabled={isSaving}
                      className={`
                        relative p-3 rounded-lg text-left transition-all
                        ${isActive
                          ? 'bg-[var(--color-primary)] text-white'
                          : configured
                            ? 'bg-[var(--color-bg-tertiary)] hover:bg-zinc-700'
                            : 'bg-[var(--color-bg-tertiary)] opacity-50'
                        }
                      `}
                    >
                      <span className="text-sm font-medium">{provider.name}</span>
                      {configured && (
                        <Check
                          size={14}
                          className={`absolute top-2 right-2 ${isActive ? 'text-white' : 'text-green-400'}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              {!hasApiKey(currentProvider?.secretKey || '') && (
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  Configure an API key below to use this provider
                </p>
              )}
            </section>

            {/* Model Selection */}
            {currentProvider && (
              <section className="bg-[var(--color-bg-secondary)] rounded-lg p-4">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                  Model
                </h2>
                <select
                  value={activeModel}
                  onChange={(e) => setActiveModel(e.target.value)}
                  disabled={isSaving}
                  className="w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  {currentProvider.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </section>
            )}

            {/* API Keys Configuration */}
            <section className="bg-[var(--color-bg-secondary)] rounded-lg p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                API Keys
              </h2>
              <div className="space-y-4">
                {PROVIDERS.map((provider) => {
                  const secretInfo = getSecretInfo(provider.secretKey);
                  const configured = !!secretInfo;
                  const inputValue = apiKeyInputs[provider.id] || '';
                  const showKey = showApiKey[provider.id] || false;

                  return (
                    <div
                      key={provider.id}
                      className="p-3 bg-[var(--color-bg-tertiary)] rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Key size={16} className="text-[var(--color-text-secondary)]" />
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">
                            {provider.name}
                          </span>
                        </div>
                        {configured && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-green-400">Configured</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteApiKey(provider.secretKey)}
                              disabled={isSaving}
                              className="p-1 text-red-400 hover:text-red-300"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Input
                            type={showKey ? 'text' : 'password'}
                            value={inputValue}
                            onChange={(e) =>
                              setApiKeyInputs((prev) => ({
                                ...prev,
                                [provider.id]: e.target.value,
                              }))
                            }
                            placeholder={
                              configured
                                ? 'Enter new key to replace...'
                                : 'Enter API key...'
                            }
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowApiKey((prev) => ({
                                ...prev,
                                [provider.id]: !prev[provider.id],
                              }))
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                          >
                            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <Button
                          onClick={() => handleSaveApiKey(provider.id)}
                          disabled={!inputValue.trim() || isSaving}
                          className="shrink-0"
                        >
                          {isSaving ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            'Save'
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Help Text */}
            <section className="text-center py-4">
              <p className="text-xs text-[var(--color-text-secondary)]">
                API keys are stored securely on the server and never exposed to the frontend.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
