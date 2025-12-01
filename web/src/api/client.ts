// API Client for SillyTavern backend

let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  const response = await fetch('/csrf-token');
  const data = await response.json();
  csrfToken = data.token;
  return csrfToken!;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getCsrfToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token,
    ...options.headers,
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) return {} as T;

  return JSON.parse(text);
}

export interface UserInfo {
  handle: string;
  name: string;
  avatar: string;
  password: boolean; // true if user has a password set
  created?: number;
}

export interface CharacterInfo {
  name: string;
  avatar: string; // filename like "CharacterName.png"
  description?: string;
  personality?: string;
  first_mes?: string;
  scenario?: string;
  create_date?: string;
  date_added?: number;
  date_last_chat?: number;
  chat_size?: number;
  fav?: boolean;
  tags?: string[];
  data?: {
    name?: string;
    description?: string;
    personality?: string;
    first_mes?: string;
    scenario?: string;
    creator_notes?: string;
    creator?: string;
  };
}

export const api = {
  // Auth endpoints
  async getUsers(): Promise<UserInfo[]> {
    const response = await apiRequest<UserInfo[] | undefined>('/api/users/list', {
      method: 'POST',
    });
    // Returns array directly, or empty array if 204 (discreet login)
    return response || [];
  },

  async login(handle: string, password?: string): Promise<{ handle: string }> {
    return apiRequest('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ handle, password }),
    });
  },

  async logout(): Promise<void> {
    await apiRequest('/api/users/logout', { method: 'POST' });
  },

  async getCurrentUser(): Promise<{ handle: string; name: string } | null> {
    try {
      return await apiRequest('/api/users/me');
    } catch {
      return null;
    }
  },

  async register(handle: string, name: string, password?: string): Promise<{ handle: string }> {
    // Registration requires admin. For first-time setup, we need to:
    // 1. Login as default-user (auto-created, no password, is admin)
    // 2. Create the new user as admin
    // 3. Return success

    // First, try to login as default-user to get admin access
    try {
      await apiRequest('/api/users/login', {
        method: 'POST',
        body: JSON.stringify({ handle: 'default-user', password: '' }),
      });
    } catch (e) {
      // If default-user login fails, we can't bootstrap
      throw new Error('Cannot register: Please login as an admin user first');
    }

    // Now create the new user (we're logged in as default-user/admin)
    const result = await apiRequest<{ handle: string }>('/api/users/create', {
      method: 'POST',
      body: JSON.stringify({ handle, name, password, admin: true }), // Make first real user an admin
    });

    // Logout default-user
    try {
      await apiRequest('/api/users/logout', { method: 'POST' });
    } catch {
      // Ignore logout errors
    }

    return result;
  },

  async checkCanRegister(): Promise<{ canRegister: boolean; requiresAdmin: boolean }> {
    try {
      // Check if there are existing users
      const users = await this.getUsers();
      // Only the default-user exists (auto-created) = allow registration as first "real" user
      const onlyDefaultUser = users.length === 1 && users[0].handle === 'default-user';
      const noUsers = users.length === 0;
      return {
        canRegister: noUsers || onlyDefaultUser,
        requiresAdmin: !noUsers && !onlyDefaultUser
      };
    } catch {
      // If we can't fetch users, assume registration requires admin
      return { canRegister: false, requiresAdmin: true };
    }
  },

  // Character endpoints
  async getCharacters(): Promise<CharacterInfo[]> {
    // Returns array of character objects directly
    const response = await apiRequest<CharacterInfo[]>('/api/characters/all', {
      method: 'POST',
    });
    return response || [];
  },

  async getCharacter(avatarUrl: string): Promise<CharacterInfo> {
    return apiRequest('/api/characters/get', {
      method: 'POST',
      body: JSON.stringify({ avatar_url: avatarUrl }),
    });
  },

  // Chat endpoints
  async getChats(characterName: string): Promise<{ file_name: string; file_size: number; last_mes: string }[]> {
    return apiRequest('/api/characters/chats', {
      method: 'POST',
      body: JSON.stringify({ avatar_url: `${characterName}.png` }),
    });
  },

  async getChatMessages(characterName: string, fileName: string): Promise<ChatMessage[]> {
    const response = await apiRequest<{ messages: ChatMessage[] }>('/api/chats/get', {
      method: 'POST',
      body: JSON.stringify({
        ch_name: characterName,
        file_name: fileName,
        avatar_url: `${characterName}.png`,
      }),
    });
    return response.messages || [];
  },

  // Generate message with full context
  async generateMessage(
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    _characterName: string,
    provider?: string,
    model?: string
  ): Promise<ReadableStream<Uint8Array> | null> {
    const token = await getCsrfToken();

    const response = await fetch('/api/backends/chat-completions/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
      },
      credentials: 'include',
      body: JSON.stringify({
        messages,
        stream: true,
        max_tokens: 1024,
        temperature: 0.9,
        chat_completion_source: provider || 'openai',
        model: model || 'gpt-4o',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Generation failed' }));
      // Handle various SillyTavern error formats
      const errorMessage =
        typeof errorData.error === 'string'
          ? errorData.error
          : errorData.message ||
            errorData.error?.message ||
            (errorData.error === true ? 'AI generation failed - check API key configuration' : `HTTP ${response.status}`);
      throw new Error(errorMessage);
    }

    return response.body;
  },

  // Save chat to backend
  async saveChat(
    characterName: string,
    fileName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatData: any[]
  ): Promise<void> {
    await apiRequest('/api/chats/save', {
      method: 'POST',
      body: JSON.stringify({
        avatar_url: `${characterName}.png`,
        file_name: fileName,
        chat: chatData,
      }),
    });
  },

  // Create a new chat file name (without .jsonl extension - backend adds it)
  async createChat(characterName: string): Promise<string> {
    const timestamp = Date.now();
    const fileName = `${characterName} - ${new Date(timestamp).toISOString().split('T')[0]}@${timestamp}`;
    return fileName;
  },
};

interface ChatMessage {
  name: string;
  is_user: boolean;
  is_system: boolean;
  mes: string;
  send_date: number;
}

// Settings types
export interface SecretState {
  id: string;
  label: string;
  active: boolean;
  // value is masked - only last 3 chars shown
}

export interface SecretsResponse {
  [key: string]: SecretState[] | boolean;
}

export const SECRET_KEYS = {
  OPENAI: 'api_key_openai',
  CLAUDE: 'api_key_claude',
  GOOGLE: 'api_key_makersuite',
  MISTRAL: 'api_key_mistralai',
  GROQ: 'api_key_groq',
  OPENROUTER: 'api_key_openrouter',
  COHERE: 'api_key_cohere',
} as const;

export const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', secretKey: SECRET_KEYS.OPENAI, models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'claude', name: 'Claude', secretKey: SECRET_KEYS.CLAUDE, models: ['claude-sonnet-4-5-20250929', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'] },
  { id: 'makersuite', name: 'Google Gemini', secretKey: SECRET_KEYS.GOOGLE, models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'mistralai', name: 'Mistral AI', secretKey: SECRET_KEYS.MISTRAL, models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'] },
  { id: 'groq', name: 'Groq', secretKey: SECRET_KEYS.GROQ, models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'] },
  { id: 'openrouter', name: 'OpenRouter', secretKey: SECRET_KEYS.OPENROUTER, models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-pro-1.5'] },
] as const;

export const settingsApi = {
  // Get current secrets state (masked)
  async getSecrets(): Promise<SecretsResponse> {
    return apiRequest('/api/secrets/read', { method: 'POST' });
  },

  // Write/update a secret
  async writeSecret(key: string, value: string, label?: string): Promise<void> {
    await apiRequest('/api/secrets/write', {
      method: 'POST',
      body: JSON.stringify({ key, value, label }),
    });
  },

  // Delete a secret
  async deleteSecret(key: string, id?: string): Promise<void> {
    await apiRequest('/api/secrets/delete', {
      method: 'POST',
      body: JSON.stringify({ key, id }),
    });
  },

  // Get user settings
  async getSettings(): Promise<{ settings: Record<string, unknown> }> {
    return apiRequest('/api/settings/get', { method: 'POST' });
  },

  // Save user settings
  async saveSettings(settings: Record<string, unknown>): Promise<void> {
    await apiRequest('/api/settings/save', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },
};
