import { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { useCharacterStore } from '../../stores/characterStore';
import { useChatStore } from '../../stores/chatStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

export function ChatView() {
  const { selectedCharacter } = useCharacterStore();
  const { messages, isSending, sendMessage } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (content: string) => {
    if (selectedCharacter) {
      sendMessage(content, selectedCharacter.name);
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
    <div className="h-full flex flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
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
                    : selectedCharacter.avatar
                }
                timestamp={message.timestamp}
              />
            ))}

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
