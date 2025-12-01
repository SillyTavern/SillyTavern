import { Menu, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useCharacterStore } from '../../stores/characterStore';
import { Avatar, Button } from '../ui';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { currentUser, logout } = useAuthStore();
  const { selectedCharacter } = useCharacterStore();

  return (
    <header className="h-14 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] flex items-center px-4 gap-3 safe-top">
      {/* Menu Button (Mobile) */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onMenuClick}
        className="lg:hidden p-2"
        aria-label="Open menu"
      >
        <Menu size={24} />
      </Button>

      {/* Character Info */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        {selectedCharacter ? (
          <>
            <Avatar src={selectedCharacter.avatar} alt={selectedCharacter.name} size="sm" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                {selectedCharacter.name}
              </h1>
            </div>
          </>
        ) : (
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">
            SillyTavern
          </h1>
        )}
      </div>

      {/* User Menu */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="p-2" aria-label="Settings">
          <Settings size={20} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="p-2"
          aria-label="Logout"
        >
          <LogOut size={20} />
        </Button>
        {currentUser && (
          <Avatar size="sm" alt={currentUser.name} />
        )}
      </div>
    </header>
  );
}
