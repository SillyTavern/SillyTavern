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
    return apiRequest('/api/users/create', {
      method: 'POST',
      body: JSON.stringify({ handle, name, password, admin: false }),
    });
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
  async getCharacters(): Promise<string[]> {
    const response = await apiRequest<{ characters: string[] }>('/api/characters/all');
    return response.characters || [];
  },

  async getCharacter(name: string): Promise<Record<string, unknown>> {
    return apiRequest(`/api/characters/get`, {
      method: 'POST',
      body: JSON.stringify({ name, avatar_url: `${name}.png` }),
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

  // Generate message (simplified for POC)
  async generateMessage(prompt: string, _characterName: string): Promise<ReadableStream<Uint8Array> | null> {
    const token = await getCsrfToken();

    const response = await fetch('/api/backends/chat-completions/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
      },
      credentials: 'include',
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });

    return response.body;
  },
};

interface ChatMessage {
  name: string;
  is_user: boolean;
  is_system: boolean;
  mes: string;
  send_date: number;
}
