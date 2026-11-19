import { i18n } from '@mimik/core/env';
import { getGuides } from '@mimik/core/guides/service';
import type { Guide } from '@mimik/core/guides/types';
import { logger } from '@mimik/core/logger';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FaviconImg } from '../../common/components/FaviconImg';
import { formatRelativeTime } from '../../common/lib/format-relative-time';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { loadCardData } from '../../library/lib/load-card-data';
import type { GuidePlace } from '../../library/types';

interface CopyStepsDialogProps {
  open: boolean;
  guideId: string;
  count: number;
  onCancel: () => void;
  onCopy: (targetGuideId: string | null) => void;
}

const NEW_GUIDE = 'new';

export function CopyStepsDialog({ open, guideId, count, onCancel, onCopy }: CopyStepsDialogProps) {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [places, setPlaces] = useState<Map<string, GuidePlace>>(new Map());
  const [query, setQuery] = useState('');
  const [samePlace, setSamePlace] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSamePlace(false);
    setChoice(null);
    let cancelled = false;
    getGuides()
      .then(async (all) => {
        const { places } = await loadCardData(all);
        if (cancelled) return;
        setGuides(all.filter((guide) => guide.id !== guideId));
        setPlaces(places);
      })
      .catch((err) => logger.error(' Loading guides to copy into failed', err));
    return () => {
      cancelled = true;
    };
  }, [open, guideId]);

  const here = places.get(guideId);
  const needle = query.trim().toLowerCase();
  const shown = guides.filter(
    (guide) =>
      guide.title.toLowerCase().includes(needle) && (!samePlace || (here && places.get(guide.id)?.name === here.name)),
  );
  const chip = (on: boolean) =>
    `px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${
      on
        ? 'border-chip-on-border bg-chip-on text-chip-on-foreground'
        : 'border-chip-border bg-chip text-muted-foreground hover:border-chip-hover-border hover:bg-chip-hover hover:text-foreground'
    }`;
  const row = (on: boolean) =>
    `flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
      on ? 'border-accent bg-secondary' : 'border-border hover:bg-secondary'
    }`;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {count === 1 ? i18n.t('editor.copyStepTo') : i18n.t('editor.copyStepsTo', [String(count)])}
          </DialogTitle>
          <DialogDescription>{i18n.t('editor.copyStepsHint')}</DialogDescription>
        </DialogHeader>
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={i18n.t('editor.searchGuidesToCopyTo')}
          aria-label={i18n.t('editor.searchGuidesToCopyTo')}
        />
        {here && (
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-pressed={!samePlace}
              onClick={() => setSamePlace(false)}
              className={chip(!samePlace)}
            >
              {i18n.t('editor.allGuides')}
            </button>
            <button
              type="button"
              aria-pressed={samePlace}
              onClick={() => setSamePlace(true)}
              className={chip(samePlace)}
            >
              {here.kind === 'site' ? i18n.t('editor.sameSite') : i18n.t('editor.sameApp')}
            </button>
          </div>
        )}
        <div className="max-h-[240px] overflow-y-auto flex flex-col gap-1.5">
          <button
            type="button"
            aria-pressed={choice === NEW_GUIDE}
            onClick={() => setChoice(NEW_GUIDE)}
            className={row(choice === NEW_GUIDE)}
          >
            <Plus size={16} className="shrink-0 text-muted-foreground" />
            <span className="text-[13px] text-foreground truncate">{i18n.t('editor.newGuide')}</span>
          </button>
          {shown.map((guide) => {
            const place = places.get(guide.id);
            return (
              <button
                key={guide.id}
                type="button"
                aria-pressed={choice === guide.id}
                onClick={() => setChoice(guide.id)}
                className={row(choice === guide.id)}
              >
                {place ? (
                  <FaviconImg domain={place.name} size={16} letterOnly={place.kind === 'app'} appId={place.id} />
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <span className="flex flex-col min-w-0">
                  <span className="text-[13px] text-foreground truncate">{guide.title}</span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {guide.stepIds.length === 1
                      ? i18n.t('guide.stepCount', ['1'])
                      : i18n.t('guide.stepCountPlural', [String(guide.stepIds.length)])}{' '}
                    · {formatRelativeTime(guide.updatedAt)}
                  </span>
                </span>
              </button>
            );
          })}
          {shown.length === 0 && guides.length > 0 && (
            <p className="text-[13px] text-muted-foreground py-2">{i18n.t('editor.noGuidesToCopyTo')}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            {i18n.t('common.cancel')}
          </Button>
          <Button size="sm" disabled={choice === null} onClick={() => onCopy(choice === NEW_GUIDE ? null : choice)}>
            {count === 1 ? i18n.t('editor.copyStep') : i18n.t('editor.copySteps', [String(count)])}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
