import { useState } from 'react';
import { useCharacterStore } from '../../stores/characterStore';
import { Modal, Button, Input, TextArea, ImageUpload, ExpressionUpload } from '../ui';
import { spritesApi } from '../../api/client';

interface CharacterCreationProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (avatarUrl: string) => void;
}

export function CharacterCreation({ isOpen, onClose, onCreated }: CharacterCreationProps) {
  const { createCharacter, isCreating, error, clearError } = useCharacterStore();

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

    const avatarUrl = await createCharacter(
      {
        ch_name: formData.name.trim(),
        description: formData.description.trim(),
        personality: formData.personality.trim(),
        first_mes: formData.firstMessage.trim(),
        scenario: formData.scenario.trim(),
        mes_example: formData.exampleMessages.trim(),
        creator_notes: formData.creatorNotes.trim(),
        creator: formData.creator.trim(),
        tags: formData.tags.trim(),
      },
      avatarFile || undefined
    );

    if (avatarUrl) {
      // Upload expression images if any
      if (expressionFiles.size > 0) {
        setIsUploadingExpressions(true);
        try {
          const characterName = formData.name.trim();
          console.log('[CharacterCreation] Uploading expressions for:', characterName);
          const results = await Promise.allSettled(
            Array.from(expressionFiles.entries()).map(([emotion, file]) =>
              spritesApi.uploadSprite(characterName, emotion, file)
            )
          );
          // Log any failures
          const failures = results.filter((r) => r.status === 'rejected');
          if (failures.length > 0) {
            console.error('[CharacterCreation] Some expression uploads failed:', failures);
          }
        } catch (err) {
          console.error('[CharacterCreation] Failed to upload expressions:', err);
        } finally {
          setIsUploadingExpressions(false);
        }
      }

      // Reset form
      setAvatarFile(null);
      setExpressionFiles(new Map());
      setFormData({
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
      onClose();
      onCreated?.(avatarUrl);
    }
  };

  const handleClose = () => {
    clearError();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Character" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Avatar Upload */}
        <ImageUpload
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
        <ExpressionUpload onExpressionsChange={setExpressionFiles} />

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
            isLoading={isCreating || isUploadingExpressions}
            disabled={!formData.name.trim()}
            className="flex-1"
          >
            {isUploadingExpressions ? 'Uploading Expressions...' : 'Create Character'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
