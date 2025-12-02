import { create } from 'zustand';
import { api, type CharacterInfo, type CharacterCreateData, type CharacterEditData } from '../api/client';

interface CharacterState {
  characters: CharacterInfo[];
  selectedCharacter: CharacterInfo | null;
  isLoading: boolean;
  isCreating: boolean;
  isEditing: boolean;
  error: string | null;

  // Actions
  fetchCharacters: () => Promise<void>;
  selectCharacter: (avatar: string) => Promise<void>;
  createCharacter: (data: CharacterCreateData) => Promise<string | null>;
  updateCharacter: (data: CharacterEditData) => Promise<boolean>;
  deleteCharacter: (avatar: string) => Promise<boolean>;
  clearSelection: () => void;
  clearError: () => void;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  selectedCharacter: null,
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

  createCharacter: async (data: CharacterCreateData) => {
    set({ isCreating: true, error: null });
    try {
      const avatarUrl = await api.createCharacter(data);
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

  updateCharacter: async (data: CharacterEditData) => {
    set({ isEditing: true, error: null });
    try {
      await api.editCharacter(data);
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
}));
