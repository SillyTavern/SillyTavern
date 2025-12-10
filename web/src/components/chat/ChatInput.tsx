import { useState, useRef, useEffect } from 'react';
import { Send, Mic, Paperclip } from 'lucide-react';
import { Button } from '../ui';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 pb-4 input-safe-bottom"
    >
      <div className="flex items-end gap-2">
        {/* Attachment Button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="p-2 flex-shrink-0"
          aria-label="Attach file"
        >
          <Paperclip size={20} />
        </Button>

        {/* Input Area */}
        <div className="flex-1 flex items-end bg-[var(--color-bg-tertiary)] rounded-2xl px-4 py-2">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-[var(--color-text-primary)] placeholder-zinc-500 resize-none focus:outline-none text-sm max-h-[150px]"
          />
        </div>

        {/* Voice/Send Button */}
        {message.trim() ? (
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={disabled}
            className="p-2 rounded-full flex-shrink-0"
            aria-label="Send message"
          >
            <Send size={20} />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="p-2 flex-shrink-0"
            aria-label="Voice input"
          >
            <Mic size={20} />
          </Button>
        )}
      </div>
    </form>
  );
}
