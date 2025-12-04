import { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { useCharacterStore } from '../../stores/characterStore';
import { useChatStore } from '../../stores/chatStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

export function ChatView() {
  const { selectedCharacter } = useCharacterStore();
  const { messages, isSending, error, sendMessage, startNewChat, fetchChatFiles, loadChat, chatFiles, clearChat } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastCharacterRef = useRef<string | null>(null);

  const getAvatarUrl = (avatar: string) => `/thumbnail?type=avatar&file=${encodeURIComponent(avatar)}`;
  const getFullImageUrl = (avatar: string) => `/characters/${encodeURIComponent(avatar)}`;

  // Load chat when character changes
  useEffect(() => {
    if (!selectedCharacter) return;
    if (lastCharacterRef.current === selectedCharacter.avatar) return;

    // Clear old chat state before loading new character
    clearChat();
    lastCharacterRef.current = selectedCharacter.avatar;

    // Fetch chat files for new character
    fetchChatFiles(selectedCharacter.avatar);
  }, [selectedCharacter, fetchChatFiles, clearChat]);

  // When chat files are loaded, load the most recent or start new
  useEffect(() => {
    if (!selectedCharacter) return;
    // Only run this effect when we have fresh data for this character
    if (lastCharacterRef.current !== selectedCharacter.avatar) return;

    if (chatFiles.length > 0) {
      // Load most recent chat
      loadChat(selectedCharacter.avatar, chatFiles[0].fileName);
    } else if (messages.length === 0) {
      // Start new chat with first_mes only if no messages loaded
      startNewChat(selectedCharacter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatFiles]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (content: string) => {
    if (selectedCharacter) {
      sendMessage(content, selectedCharacter);
    }
  };

  // No character selected
  if (!selectedCharacter) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <MessageSquare size={64} className="text-[var(--color-text-secondary)] mb-4" />
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
          Select a Character
        </h2>
        <p className="text-[var(--color-text-secondary)] max-w-md">
          Choose a character from the sidebar to start chatting. You can search for
          characters or create a new one.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Mobile Character Portrait - visible only on mobile */}
      <div className="lg:hidden h-[30vh] min-h-[150px] max-h-[250px] relative bg-gradient-to-b from-[var(--color-bg-tertiary)] to-[var(--color-bg-primary)] overflow-hidden">
        <img
          src={getFullImageUrl(selectedCharacter.avatar)}
          alt={selectedCharacter.name}
          className="w-full h-full object-cover object-top"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--color-bg-primary)] to-transparent" />
        {/* Character name overlay */}
        <div className="absolute bottom-2 left-4 right-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] drop-shadow-lg">
            {selectedCharacter.name}
          </h2>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-4">
              <MessageSquare size={32} className="text-[var(--color-text-secondary)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
              Start a conversation
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-sm">
              Send a message to begin chatting with {selectedCharacter.name}
            </p>
          </div>
        ) : (
          <div className="py-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                name={message.name}
                content={message.content}
                isUser={message.isUser}
                isSystem={message.isSystem}
                avatar={
                  message.isUser
                    ? undefined
                    : getAvatarUrl(selectedCharacter.avatar)
                }
                timestamp={message.timestamp}
              />
            ))}

            {/* Error display */}
            {error && (
              <div className="mx-4 my-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Typing indicator */}
            {isSending && (
              <div className="flex gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[var(--color-text-secondary)] rounded-full animate-bounce" />
                    <span
                      className="w-2 h-2 bg-[var(--color-text-secondary)] rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <span
                      className="w-2 h-2 bg-[var(--color-text-secondary)] rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <ChatInput
        onSend={handleSend}
        disabled={isSending}
        placeholder={`Message ${selectedCharacter.name}...`}
      />
    </div>
  );
}
