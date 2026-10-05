import { i18n } from '@mimik/core/env';
import { getGuide, updateScreenshotEdits } from '@mimik/core/guides/service';
import { currentZoom, MAX_ZOOM, MIN_ZOOM, rezoomEdits, ZOOM_STEP } from '@mimik/core/screenshot/record';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mimik/ui';
import { ZoomIn } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const LEVELS = Array.from(
  { length: Math.round((MAX_ZOOM - MIN_ZOOM) / ZOOM_STEP) + 1 },
  (_, i) => MIN_ZOOM + i * ZOOM_STEP,
);

export function GuideZoom({ guideId, onDone }: { guideId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<number | 'auto' | null>(null);

  const refresh = useCallback(async () => {
    const found = await getGuide(guideId);
    setCurrent(found ? currentZoom(found.screenshots.values()) : null);
  }, [guideId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const apply = async (value: string) => {
    setBusy(true);
    try {
      const found = await getGuide(guideId);
      if (!found) return;
      const level = value === 'auto' ? null : Number(value);
      for (const shot of found.screenshots.values()) {
        const next = rezoomEdits(shot, level);
        if (next) await updateScreenshotEdits(shot.id, next);
      }
      await refresh();
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Select
      disabled={busy}
      value={current === null ? '' : String(current)}
      onValueChange={apply}
      onOpenChange={(open) => open && refresh()}
    >
      <SelectTrigger
        aria-label={i18n.t('desktop_zoomLevel')}
        className="h-8 w-auto gap-1.5 rounded-lg border-border bg-card px-3 text-[13px] font-medium text-foreground hover:bg-secondary hover:text-accent"
      >
        <ZoomIn size={14} />
        <span className="@max-[960px]:hidden">{i18n.t('desktop_zoomGuide')}</span>
        {current !== null && (
          <span className="text-muted-foreground">
            <span className="@max-[960px]:hidden">· </span>
            {current === 'auto' ? i18n.t('desktop_zoomAuto') : `${current}×`}
          </span>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="auto">{i18n.t('desktop_zoomAuto')}</SelectItem>
        {LEVELS.map((level) => (
          <SelectItem key={level} value={String(level)}>
            {String(level)}&times;
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
