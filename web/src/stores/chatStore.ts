import { create } from 'zustand';
import { api } from '../api/client';

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
  fetchChatFiles: (characterName: string) => Promise<void>;
  loadChat: (characterName: string, fileName: string) => Promise<void>;
  addMessage: (message: Omit<ChatMessage, 'id'>) => void;
  sendMessage: (content: string, characterName: string) => Promise<void>;
  clearChat: () => void;
}

let messageIdCounter = 0;
const generateId = () => `msg_${++messageIdCounter}_${Date.now()}`;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  chatFiles: [],
  currentChatFile: null,
  isLoading: false,
  isSending: false,
  error: null,

  fetchChatFiles: async (characterName: string) => {
    set({ isLoading: true, error: null });
    try {
      const chats = await api.getChats(characterName);
      const chatFiles: ChatFile[] = chats.map((chat) => ({
        fileName: chat.file_name,
        fileSize: chat.file_size,
        lastMessage: chat.last_mes,
      }));
      set({ chatFiles, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch chats',
      });
    }
  },

  loadChat: async (characterName: string, fileName: string) => {
    set({ isLoading: true, error: null, currentChatFile: fileName });
    try {
      const rawMessages = await api.getChatMessages(characterName, fileName);
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

  addMessage: (message) => {
    const newMessage: ChatMessage = {
      ...message,
      id: generateId(),
    };
    set((state) => ({ messages: [...state.messages, newMessage] }));
  },

  sendMessage: async (content: string, characterName: string) => {
    const { addMessage } = get();

    // Add user message
    addMessage({
      name: 'You',
      isUser: true,
      isSystem: false,
      content,
      timestamp: Date.now(),
    });

    set({ isSending: true });

    try {
      // For POC, we'll add a placeholder response
      // In production, this would stream from the API
      const stream = await api.generateMessage(content, characterName);

      if (stream) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let responseText = '';

        // Add initial AI message
        const aiMessageId = generateId();
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: aiMessageId,
              name: characterName,
              isUser: false,
              isSystem: false,
              content: '',
              timestamp: Date.now(),
            },
          ],
        }));

        // Stream the response
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          responseText += chunk;

          // Update the message content
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === aiMessageId ? { ...msg, content: responseText } : msg
            ),
          }));
        }
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to send message' });
    } finally {
      set({ isSending: false });
    }
  },

  clearChat: () => set({ messages: [], currentChatFile: null }),
}));
