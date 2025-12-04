import { useRef, useState, useEffect } from 'react';
import { Upload, X, ImageIcon } from 'lucide-react';
import { EMOTIONS, type Emotion } from '../../utils/emotions';
import { spritesApi, type SpriteInfo } from '../../api/client';

interface ExpressionUploadProps {
  characterName?: string; // For loading existing sprites in edit mode
  onExpressionsChange: (expressions: Map<Emotion, File>) => void;
}

export function ExpressionUpload({ characterName, onExpressionsChange }: ExpressionUploadProps) {
  const [expressions, setExpressions] = useState<Map<Emotion, File>>(new Map());
  const [previews, setPreviews] = useState<Map<Emotion, string>>(new Map());
  const [existingSprites, setExistingSprites] = useState<SpriteInfo[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRefs = useRef<Map<Emotion, HTMLInputElement>>(new Map());

  // Load existing sprites when in edit mode
  useEffect(() => {
    if (characterName) {
      spritesApi.getSprites(characterName).then(setExistingSprites).catch(console.error);
    }
  }, [characterName]);

  const getExistingSpriteUrl = (emotion: Emotion): string | undefined => {
    const sprite = existingSprites.find((s) => s.label === emotion);
    return sprite?.path;
  };

  const handleFileSelect = (emotion: Emotion, file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviews((prev) => {
        const next = new Map(prev);
        next.set(emotion, e.target?.result as string);
        return next;
      });
    };
    reader.readAsDataURL(file);

    // Update expressions
    const newExpressions = new Map(expressions);
    newExpressions.set(emotion, file);
    setExpressions(newExpressions);
    onExpressionsChange(newExpressions);
  };

  const handleClear = (emotion: Emotion) => {
    setPreviews((prev) => {
      const next = new Map(prev);
      next.delete(emotion);
      return next;
    });

    const newExpressions = new Map(expressions);
    newExpressions.delete(emotion);
    setExpressions(newExpressions);
    onExpressionsChange(newExpressions);

    // Clear input
    const input = fileInputRefs.current.get(emotion);
    if (input) {
      input.value = '';
    }
  };

  const getDisplayImage = (emotion: Emotion): string | undefined => {
    return previews.get(emotion) || getExistingSpriteUrl(emotion);
  };

  const hasAnyExpression = expressions.size > 0 || existingSprites.length > 0;

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
              {expressions.size > 0 ? expressions.size : existingSprites.length}
            </span>
          )}
        </summary>

        <div className="mt-3 space-y-3">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Upload expression images for different emotions. The character's avatar will change based
            on their emotional state during chat.
          </p>

          {/* Expression Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {EMOTIONS.map((emotion) => {
              const displayImage = getDisplayImage(emotion);
              const hasNewFile = expressions.has(emotion);

              return (
                <div key={emotion} className="flex flex-col items-center">
                  {/* Image slot */}
                  <div className="relative group/slot">
                    <div
                      className={`
                        w-16 h-16 rounded-lg border-2 border-dashed
                        ${displayImage ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'}
                        bg-[var(--color-bg-tertiary)]
                        flex items-center justify-center
                        overflow-hidden cursor-pointer
                        hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)]/80
                        transition-colors
                      `}
                      onClick={() => fileInputRefs.current.get(emotion)?.click()}
                    >
                      {displayImage ? (
                        <img
                          src={displayImage}
                          alt={emotion}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Upload size={18} className="text-[var(--color-text-secondary)]" />
                      )}
                    </div>

                    {/* Clear button - only show for new uploads */}
                    {hasNewFile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClear(emotion);
                        }}
                        className="absolute -top-1 -right-1 p-0.5 bg-red-500 rounded-full text-white hover:bg-red-600 opacity-0 group-hover/slot:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    )}

                    {/* Hidden file input */}
                    <input
                      ref={(el) => {
                        if (el) fileInputRefs.current.set(emotion, el);
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(emotion, file);
                      }}
                    />
                  </div>

                  {/* Label */}
                  <span className="text-xs text-[var(--color-text-secondary)] mt-1 capitalize">
                    {emotion}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-[var(--color-text-secondary)] italic">
            Tip: You only need to upload expressions you want to use. Missing expressions will fall
            back to the main avatar.
          </p>
        </div>
      </details>
    </div>
  );
}
