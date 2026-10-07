import { i18n } from '@mimik/core/env';
import { ImageUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';

interface ReplaceImageDialogProps {
  open: boolean;
  onSelect: (file: File) => void;
  onCancel: () => void;
}

export function ReplaceImageDialog({ open, onSelect, onCancel }: ReplaceImageDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const take = (file: File | undefined) => {
    if (file?.type.startsWith('image/')) onSelect(file);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{i18n.t('screenshotView.replaceImage')}</DialogTitle>
          <DialogDescription>{i18n.t('screenshotView.replaceHint')}</DialogDescription>
        </DialogHeader>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            take(e.dataTransfer.files?.[0]);
          }}
          className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 transition-colors ${
            dragging ? 'border-accent bg-secondary' : 'border-border hover:border-accent hover:bg-secondary/50'
          }`}
        >
          <ImageUp size={26} className="text-accent" />
          <span className="text-[13px] font-semibold text-foreground">{i18n.t('screenshotView.replaceDrop')}</span>
          <span className="text-[11px] text-muted-foreground">{i18n.t('screenshotView.replaceFormats')}</span>
        </button>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {i18n.t('common.cancel')}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            take(file);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
