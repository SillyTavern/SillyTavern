import { useRef, useState, useEffect } from 'react';
import { Upload, X, ImageIcon, Plus, Trash2 } from 'lucide-react';
import { DEFAULT_EMOTIONS } from '../../utils/emotions';
import { spritesApi } from '../../api/client';
import { Button } from './Button';

interface ExpressionEntry {
  label: string;
  file?: File;
  preview?: string;
  existingPath?: string;
}

interface ExpressionUploadProps {
  characterName?: string; // For loading existing sprites in edit mode
  onExpressionsChange: (expressions: Map<string, File>) => void;
}

export function ExpressionUpload({ characterName, onExpressionsChange }: ExpressionUploadProps) {
  const [expressions, setExpressions] = useState<ExpressionEntry[]>([]);
  const [newEmotionName, setNewEmotionName] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const newFileInputRef = useRef<HTMLInputElement>(null);

  // Load existing sprites when in edit mode
  useEffect(() => {
    if (characterName) {
      spritesApi.getSprites(characterName).then((sprites) => {
        if (Array.isArray(sprites)) {
          const entries: ExpressionEntry[] = sprites.map((sprite) => ({
            label: sprite.label,
            existingPath: sprite.path,
          }));
          setExpressions(entries);
        }
      }).catch(console.error);
    }
  }, [characterName]);

  // Notify parent of file changes
  const notifyChanges = (entries: ExpressionEntry[]) => {
    const fileMap = new Map<string, File>();
    entries.forEach((entry) => {
      if (entry.file) {
        fileMap.set(entry.label, entry.file);
      }
    });
    onExpressionsChange(fileMap);
  };

  const handleFileSelect = (label: string, file: File) => {
    if (!file.type.startsWith('image/')) return;

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setExpressions((prev) => {
        const updated = prev.map((entry) =>
          entry.label === label
            ? { ...entry, file, preview: e.target?.result as string }
            : entry
        );
        notifyChanges(updated);
        return updated;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAddWithFile = (file: File) => {
    const label = newEmotionName.trim().toLowerCase();
    if (!label || !file.type.startsWith('image/')) return;

    // Check if already exists
    if (expressions.some((e) => e.label === label)) {
      // Update existing
      handleFileSelect(label, file);
      setNewEmotionName('');
      return;
    }

    // Create preview and add new entry
    const reader = new FileReader();
    reader.onload = (e) => {
      const newEntry: ExpressionEntry = {
        label,
        file,
        preview: e.target?.result as string,
      };
      setExpressions((prev) => {
        const updated = [...prev, newEntry];
        notifyChanges(updated);
        return updated;
      });
      setNewEmotionName('');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveExpression = (label: string) => {
    setExpressions((prev) => {
      const updated = prev.filter((e) => e.label !== label);
      notifyChanges(updated);
      return updated;
    });
  };

  const handleClearFile = (label: string) => {
    setExpressions((prev) => {
      const updated = prev.map((entry) =>
        entry.label === label ? { ...entry, file: undefined, preview: undefined } : entry
      );
      notifyChanges(updated);
      return updated;
    });

    const input = fileInputRefs.current.get(label);
    if (input) input.value = '';
  };

  const getDisplayImage = (entry: ExpressionEntry): string | undefined => {
    return entry.preview || entry.existingPath;
  };

  const hasAnyExpression = expressions.length > 0;
  const newFilesCount = expressions.filter((e) => e.file).length;

  // Quick add buttons for common emotions not yet added
  const suggestedEmotions = DEFAULT_EMOTIONS.filter(
    (emotion) => !expressions.some((e) => e.label === emotion)
  );

  return (
    <div className="w-full">
      <details
        className="group"
        open={isExpanded}
        onToggle={(e) => setIsExpanded((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] py-2 flex items-center gap-2">
          <ImageIcon size={16} />
          Expression Images
          {hasAnyExpression && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-primary)]/20 text-[var(--color-primary)]">
              {newFilesCount > 0 ? `${newFilesCount} new` : expressions.length}
            </span>
          )}
        </summary>

        <div className="mt-3 space-y-4">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Upload expression images with any emotion name. The character's avatar will change based
            on their emotional state during chat.
          </p>

          {/* Add New Expression */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                Emotion Name
              </label>
              <input
                type="text"
                value={newEmotionName}
                onChange={(e) => setNewEmotionName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newEmotionName.trim()) {
                    e.preventDefault();
                    newFileInputRef.current?.click();
                  }
                }}
                placeholder="e.g., smirk, pensive, mischievous"
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => newFileInputRef.current?.click()}
              disabled={!newEmotionName.trim()}
            >
              <Plus size={16} className="mr-1" />
              Add
            </Button>
            <input
              ref={newFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAddWithFile(file);
                e.target.value = '';
              }}
            />
          </div>

          {/* Quick Add Suggestions */}
          {suggestedEmotions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-[var(--color-text-secondary)] mr-1">Quick add:</span>
              {suggestedEmotions.slice(0, 6).map((emotion) => (
                <button
                  key={emotion}
                  type="button"
                  onClick={() => setNewEmotionName(emotion)}
                  className="text-xs px-2 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  {emotion}
                </button>
              ))}
            </div>
          )}

          {/* Expression Grid */}
          {expressions.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {expressions.map((entry) => {
                const displayImage = getDisplayImage(entry);
                const hasNewFile = !!entry.file;

                return (
                  <div
                    key={entry.label}
                    className="relative bg-[var(--color-bg-tertiary)] rounded-lg p-2 group/card"
                  >
                    {/* Image slot */}
                    <div
                      className={`
                        aspect-square rounded-lg border-2 border-dashed
                        ${displayImage ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'}
                        bg-[var(--color-bg-secondary)]
                        flex items-center justify-center
                        overflow-hidden cursor-pointer
                        hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)]
                        transition-colors
                      `}
                      onClick={() => fileInputRefs.current.get(entry.label)?.click()}
                    >
                      {displayImage ? (
                        <img
                          src={displayImage}
                          alt={entry.label}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Upload size={24} className="text-[var(--color-text-secondary)]" />
                      )}
                    </div>

                    {/* Label */}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-[var(--color-text-primary)] font-medium truncate">
                        {entry.label}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                        {hasNewFile && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearFile(entry.label);
                            }}
                            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                            title="Clear new image"
                          >
                            <X size={14} />
                          </button>
                        )}
                        {!entry.existingPath && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveExpression(entry.label);
                            }}
                            className="p-1 text-red-400 hover:text-red-500"
                            title="Remove expression"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    {hasNewFile && (
                      <span className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                        new
                      </span>
                    )}

                    {/* Hidden file input */}
                    <input
                      ref={(el) => {
                        if (el) fileInputRefs.current.set(entry.label, el);
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(entry.label, file);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-[var(--color-text-secondary)] italic">
            Tip: Use any emotion name you want! The AI will be told which emotions are available
            for this character.
          </p>
        </div>
      </details>
    </div>
  );
}
