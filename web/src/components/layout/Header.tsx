import { useState } from 'react';
import { Menu, Settings, LogOut, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCharacterStore } from '../../stores/characterStore';
import { Avatar, Button } from '../ui';
import { CharacterEdit } from '../character/CharacterEdit';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuthStore();
  const { selectedCharacter } = useCharacterStore();
  const [showEditModal, setShowEditModal] = useState(false);

  const getAvatarUrl = (avatar: string) => `/thumbnail?type=avatar&file=${encodeURIComponent(avatar)}`;

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
            <Avatar src={getAvatarUrl(selectedCharacter.avatar)} alt={selectedCharacter.name} size="sm" />
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                {selectedCharacter.name}
              </h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              aria-label="Edit character"
              onClick={() => setShowEditModal(true)}
            >
              <Pencil size={18} />
            </Button>
          </>
        ) : (
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">
            SillyTavern
          </h1>
        )}
      </div>

      {/* User Menu */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="p-2"
          aria-label="Settings"
          onClick={() => navigate('/settings')}
        >
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

      {/* Character Edit Modal */}
      {selectedCharacter && (
        <CharacterEdit
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          character={selectedCharacter}
        />
      )}
    </header>
  );
}
