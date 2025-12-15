import { create } from 'zustand';
import { api, type CharacterInfo } from '../api/client';
import { useSettingsStore } from './settingsStore';
import { parseEmotion, stripEmotionTag, type Emotion } from '../utils/emotions';

interface ChatMessage {
  id: string;
  name: string;
  isUser: boolean;
  isSystem: boolean;
  content: string;
  timestamp: number;
  emotion?: Emotion | null;
  // For group chat - track which character's avatar to use
  characterAvatar?: string;
}

interface ChatFile {
  fileName: string;
  fileSize: number;
  lastMessage: string;
}

export interface GroupChatInfo {
  fileName: string;
  characterNames: string[];
  characterAvatars: string[];
  lastMessage: string;
  createdAt: number;
}

// Local storage key for group chat metadata
const GROUP_CHATS_KEY = 'sillytavern_group_chats';

// Load group chats from localStorage
function loadGroupChatsFromStorage(): GroupChatInfo[] {
  try {
    const stored = localStorage.getItem(GROUP_CHATS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save group chats to localStorage
function saveGroupChatsToStorage(groupChats: GroupChatInfo[]) {
  localStorage.setItem(GROUP_CHATS_KEY, JSON.stringify(groupChats));
}

interface ChatState {
  messages: ChatMessage[];
  chatFiles: ChatFile[];
  groupChats: GroupChatInfo[];
  currentChatFile: string | null;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  // Actions
  fetchChatFiles: (avatarUrl: string) => Promise<void>;
  loadChat: (avatarUrl: string, fileName: string) => Promise<void>;
  loadGroupChat: (groupChat: GroupChatInfo) => Promise<void>;
  startNewChat: (character: CharacterInfo) => Promise<void>;
  startNewGroupChat: (characters: CharacterInfo[]) => Promise<void>;
  addMessage: (message: Omit<ChatMessage, 'id'>) => void;
  sendMessage: (content: string, character: CharacterInfo, availableEmotions?: string[]) => Promise<void>;
  sendGroupMessage: (content: string, characters: CharacterInfo[]) => Promise<void>;
  editMessageAndRegenerate: (messageId: string, newContent: string, character: CharacterInfo, availableEmotions?: string[]) => Promise<void>;
  clearChat: () => void;
  refreshGroupChats: () => void;
  deleteGroupChat: (fileName: string) => void;
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
  character: CharacterInfo,
  availableEmotions?: string[]
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

  // Emotion tag instruction - use available emotions if provided, otherwise give guidance
  const emotionList = availableEmotions && availableEmotions.length > 0
    ? availableEmotions.join(', ')
    : 'neutral (or any emotion that fits the moment)';

  const emotionInstruction = `
IMPORTANT: Begin each response with an emotion tag that reflects your current emotional state. Use this exact format: [emotion:TAG]

Available emotions for this character: ${emotionList}

Example: [emotion:joy] I'm so glad you asked about that!

Choose the emotion that best matches how ${character.name} would feel based on the conversation context.`.trim();

  if (systemPrompt) {
    context.push({
      role: 'system',
      content: `You are ${character.name}. Stay in character.\n\n${systemPrompt}\n\n${emotionInstruction}`,
    });
  } else {
    context.push({
      role: 'system',
      content: `You are ${character.name}. Stay in character.\n\n${emotionInstruction}`,
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

// Build conversation context for group chat AI
function buildGroupConversationContext(
  messages: ChatMessage[],
  characters: CharacterInfo[],
  currentCharacter: CharacterInfo
): { role: 'user' | 'assistant' | 'system'; content: string }[] {
  const context: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];

  // Build character descriptions for all participants
  const characterDescriptions = characters.map((char) => {
    const details = [
      char.description && `Description: ${char.description}`,
      char.personality && `Personality: ${char.personality}`,
    ].filter(Boolean).join(' ');
    return `- ${char.name}: ${details || 'A character in the conversation'}`;
  }).join('\n');

  // System prompt for group chat
  const systemPrompt = `This is a group chat with multiple characters. You are playing ${currentCharacter.name}.

Characters in this conversation:
${characterDescriptions}

${currentCharacter.scenario ? `Current scenario: ${currentCharacter.scenario}\n` : ''}
IMPORTANT:
- Stay in character as ${currentCharacter.name}
- React naturally to what other characters and the user say
- Begin your response with an emotion tag: [emotion:TAG]
- Available emotions: neutral, joy, sadness, anger, surprise, fear, love, excitement, confusion, embarrassment, curiosity, amusement
- You may interact with or respond to other characters, not just the user`;

  context.push({ role: 'system', content: systemPrompt });

  // Add conversation history with character names for context
  const recentMessages = messages.slice(-30); // More context for group chats
  for (const msg of recentMessages) {
    if (msg.isSystem) continue;

    // For group chats, include the speaker's name in the content
    const contentWithName = msg.isUser
      ? msg.content
      : `[${msg.name}]: ${msg.content}`;

    context.push({
      role: msg.isUser ? 'user' : 'assistant',
      content: contentWithName,
    });
  }

  return context;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  chatFiles: [],
  groupChats: loadGroupChatsFromStorage(),
  currentChatFile: null,
  isLoading: false,
  isSending: false,
  error: null,

  refreshGroupChats: () => {
    set({ groupChats: loadGroupChatsFromStorage() });
  },

  deleteGroupChat: (fileName: string) => {
    const { groupChats } = get();
    const updated = groupChats.filter((g) => g.fileName !== fileName);
    saveGroupChatsToStorage(updated);
    set({ groupChats: updated });
  },

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
        characterAvatar: character.avatar,
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

  loadGroupChat: async (groupChat: GroupChatInfo) => {
    console.log('[GroupChat] Loading group chat:', groupChat.fileName);
    set({ isLoading: true, error: null, currentChatFile: groupChat.fileName });
    try {
      // Load from first character's avatar (where it's stored)
      const rawMessages = await api.getChatMessages(groupChat.characterAvatars[0], groupChat.fileName);
      console.log('[GroupChat] Loaded messages:', rawMessages?.length || 0);
      const messages: ChatMessage[] = rawMessages.map((msg) => ({
        id: generateId(),
        name: msg.name,
        isUser: msg.is_user,
        isSystem: msg.is_system,
        content: msg.mes,
        timestamp: msg.send_date,
        characterAvatar: msg.character_avatar,
      }));
      set({ messages, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load group chat',
      });
    }
  },

  startNewGroupChat: async (characters: CharacterInfo[]) => {
    const messages: ChatMessage[] = [];

    // Add a system message about the group chat
    messages.push({
      id: generateId(),
      name: 'System',
      isUser: false,
      isSystem: true,
      content: `Group chat started with ${characters.map(c => c.name).join(', ')}`,
      timestamp: Date.now(),
    });

    // Add first messages from each character that has one
    for (const character of characters) {
      if (character.first_mes) {
        messages.push({
          id: generateId(),
          name: character.name,
          isUser: false,
          isSystem: false,
          content: character.first_mes,
          timestamp: Date.now() + characters.indexOf(character), // Slight offset for ordering
          characterAvatar: character.avatar,
        });
      }
    }

    // Create chat file with combined character names
    const groupName = `Group_${characters.map(c => c.name).join('_')}`;
    const fileName = await api.createChat(groupName);
    console.log('[Chat] Starting new group chat, fileName:', fileName);

    // Save group chat metadata to localStorage
    const { groupChats } = get();
    const newGroupChat: GroupChatInfo = {
      fileName,
      characterNames: characters.map((c) => c.name),
      characterAvatars: characters.map((c) => c.avatar),
      lastMessage: messages[messages.length - 1]?.content || '',
      createdAt: Date.now(),
    };
    const updatedGroupChats = [...groupChats, newGroupChat];
    saveGroupChatsToStorage(updatedGroupChats);

    set({
      messages,
      currentChatFile: fileName,
      groupChats: updatedGroupChats,
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

  sendMessage: async (content: string, character: CharacterInfo, availableEmotions?: string[]) => {
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
      // Build conversation context with available emotions
      const updatedMessages = get().messages;
      const context = buildConversationContext(updatedMessages, character, availableEmotions);

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
          useSettingsStore.setState({ activeProvider: 'claude', activeModel: 'claude-sonnet-4-20250514' });
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

        // Parse emotion and strip tag from final response
        const emotion = parseEmotion(responseText);
        const cleanedContent = stripEmotionTag(responseText);

        console.log('[Chat] Raw response (first 150 chars):', responseText.substring(0, 150));
        console.log('[Chat] Parsed emotion:', emotion);

        // Update message with parsed emotion and cleaned content
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, content: cleanedContent, emotion }
              : msg
          ),
        }));

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

  sendGroupMessage: async (content: string, characters: CharacterInfo[]) => {
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
      // Get AI provider settings
      const { activeProvider, activeModel, secrets } = useSettingsStore.getState();

      let finalProvider = activeProvider;
      let finalModel = activeModel;

      // Auto-switch provider if needed
      if (!activeProvider || activeProvider === 'openai') {
        const hasOpenAI = Array.isArray(secrets['api_key_openai']) && secrets['api_key_openai'].length > 0;
        const hasClaude = Array.isArray(secrets['api_key_claude']) && secrets['api_key_claude'].length > 0;

        if (!hasOpenAI && hasClaude) {
          finalProvider = 'claude';
          finalModel = 'claude-sonnet-4-20250514';
          useSettingsStore.setState({ activeProvider: finalProvider, activeModel: finalModel });
        }
      }

      // Generate response from each character in sequence
      for (const character of characters) {
        const updatedMessages = get().messages;
        const context = buildGroupConversationContext(updatedMessages, characters, character);

        console.log(`[GroupChat] Generating response for ${character.name}`);

        const stream = await api.generateMessage(context, character.name, finalProvider, finalModel);

        if (stream) {
          // Add AI message placeholder for this character
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
                characterAvatar: character.avatar,
              },
            ],
          }));

          // Stream the response
          let responseText = '';
          for await (const token of parseSSEStream(stream)) {
            responseText += token;
            set((state) => ({
              messages: state.messages.map((msg) =>
                msg.id === aiMessageId ? { ...msg, content: responseText } : msg
              ),
            }));
          }

          // Parse emotion and strip tag
          const emotion = parseEmotion(responseText);
          const cleanedContent = stripEmotionTag(responseText);

          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, content: cleanedContent, emotion }
                : msg
            ),
          }));
        }
      }

      // Save group chat
      const { currentChatFile } = get();
      if (currentChatFile) {
        const allMessages = get().messages;
        const chatData = [
          {
            user_name: 'You',
            character_name: characters.map(c => c.name).join(', '),
            create_date: new Date().toISOString(),
            is_group_chat: true,
          },
          ...allMessages.map((msg) => ({
            name: msg.name,
            is_user: msg.isUser,
            is_system: msg.isSystem,
            mes: msg.content,
            send_date: msg.timestamp,
            character_avatar: msg.characterAvatar,
          })),
        ];

        try {
          // Use first character's avatar for saving (group chats need special handling)
          await api.saveChat(characters[0].avatar, currentChatFile, chatData);
        } catch (err) {
          console.error('[GroupChat] Failed to save:', err);
        }
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to send group message' });
    } finally {
      set({ isSending: false });
    }
  },

  editMessageAndRegenerate: async (messageId: string, newContent: string, character: CharacterInfo, availableEmotions?: string[]) => {
    const { messages } = get();

    // Find the message index
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    // Update the message and remove all messages after it
    const updatedMessages = messages.slice(0, messageIndex + 1).map((msg) =>
      msg.id === messageId ? { ...msg, content: newContent } : msg
    );

    set({ messages: updatedMessages, isSending: true, error: null });

    try {
      // Build conversation context with the edited message and available emotions
      const context = buildConversationContext(updatedMessages, character, availableEmotions);

      // Get AI provider settings
      const { activeProvider, activeModel, secrets } = useSettingsStore.getState();

      let finalProvider = activeProvider;
      let finalModel = activeModel;

      // Auto-switch provider if needed
      if (!activeProvider || activeProvider === 'openai') {
        const hasOpenAI = Array.isArray(secrets['api_key_openai']) && secrets['api_key_openai'].length > 0;
        const hasClaude = Array.isArray(secrets['api_key_claude']) && secrets['api_key_claude'].length > 0;

        if (!hasOpenAI && hasClaude) {
          finalProvider = 'claude';
          finalModel = 'claude-sonnet-4-20250514';
          useSettingsStore.setState({ activeProvider: finalProvider, activeModel: finalModel });
        }
      }

      // Generate new response
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

        // Stream the response
        let responseText = '';
        for await (const token of parseSSEStream(stream)) {
          responseText += token;
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === aiMessageId ? { ...msg, content: responseText } : msg
            ),
          }));
        }

        // Parse emotion and strip tag
        const emotion = parseEmotion(responseText);
        const cleanedContent = stripEmotionTag(responseText);

        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, content: cleanedContent, emotion }
              : msg
          ),
        }));

        // Save chat
        const { currentChatFile } = get();
        if (currentChatFile) {
          const allMessages = get().messages;
          const chatData = [
            {
              user_name: 'You',
              character_name: character.name,
              create_date: new Date().toISOString(),
            },
            ...allMessages.map((msg) => ({
              name: msg.name,
              is_user: msg.isUser,
              is_system: msg.isSystem,
              mes: msg.content,
              send_date: msg.timestamp,
            })),
          ];
          await api.saveChat(character.avatar, currentChatFile, chatData);
        }
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to regenerate response' });
    } finally {
      set({ isSending: false });
    }
  },

  clearChat: () => set({ messages: [], chatFiles: [], currentChatFile: null }),
}));
