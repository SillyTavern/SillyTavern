import { useEffect, useState, useMemo } from 'react';
import { X, Search, Plus, MessageSquare, Users, ChevronLeft } from 'lucide-react';
import { useCharacterStore } from '../../stores/characterStore';
import { useChatStore } from '../../stores/chatStore';
import { Avatar, Button, Input } from '../ui';
import { CharacterCreation } from '../character/CharacterCreation';
import { getExpressionUrl, type Emotion } from '../../utils/emotions';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCharacterList, setShowCharacterList] = useState(false);
  const { characters, selectedCharacter, isLoading, fetchCharacters, selectCharacter } =
    useCharacterStore();
  const { messages } = useChatStore();

  // Get the latest character message's emotion for the portrait
  const latestEmotion = useMemo(() => {
    const characterMessages = messages.filter((m) => !m.isUser && !m.isSystem);
    if (characterMessages.length === 0) return null;
    return (characterMessages[characterMessages.length - 1] as { emotion?: Emotion | null }).emotion ?? null;
  }, [messages]);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  // When a character is selected, hide the list (show portrait)
  useEffect(() => {
    if (selectedCharacter) {
      setShowCharacterList(false);
    }
  }, [selectedCharacter]);

  const handleCharacterCreated = (avatarUrl: string) => {
    selectCharacter(avatarUrl);
    setShowCharacterList(false);
    onClose();
  };

  const handleCharacterSelect = (avatar: string) => {
    selectCharacter(avatar);
    setShowCharacterList(false);
    onClose();
  };

  // Thumbnail URL for small avatars in list (96x144)
  const getThumbnailUrl = (avatar: string) => `/thumbnail?type=avatar&file=${encodeURIComponent(avatar)}`;

  // Full-size image URL for portrait view (with expression support)
  const getFullImageUrl = (avatar: string, emotion?: Emotion | null) =>
    getExpressionUrl(avatar, emotion ?? null);

  // Determine what to show: character portrait or character list
  const showPortrait = selectedCharacter && !showCharacterList;

  return (
    <>
      {/* Overlay (Mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-72 bg-[var(--color-bg-secondary)]
          border-r border-[var(--color-border)]
          flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {showPortrait ? (
          /* Character Portrait View */
          <>
            {/* Header with switch button */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--color-border)] safe-top">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCharacterList(true)}
                className="p-2 -ml-2"
                aria-label="Switch character"
              >
                <Users size={20} />
              </Button>
              <h2 className="font-semibold text-[var(--color-text-primary)] truncate flex-1 text-center px-2">
                {selectedCharacter.name}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="lg:hidden p-2 -mr-2"
                aria-label="Close sidebar"
              >
                <X size={20} />
              </Button>
            </div>

            {/* Full Character Portrait */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
              <div className="w-full max-w-[240px] aspect-[2/3] rounded-xl overflow-hidden shadow-lg border border-[var(--color-border)]">
                <img
                  src={getFullImageUrl(selectedCharacter.avatar, latestEmotion)}
                  alt={selectedCharacter.name}
                  className="w-full h-full object-cover transition-opacity duration-300"
                  onError={(e) => {
                    // Fall back to default avatar if expression image fails
                    const fallbackUrl = getFullImageUrl(selectedCharacter.avatar, null);
                    if (e.currentTarget.src !== fallbackUrl) {
                      e.currentTarget.src = fallbackUrl;
                    }
                  }}
                />
              </div>

              {/* Character Info */}
              <div className="mt-4 text-center w-full px-2">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {selectedCharacter.name}
                </h3>
                {latestEmotion && (
                  <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] capitalize">
                    {latestEmotion}
                  </span>
                )}
                {selectedCharacter.description && (
                  <p className="text-sm text-[var(--color-text-secondary)] mt-2 line-clamp-3">
                    {selectedCharacter.description}
                  </p>
                )}
              </div>
            </div>

            {/* Switch Character Button */}
            <div className="p-3 pb-4 border-t border-[var(--color-border)] input-safe-bottom">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setShowCharacterList(true)}
              >
                <Users size={18} className="mr-2" />
                Switch Character
              </Button>
            </div>
          </>
        ) : (
          /* Character List View */
          <>
            {/* Sidebar Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--color-border)] safe-top">
              {selectedCharacter ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCharacterList(false)}
                  className="p-2 -ml-2"
                  aria-label="Back to character"
                >
                  <ChevronLeft size={20} />
                </Button>
              ) : (
                <div className="w-9" />
              )}
              <h2 className="font-semibold text-[var(--color-text-primary)]">Characters</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="lg:hidden p-2 -mr-2"
                aria-label="Close sidebar"
              >
                <X size={20} />
              </Button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-[var(--color-border)]">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
                />
                <Input
                  type="search"
                  placeholder="Search characters..."
                  className="pl-10"
                />
              </div>
            </div>

            {/* Character List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary)]" />
                </div>
              ) : characters.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <MessageSquare size={32} className="mx-auto text-[var(--color-text-secondary)] mb-2" />
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    No characters found
                  </p>
                </div>
              ) : (
                <ul className="py-2">
                  {characters.map((character) => (
                    <li key={character.avatar}>
                      <button
                        onClick={() => handleCharacterSelect(character.avatar)}
                        className={`
                          w-full flex items-center gap-3 px-4 py-3
                          transition-colors
                          ${
                            selectedCharacter?.avatar === character.avatar
                              ? 'bg-[var(--color-primary)]/20 border-l-2 border-[var(--color-primary)]'
                              : 'hover:bg-[var(--color-bg-tertiary)]'
                          }
                        `}
                      >
                        <Avatar src={getThumbnailUrl(character.avatar)} alt={character.name} size="md" />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                            {character.name}
                          </p>
                          {character.description && (
                            <p className="text-xs text-[var(--color-text-secondary)] truncate">
                              {character.description}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* New Character Button */}
            <div className="p-3 pb-4 border-t border-[var(--color-border)] input-safe-bottom">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={18} className="mr-2" />
                New Character
              </Button>
            </div>
          </>
        )}
      </aside>

      {/* Character Creation Modal */}
      <CharacterCreation
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCharacterCreated}
      />
    </>
  );
}
