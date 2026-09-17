import { AlertTriangle, FileWarning, Loader2, Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { i18n } from '#imports';
import { importGuide } from '@/core/guides/service';
import type { ParsedBundle } from '@/core/transfer/parse';
import { BundleError } from '@/core/transfer/schema';
import { logger } from '@/lib/logger';
import { Button } from '@/ui/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog';

interface ImportGuideModalProps {
  file: File | null;
  onClose: () => void;
  onImported: (guideId: string) => void;
}

const errorKeys: Record<string, string> = {
  unreadable: 'import.errorUnreadable',
  'not-a-bundle': 'import.errorNotABundle',
  'unsupported-version': 'import.errorVersion',
  empty: 'import.errorEmpty',
};

export default function ImportGuideModal({ file, onClose, onImported }: ImportGuideModalProps) {
  const [bundle, setBundle] = useState<ParsedBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!file) return;
    let active = true;
    let url: string | null = null;

    setBundle(null);
    setError(null);
    setCover(null);

    (async () => {
      try {
        const { readBundle } = await import('@/core/transfer/parse');
        const parsed = await readBundle(file);
        if (!active) return;
        setBundle(parsed);

        const first = parsed.manifest.screenshots[0];
        const image = first ? parsed.images.get(first.file) : undefined;
        if (image) {
          url = URL.createObjectURL(image);
          setCover(url);
        }
      } catch (err) {
        if (!active) return;
        const kind = err instanceof BundleError ? err.kind : 'unreadable';
        setError(i18n.t(errorKeys[kind] as never));
        logger.error(' Bundle could not be read', err);
      }
    })();

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleImport = async () => {
    if (!bundle) return;
    setImporting(true);
    try {
      onImported(await importGuide(bundle));
    } catch (err) {
      setError(i18n.t('import.errorFailed'));
      logger.error(' Import failed', err);
    } finally {
      setImporting(false);
    }
  };

  const manifest = bundle?.manifest;
  const stepCount = manifest?.steps.length ?? 0;

  const notes = manifest
    ? [
        manifest.redacted.screenshots ? i18n.t('import.noteRedacted') : null,
        manifest.redacted.inputValues ? i18n.t('import.noteInputs') : null,
        manifest.redacted.urls === 'path' ? i18n.t('import.noteUrls') : null,
        manifest.redacted.urls === 'origin' ? i18n.t('import.noteUrlsOrigin') : null,
      ].filter((note): note is string => note !== null)
    : [];

  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold flex items-center gap-2">
            <Package size={16} className="text-accent" />
            {i18n.t('import.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">{i18n.t('import.dialogDescription')}</DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/50 px-3.5 py-3">
            <FileWarning size={16} className="text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[13px] text-foreground leading-snug">{error}</p>
          </div>
        ) : !manifest ? (
          <div className="flex items-center gap-2 py-6 justify-center text-[13px] text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            {i18n.t('import.reading')}
          </div>
        ) : (
          <div className="space-y-3">
            {cover && (
              <img
                src={cover}
                alt=""
                className="w-full rounded-lg border border-border object-cover max-h-40 bg-secondary"
              />
            )}

            <div>
              <div className="text-[15px] font-semibold text-foreground leading-snug">{manifest.guide.title}</div>
              <div className="text-[12px] text-muted-foreground mt-0.5">
                {stepCount === 1
                  ? i18n.t('fullview.stepCount', [String(stepCount)])
                  : i18n.t('fullview.stepCountPlural', [String(stepCount)])}
                {manifest.sourceDomain ? ` · ${manifest.sourceDomain}` : ''}
              </div>
            </div>

            {manifest.sourceDomain && (
              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/50 px-3.5 py-2.5">
                <AlertTriangle size={14} className="text-accent shrink-0 mt-0.5" />
                <p className="text-[12px] text-muted-foreground leading-snug">
                  {i18n.t('import.guideMeHint', [manifest.sourceDomain])}
                </p>
              </div>
            )}

            {notes.length > 0 && (
              <ul className="space-y-1 pl-1">
                {notes.map((note) => (
                  <li key={note} className="text-[11.5px] text-muted-foreground leading-snug">
                    · {note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={onClose} className="border border-border">
            {i18n.t('import.cancel')}
          </Button>
          <Button size="sm" disabled={!manifest || importing} onClick={handleImport}>
            {importing && <Loader2 size={14} className="animate-spin" />}
            {i18n.t('import.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
