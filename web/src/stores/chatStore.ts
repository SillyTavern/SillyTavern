import { create } from 'zustand';
import { api, type CharacterInfo } from '../api/client';
import { useSettingsStore } from './settingsStore';

interface ChatMessage {
  id: string;
  name: string;
  isUser: boolean;
  isSystem: boolean;
  content: string;
  timestamp: number;
}

interface ChatFile {
  fileName: string;
  fileSize: number;
  lastMessage: string;
}

interface ChatState {
  messages: ChatMessage[];
  chatFiles: ChatFile[];
  currentChatFile: string | null;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  // Actions
  fetchChatFiles: (avatarUrl: string) => Promise<void>;
  loadChat: (avatarUrl: string, fileName: string) => Promise<void>;
  startNewChat: (character: CharacterInfo) => Promise<void>;
  addMessage: (message: Omit<ChatMessage, 'id'>) => void;
  sendMessage: (content: string, character: CharacterInfo) => Promise<void>;
  clearChat: () => void;
}

let messageIdCounter = 0;
const generateId = () => `msg_${++messageIdCounter}_${Date.now()}`;

// Parse SSE stream and extract content tokens
async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // Process complete lines (SSE uses \n\n as delimiter, but we split by \n)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);

          // Skip empty data
          if (!data || data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);

            // Handle different response formats from various providers
            const content =
              // OpenAI streaming format
              json.choices?.[0]?.delta?.content ||
              // Text completion format
              json.choices?.[0]?.text ||
              // Claude/Anthropic streaming format
              json.delta?.text ||
              // Claude content block delta
              (json.type === 'content_block_delta' ? json.delta?.text : null) ||
              // Simple content field
              json.content ||
              // Message content array (Claude)
              json.message?.content?.[0]?.text ||
              '';

            if (content) {
              yield content;
            }
          } catch {
            // Non-JSON data line, might be raw text - yield it directly
            if (data.length > 0 && data !== 'undefined') {
              yield data;
            }
          }
        } else if (!trimmed.startsWith(':') && !trimmed.startsWith('event:')) {
          // Not a comment or event line - might be raw text response
          // Some backends return plain text without SSE formatting
          if (trimmed.length > 0) {
            yield trimmed;
          }
        }
      }
    }

    // Process any remaining buffer content
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data: ')) {
        const data = trimmed.slice(6);
        if (data && data !== '[DONE]') {
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content ||
                           json.choices?.[0]?.text ||
                           json.delta?.text ||
                           json.content || '';
            if (content) yield content;
          } catch {
            yield data;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Build conversation context for AI
function buildConversationContext(
  messages: ChatMessage[],
  character: CharacterInfo
): { role: 'user' | 'assistant' | 'system'; content: string }[] {
  const context: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];

  // Add character system prompt
  const systemPrompt = [
    character.description && `Description: ${character.description}`,
    character.personality && `Personality: ${character.personality}`,
    character.scenario && `Scenario: ${character.scenario}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  if (systemPrompt) {
    context.push({
      role: 'system',
      content: `You are ${character.name}. Stay in character.\n\n${systemPrompt}`,
    });
  }

  // Add conversation history (last 20 messages to avoid token limits)
  const recentMessages = messages.slice(-20);
  for (const msg of recentMessages) {
    if (msg.isSystem) continue;
    context.push({
      role: msg.isUser ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  return context;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  chatFiles: [],
  currentChatFile: null,
  isLoading: false,
  isSending: false,
  error: null,

  fetchChatFiles: async (avatarUrl: string) => {
    set({ isLoading: true, error: null });
    try {
      const chats = await api.getChats(avatarUrl);
      console.log('[Chat] Fetched chat files for', avatarUrl, ':', chats);
      const chatFiles: ChatFile[] = chats.map((chat) => ({
        // Strip .jsonl extension - backend adds it when loading/saving
        fileName: chat.file_name?.replace(/\.jsonl$/, '') || chat.file_name,
        fileSize: chat.file_size,
        lastMessage: chat.last_mes,
      }));
      console.log('[Chat] Processed chat files:', chatFiles);
      set({ chatFiles, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch chats',
      });
    }
  },

  loadChat: async (avatarUrl: string, fileName: string) => {
    console.log('[Chat] Loading chat:', avatarUrl, fileName);
    set({ isLoading: true, error: null, currentChatFile: fileName });
    try {
      const rawMessages = await api.getChatMessages(avatarUrl, fileName);
      console.log('[Chat] Loaded messages:', rawMessages?.length || 0);
      const messages: ChatMessage[] = rawMessages.map((msg) => ({
        id: generateId(),
        name: msg.name,
        isUser: msg.is_user,
        isSystem: msg.is_system,
        content: msg.mes,
        timestamp: msg.send_date,
      }));
      set({ messages, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load chat',
      });
    }
  },

  startNewChat: async (character: CharacterInfo) => {
    const messages: ChatMessage[] = [];

    // Add character's first message if available
    if (character.first_mes) {
      messages.push({
        id: generateId(),
        name: character.name,
        isUser: false,
        isSystem: false,
        content: character.first_mes,
        timestamp: Date.now(),
      });
    }

    const fileName = await api.createChat(character.name);
    console.log('[Chat] Starting new chat, fileName:', fileName);
    set({
      messages,
      currentChatFile: fileName,
      error: null,
    });
  },

  addMessage: (message) => {
    const newMessage: ChatMessage = {
      ...message,
      id: generateId(),
    };
    set((state) => ({ messages: [...state.messages, newMessage] }));
  },

  sendMessage: async (content: string, character: CharacterInfo) => {
    const { addMessage } = get();

    // Add user message
    addMessage({
      name: 'You',
      isUser: true,
      isSystem: false,
      content,
      timestamp: Date.now(),
    });

    set({ isSending: true, error: null });

    try {
      // Build conversation context
      const updatedMessages = get().messages;
      const context = buildConversationContext(updatedMessages, character);

      // Get AI provider settings
      const { activeProvider, activeModel } = useSettingsStore.getState();

      // Debug: log what provider we're using
      console.log('[Chat] Using provider:', activeProvider, 'model:', activeModel);

      if (!activeProvider || activeProvider === 'openai') {
        // Check if we actually have the provider configured
        const { secrets } = useSettingsStore.getState();
        const hasOpenAI = Array.isArray(secrets['api_key_openai']) && secrets['api_key_openai'].length > 0;
        const hasClaude = Array.isArray(secrets['api_key_claude']) && secrets['api_key_claude'].length > 0;

        if (!hasOpenAI && hasClaude) {
          // User has Claude but not OpenAI, auto-switch
          console.log('[Chat] Auto-switching to Claude since OpenAI is not configured');
          useSettingsStore.setState({ activeProvider: 'claude', activeModel: 'claude-3-5-sonnet-20241022' });
        }
      }

      // Re-get the settings in case we auto-switched
      const finalProvider = useSettingsStore.getState().activeProvider;
      const finalModel = useSettingsStore.getState().activeModel;

      // Call API
      const stream = await api.generateMessage(context, character.name, finalProvider, finalModel);

      if (stream) {
        // Add initial AI message placeholder
        const aiMessageId = generateId();
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: aiMessageId,
              name: character.name,
              isUser: false,
              isSystem: false,
              content: '',
              timestamp: Date.now(),
            },
          ],
        }));

        // Stream the response using SSE parser
        let responseText = '';
        for await (const token of parseSSEStream(stream)) {
          responseText += token;
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === aiMessageId ? { ...msg, content: responseText } : msg
            ),
          }));
        }

        // Save chat to backend
        const { currentChatFile } = get();
        console.log('[Chat] Saving chat, currentChatFile:', currentChatFile);

        if (currentChatFile) {
          const allMessages = get().messages;
          console.log('[Chat] Messages to save:', allMessages.length);

          // Build chat data with header as first entry
          const chatData = [
            // Header/metadata (required first entry)
            {
              user_name: 'You',
              character_name: character.name,
              create_date: new Date().toISOString(),
            },
            // Messages
            ...allMessages.map((msg) => ({
              name: msg.name,
              is_user: msg.isUser,
              is_system: msg.isSystem,
              mes: msg.content,
              send_date: msg.timestamp,
            })),
          ];

          console.log('[Chat] Saving to:', character.avatar, currentChatFile);
          try {
            await api.saveChat(character.avatar, currentChatFile, chatData);
            console.log('[Chat] Save successful');
          } catch (err) {
            console.error('[Chat] Failed to save:', err);
          }
        } else {
          console.warn('[Chat] No currentChatFile set, cannot save');
        }
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to send message' });
    } finally {
      set({ isSending: false });
    }
  },

  clearChat: () => set({ messages: [], chatFiles: [], currentChatFile: null }),
}));
