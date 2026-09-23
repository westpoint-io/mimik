import { i18n } from '@mimik/core/env';
import { ImageUp } from 'lucide-react';
import { useState } from 'react';
import MascotIcon from '../../common/components/MascotIcon';
import ReplaceImageDialog from './ReplaceImageDialog';

interface ImagePlaceholderProps {
  label: string;
  ratio?: number;
  className?: string;
  onUpload?: (file: File) => void | Promise<void>;
}

const DEFAULT_RATIO = 16 / 10;

export default function ImagePlaceholder({
  label,
  ratio = DEFAULT_RATIO,
  className = '',
  onUpload,
}: ImagePlaceholderProps) {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/60 text-muted-foreground ${className}`}
      style={{ aspectRatio: ratio }}
    >
      <MascotIcon size={64} pose="lookaway" tone="muted" />
      <span className="text-[12px] font-semibold text-muted-foreground">{label}</span>
      {onUpload && (
        <>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-card/90 text-[11px] font-semibold text-foreground transition-colors hover:bg-secondary hover:text-accent"
          >
            <ImageUp size={13} />
            {i18n.t('screenshotView.addImage')}
          </button>
          <ReplaceImageDialog
            open={uploadOpen}
            onSelect={(file) => {
              setUploadOpen(false);
              void onUpload(file);
            }}
            onCancel={() => setUploadOpen(false)}
          />
        </>
      )}
    </div>
  );
}
