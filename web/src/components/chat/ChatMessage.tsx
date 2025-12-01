import { Avatar } from '../ui';

interface ChatMessageProps {
  name: string;
  content: string;
  isUser: boolean;
  isSystem?: boolean;
  avatar?: string;
  timestamp?: number;
}

export function ChatMessage({
  name,
  content,
  isUser,
  isSystem,
  avatar,
  timestamp,
}: ChatMessageProps) {
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
      className={`flex gap-3 px-4 py-3 ${
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

        <div
          className={`
            px-4 py-2 rounded-2xl
            ${
              isUser
                ? 'bg-[var(--color-primary)] text-white rounded-br-md'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-bl-md'
            }
          `}
        >
          <div className="text-sm whitespace-pre-wrap break-words">{content}</div>
        </div>
      </div>
    </div>
  );
}
