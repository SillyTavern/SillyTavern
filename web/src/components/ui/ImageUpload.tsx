import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from './Button';

interface ImageUploadProps {
  currentImage?: string;
  onImageSelect: (file: File | null) => void;
  label?: string;
}

export function ImageUpload({ currentImage, onImageSelect, label = 'Avatar' }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      onImageSelect(file);
    }
  };

  const handleClear = () => {
    setPreview(null);
    onImageSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayImage = preview || currentImage;

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
        {label}
      </label>

      <div className="flex items-start gap-4">
        {/* Preview Area */}
        <div className="relative">
          <div
            className={`
              w-24 h-24 rounded-lg border-2 border-dashed
              ${displayImage ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'}
              bg-[var(--color-bg-tertiary)]
              flex items-center justify-center
              overflow-hidden
            `}
          >
            {displayImage ? (
              <img
                src={displayImage}
                alt="Avatar preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <Upload size={24} className="text-[var(--color-text-secondary)]" />
            )}
          </div>

          {/* Clear button */}
          {preview && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1 flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} className="mr-2" />
            {displayImage ? 'Change Image' : 'Upload Image'}
          </Button>

          <p className="text-xs text-[var(--color-text-secondary)]">
            PNG, JPG, or GIF. Will be resized to 400x600.
          </p>
        </div>
      </div>
    </div>
  );
}
