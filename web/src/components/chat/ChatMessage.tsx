import { useState, useRef, useEffect, useMemo } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Avatar } from '../ui';

interface ChatMessageProps {
  name: string;
  content: string;
  isUser: boolean;
  isSystem?: boolean;
  avatar?: string;
  timestamp?: number;
  isEditable?: boolean;
  onEdit?: (newContent: string) => void;
  disabled?: boolean;
}

interface TextSegment {
  type: 'dialogue' | 'action' | 'thought';
  content: string;
}

/**
 * Parse message content to separate dialogue from actions/thoughts
 * Actions are wrapped in *asterisks* or _underscores_
 * Thoughts can be in {{curly braces}} or (parentheses for inner thoughts)
 */
function parseMessageContent(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Match *action*, _action_, {{thought}}, or regular text
  // Using a regex that captures asterisk/underscore wrapped text as actions
  const regex = /(\*[^*]+\*|_[^_]+_|\{\{[^}]+\}\})/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add any text before this match as dialogue
    if (match.index > lastIndex) {
      const dialogueText = text.slice(lastIndex, match.index);
      if (dialogueText) {
        segments.push({ type: 'dialogue', content: dialogueText });
      }
    }

    // Determine if it's an action or thought
    const matchedText = match[0];
    if (matchedText.startsWith('{{') && matchedText.endsWith('}}')) {
      // Thought in curly braces - remove the braces
      segments.push({
        type: 'thought',
        content: matchedText.slice(2, -2)
      });
    } else {
      // Action in asterisks or underscores - remove the markers
      segments.push({
        type: 'action',
        content: matchedText.slice(1, -1)
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining text as dialogue
  if (lastIndex < text.length) {
    segments.push({ type: 'dialogue', content: text.slice(lastIndex) });
  }

  // If no segments were created, return the whole text as dialogue
  if (segments.length === 0) {
    segments.push({ type: 'dialogue', content: text });
  }

  return segments;
}

/**
 * Render parsed message segments with appropriate styling
 */
function FormattedContent({ content, isUser }: { content: string; isUser: boolean }) {
  const segments = useMemo(() => parseMessageContent(content), [content]);

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'action') {
          return (
            <span
              key={index}
              className={`italic ${
                isUser
                  ? 'text-white/70'
                  : 'text-amber-400/90'
              }`}
            >
              {segment.content}
            </span>
          );
        }
        if (segment.type === 'thought') {
          return (
            <span
              key={index}
              className={`italic ${
                isUser
                  ? 'text-white/60'
                  : 'text-purple-400/80'
              }`}
            >
              {segment.content}
            </span>
          );
        }
        // Dialogue - default styling
        return <span key={index}>{segment.content}</span>;
      })}
    </>
  );
}

export function ChatMessage({
  name,
  content,
  isUser,
  isSystem,
  avatar,
  timestamp,
  isEditable,
  onEdit,
  disabled,
}: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editContent, isEditing]);

  const handleStartEdit = () => {
    setEditContent(content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== content) {
      onEdit?.(editContent.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancelEdit();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
  };
  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="px-4 py-2 bg-[var(--color-bg-tertiary)] rounded-full text-xs text-[var(--color-text-secondary)]">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-3 px-4 py-3 group ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      <Avatar src={avatar} alt={name} size="md" className="flex-shrink-0" />

      <div
        className={`flex flex-col max-w-[80%] md:max-w-[70%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            {name}
          </span>
          {timestamp && (
            <span className="text-xs text-zinc-500">
              {new Date(timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        <div className="flex items-start gap-2">
          {/* Edit button - show on left for user messages */}
          {isEditable && isUser && !isEditing && (
            <button
              onClick={handleStartEdit}
              disabled={disabled}
              className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              title="Edit message"
            >
              <Pencil size={14} />
            </button>
          )}

          <div
            className={`
              px-4 py-2 rounded-2xl
              ${
                isUser
                  ? 'bg-[var(--color-primary)] text-white rounded-br-md'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-bl-md'
              }
              ${isEditing ? 'w-full' : ''}
            `}
          >
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent text-sm resize-none outline-none min-h-[60px] text-white"
                  placeholder="Enter your message..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                    title="Cancel (Esc)"
                  >
                    <X size={14} />
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                    title="Save and regenerate (Enter)"
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm whitespace-pre-wrap break-words">
                <FormattedContent content={content} isUser={isUser} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
