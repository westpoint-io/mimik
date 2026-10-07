import { i18n } from '@mimik/core/env';
import { getGuide, updateScreenshotEdits } from '@mimik/core/guides/service';
import { MAX_ZOOM, MIN_ZOOM, rezoomEdits, ZOOM_STEP } from '@mimik/core/screenshot/record';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mimik/ui';
import { ZoomIn } from 'lucide-react';
import { useState } from 'react';

const LEVELS = Array.from(
  { length: Math.round((MAX_ZOOM - MIN_ZOOM) / ZOOM_STEP) + 1 },
  (_, i) => MIN_ZOOM + i * ZOOM_STEP,
);

export function GuideZoom({ guideId, onDone }: { guideId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

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
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Select disabled={busy} onValueChange={apply}>
      <SelectTrigger
        aria-label={i18n.t('desktop_zoomLevel')}
        className="h-8 w-auto gap-1.5 rounded-lg border-border bg-card px-3 text-[13px] font-medium text-foreground hover:bg-secondary hover:text-accent"
      >
        <ZoomIn size={14} />
        {i18n.t('desktop_zoomGuide')}
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
