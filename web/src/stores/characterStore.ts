import { create } from 'zustand';
import { api, type CharacterInfo, type CharacterCreateData, type CharacterEditData } from '../api/client';

interface CharacterState {
  characters: CharacterInfo[];
  selectedCharacter: CharacterInfo | null;
  // Group chat support
  groupChatCharacters: CharacterInfo[];
  isGroupChatMode: boolean;
  isLoading: boolean;
  isCreating: boolean;
  isEditing: boolean;
  error: string | null;

  // Actions
  fetchCharacters: () => Promise<void>;
  selectCharacter: (avatar: string) => Promise<void>;
  createCharacter: (data: CharacterCreateData, avatarFile?: File) => Promise<string | null>;
  updateCharacter: (data: CharacterEditData, avatarFile?: File) => Promise<boolean>;
  deleteCharacter: (avatar: string) => Promise<boolean>;
  clearSelection: () => void;
  clearError: () => void;
  // Group chat actions
  toggleGroupChatCharacter: (avatar: string) => Promise<void>;
  startGroupChat: () => void;
  exitGroupChat: () => void;
  isCharacterInGroup: (avatar: string) => boolean;
  setGroupChatCharacters: (avatars: string[]) => Promise<void>;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  selectedCharacter: null,
  groupChatCharacters: [],
  isGroupChatMode: false,
  isLoading: false,
  isCreating: false,
  isEditing: false,
  error: null,

  fetchCharacters: async () => {
    set({ isLoading: true, error: null });
    try {
      const characters = await api.getCharacters();
      set({ characters, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch characters',
      });
    }
  },

  selectCharacter: async (avatar: string) => {
    const { characters } = get();
    let character = characters.find((c) => c.avatar === avatar);

    if (!character) {
      set({ error: 'Character not found' });
      return;
    }

    // If we don't have full data, fetch it
    if (!character.first_mes) {
      try {
        set({ isLoading: true });
        const fullCharacter = await api.getCharacter(avatar);
        character = { ...character, ...fullCharacter };

        // Update in the list
        set({
          characters: characters.map((c) => (c.avatar === avatar ? character! : c)),
          isLoading: false,
        });
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load character',
        });
        return;
      }
    }

    set({ selectedCharacter: character });
  },

  clearSelection: () => set({ selectedCharacter: null }),

  createCharacter: async (data: CharacterCreateData, avatarFile?: File) => {
    set({ isCreating: true, error: null });
    try {
      const avatarUrl = await api.createCharacter(data, avatarFile);
      // Refresh the character list
      await get().fetchCharacters();
      set({ isCreating: false });
      return avatarUrl;
    } catch (error) {
      set({
        isCreating: false,
        error: error instanceof Error ? error.message : 'Failed to create character',
      });
      return null;
    }
  },

  updateCharacter: async (data: CharacterEditData, avatarFile?: File) => {
    set({ isEditing: true, error: null });
    try {
      await api.editCharacter(data, avatarFile);
      // Refresh the character list and selected character
      await get().fetchCharacters();
      // Re-select to get updated data
      const { selectedCharacter } = get();
      if (selectedCharacter?.avatar === data.avatar_url) {
        const updatedCharacter = await api.getCharacter(data.avatar_url);
        set({ selectedCharacter: updatedCharacter });
      }
      set({ isEditing: false });
      return true;
    } catch (error) {
      set({
        isEditing: false,
        error: error instanceof Error ? error.message : 'Failed to update character',
      });
      return false;
    }
  },

  deleteCharacter: async (avatar: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteCharacter(avatar);
      // Clear selection if deleting the selected character
      const { selectedCharacter } = get();
      if (selectedCharacter?.avatar === avatar) {
        set({ selectedCharacter: null });
      }
      // Refresh the character list
      await get().fetchCharacters();
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete character',
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),

  // Group chat actions
  toggleGroupChatCharacter: async (avatar: string) => {
    const { characters, groupChatCharacters } = get();
    const isInGroup = groupChatCharacters.some((c) => c.avatar === avatar);

    if (isInGroup) {
      // Remove from group
      set({
        groupChatCharacters: groupChatCharacters.filter((c) => c.avatar !== avatar),
      });
    } else {
      // Add to group - fetch full character data if needed
      let character = characters.find((c) => c.avatar === avatar);
      if (!character) return;

      if (!character.first_mes) {
        try {
          const fullCharacter = await api.getCharacter(avatar);
          character = { ...character, ...fullCharacter };
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to load character' });
          return;
        }
      }

      set({
        groupChatCharacters: [...groupChatCharacters, character],
      });
    }
  },

  startGroupChat: () => {
    const { groupChatCharacters } = get();
    if (groupChatCharacters.length < 2) {
      set({ error: 'Select at least 2 characters for group chat' });
      return;
    }
    set({
      isGroupChatMode: true,
      selectedCharacter: null, // Clear single character selection
    });
  },

  exitGroupChat: () => {
    set({
      isGroupChatMode: false,
      groupChatCharacters: [],
    });
  },

  isCharacterInGroup: (avatar: string) => {
    return get().groupChatCharacters.some((c) => c.avatar === avatar);
  },

  setGroupChatCharacters: async (avatars: string[]) => {
    const { characters } = get();
    const groupCharacters: CharacterInfo[] = [];

    for (const avatar of avatars) {
      let character = characters.find((c) => c.avatar === avatar);
      if (character) {
        // Fetch full data if needed
        if (!character.first_mes) {
          try {
            const fullCharacter = await api.getCharacter(avatar);
            character = { ...character, ...fullCharacter };
          } catch {
            // Use what we have
          }
        }
        groupCharacters.push(character);
      }
    }

    set({
      groupChatCharacters: groupCharacters,
      isGroupChatMode: true,
      selectedCharacter: null,
    });
  },
}));
