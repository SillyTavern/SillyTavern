import { useState, useEffect } from 'react';
import { useCharacterStore } from '../../stores/characterStore';
import { spritesApi, type CharacterInfo } from '../../api/client';
import { Modal, Button, Input, TextArea, ImageUpload, ExpressionUpload } from '../ui';

interface CharacterEditProps {
  isOpen: boolean;
  onClose: () => void;
  character: CharacterInfo;
  onSaved?: () => void;
}

export function CharacterEdit({ isOpen, onClose, character, onSaved }: CharacterEditProps) {
  const { updateCharacter, isEditing, error, clearError } = useCharacterStore();

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [expressionFiles, setExpressionFiles] = useState<Map<string, File>>(new Map());
  const [isUploadingExpressions, setIsUploadingExpressions] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    personality: '',
    firstMessage: '',
    scenario: '',
    exampleMessages: '',
    creatorNotes: '',
    creator: '',
    tags: '',
  });

  const getAvatarUrl = (avatar: string) => `/thumbnail?type=avatar&file=${encodeURIComponent(avatar)}`;

  // Populate form when character changes or modal opens
  useEffect(() => {
    if (isOpen && character) {
      setAvatarFile(null); // Reset file selection
      setFormData({
        name: character.name || '',
        description: character.description || character.data?.description || '',
        personality: character.personality || character.data?.personality || '',
        firstMessage: character.first_mes || character.data?.first_mes || '',
        scenario: character.scenario || character.data?.scenario || '',
        exampleMessages: character.mes_example || '',
        creatorNotes: character.data?.creator_notes || '',
        creator: character.data?.creator || '',
        tags: character.tags?.join(', ') || '',
      });
    }
  }, [isOpen, character]);

  const handleChange = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (error) clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return;
    }

    const success = await updateCharacter(
      {
        avatar_url: character.avatar,
        ch_name: formData.name.trim(),
        description: formData.description.trim(),
        personality: formData.personality.trim(),
        first_mes: formData.firstMessage.trim(),
        scenario: formData.scenario.trim(),
        mes_example: formData.exampleMessages.trim(),
        creator_notes: formData.creatorNotes.trim(),
        creator: formData.creator.trim(),
        tags: formData.tags.trim(),
        chat: character.create_date, // Preserve existing
        create_date: character.create_date, // Preserve existing
      },
      avatarFile || undefined
    );

    if (success) {
      // Upload expression images if any
      if (expressionFiles.size > 0) {
        setIsUploadingExpressions(true);
        try {
          const characterName = character.name;
          console.log('[CharacterEdit] Uploading expressions for:', characterName);
          const results = await Promise.allSettled(
            Array.from(expressionFiles.entries()).map(([emotion, file]) =>
              spritesApi.uploadSprite(characterName, emotion, file)
            )
          );
          // Log any failures
          const failures = results.filter((r) => r.status === 'rejected');
          if (failures.length > 0) {
            console.error('[CharacterEdit] Some expression uploads failed:', failures);
          }
        } catch (err) {
          console.error('[CharacterEdit] Failed to upload expressions:', err);
        } finally {
          setIsUploadingExpressions(false);
        }
      }

      onClose();
      onSaved?.();
    }
  };

  const handleClose = () => {
    clearError();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Edit ${character.name}`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Avatar Upload */}
        <ImageUpload
          currentImage={getAvatarUrl(character.avatar)}
          onImageSelect={setAvatarFile}
          label="Avatar"
        />

        {/* Name - Required */}
        <Input
          label="Name *"
          placeholder="Character's name"
          value={formData.name}
          onChange={handleChange('name')}
          required
          autoFocus
        />

        {/* Description */}
        <TextArea
          label="Description"
          placeholder="Describe the character's appearance, background, and other details..."
          value={formData.description}
          onChange={handleChange('description')}
          rows={3}
        />

        {/* Personality */}
        <TextArea
          label="Personality"
          placeholder="Character's personality traits, mannerisms, speech patterns..."
          value={formData.personality}
          onChange={handleChange('personality')}
          rows={3}
        />

        {/* First Message */}
        <TextArea
          label="First Message"
          placeholder="The character's opening message when starting a new chat..."
          value={formData.firstMessage}
          onChange={handleChange('firstMessage')}
          rows={4}
        />

        {/* Scenario */}
        <TextArea
          label="Scenario"
          placeholder="The setting or context for conversations..."
          value={formData.scenario}
          onChange={handleChange('scenario')}
          rows={2}
        />

        {/* Expression Images */}
        <ExpressionUpload
          characterName={character.name}
          onExpressionsChange={setExpressionFiles}
        />

        {/* Collapsible Advanced Section */}
        <details className="group">
          <summary className="cursor-pointer text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] py-2">
            Advanced Options
          </summary>

          <div className="space-y-4 mt-2 pl-2 border-l-2 border-[var(--color-border)]">
            {/* Example Messages */}
            <TextArea
              label="Example Messages"
              placeholder="Example dialogue to help the AI understand the character's voice..."
              value={formData.exampleMessages}
              onChange={handleChange('exampleMessages')}
              rows={4}
            />

            {/* Creator Notes */}
            <TextArea
              label="Creator Notes"
              placeholder="Notes about the character for other users..."
              value={formData.creatorNotes}
              onChange={handleChange('creatorNotes')}
              rows={2}
            />

            {/* Creator */}
            <Input
              label="Creator"
              placeholder="Your name or handle"
              value={formData.creator}
              onChange={handleChange('creator')}
            />

            {/* Tags */}
            <Input
              label="Tags"
              placeholder="Comma-separated tags (e.g., fantasy, friendly, assistant)"
              value={formData.tags}
              onChange={handleChange('tags')}
            />
          </div>
        </details>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-[var(--color-border)]">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isEditing || isUploadingExpressions}
            disabled={!formData.name.trim()}
            className="flex-1"
          >
            {isUploadingExpressions ? 'Uploading Expressions...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
