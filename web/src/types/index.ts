// User types
export interface User {
  handle: string;
  name: string;
  admin: boolean;
  avatar?: string;
}

// Character types
export interface Character {
  name: string;
  avatar: string;
  description?: string;
  personality?: string;
  first_mes?: string;
  scenario?: string;
  create_date?: string;
}

// Chat types
export interface ChatMessage {
  name: string;
  is_user: boolean;
  is_system: boolean;
  mes: string;
  send_date: number;
  extra?: {
    gen_id?: string;
    api?: string;
    model?: string;
  };
}

export interface Chat {
  user_name: string;
  character_name: string;
  create_date: string;
  chat_metadata: Record<string, unknown>;
}

// API Response types
export interface ApiError {
  error: string;
  message?: string;
}

export interface LoginResponse {
  handle: string;
  name: string;
}

export interface CharacterListResponse {
  characters: string[];
}
