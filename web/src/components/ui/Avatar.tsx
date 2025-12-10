import { useState, useEffect } from 'react';
import { User } from 'lucide-react';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Avatar({ src, alt, size = 'md', className = '' }: AvatarProps) {
  const [error, setError] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setError(false);
  }, [src]);

  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  };

  if (!src || error) {
    return (
      <div
        className={`${sizes[size]} rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center ${className}`}
      >
        <User size={iconSizes[size]} className="text-[var(--color-text-secondary)]" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || 'Avatar'}
      className={`${sizes[size]} rounded-full object-cover ${className}`}
      onError={() => setError(true)}
    />
  );
}
