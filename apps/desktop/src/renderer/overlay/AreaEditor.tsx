import { i18n } from '@mimik/core/env';
import type { Rect } from '@mimik/core/rect';
import { Button } from '@mimik/ui';
import { Check, Crop } from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { dragRegion, type Handle } from './lib/drag-region';

const EDGE = 'left-[26px] right-[26px] h-3 cursor-ns-resize';
const SIDE = 'top-[26px] bottom-[26px] w-3 cursor-ew-resize';
const CORNER = 'size-[26px] border-mascot drop-shadow-[0_0_2px_rgba(0,0,0,0.5)]';

const HANDLES: { id: Handle; className: string }[] = [
  { id: 'nw', className: `${CORNER} -top-0.5 -left-0.5 border-t-4 border-l-4 cursor-nwse-resize` },
  { id: 'n', className: `${EDGE} -top-2` },
  { id: 'ne', className: `${CORNER} -top-0.5 -right-0.5 border-t-4 border-r-4 cursor-nesw-resize` },
  { id: 'e', className: `${SIDE} -right-2` },
  { id: 'se', className: `${CORNER} -bottom-0.5 -right-0.5 border-b-4 border-r-4 cursor-nwse-resize` },
  { id: 's', className: `${EDGE} -bottom-2` },
  { id: 'sw', className: `${CORNER} -bottom-0.5 -left-0.5 border-b-4 border-l-4 cursor-nesw-resize` },
  { id: 'w', className: `${SIDE} -left-2` },
];

const KEY = 'rounded-[5px] px-1.5 py-px text-[10.5px] font-semibold';

export function AreaEditor({ origin }: { origin: { x: number; y: number } }) {
  const [rect, setRect] = useState<Rect | null>(null);
  const region = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void window.mimikOverlay.region().then(setRect);
    window.mimikOverlay.onUpdate((view) => setRect(view.region));
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Enter') window.mimikOverlay.command('done');
      if (event.key === 'Escape') window.mimikOverlay.command('cancelEdit');
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, []);

  const commit = (next: Rect) => {
    setRect(next);
    window.mimikOverlay.setRegion(next);
  };

  const grab = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (bar.current?.contains(target)) return;
    const handle = (target.dataset.handle as Handle | undefined) ?? null;
    const moving = !handle && rect !== null && Boolean(region.current?.contains(target));
    const start = { x: Math.round(event.clientX + origin.x), y: Math.round(event.clientY + origin.y) };
    const from = rect ? { ...rect } : null;
    const surface = event.currentTarget;

    surface.setPointerCapture(event.pointerId);
    event.preventDefault();

    const move = (e: PointerEvent) =>
      commit(
        dragRegion(from, handle, moving, start, {
          x: Math.round(e.clientX + origin.x),
          y: Math.round(e.clientY + origin.y),
        }),
      );
    const up = () => {
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerup', up);
    };
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', up);
  };

  const left = rect ? rect.x - origin.x : 0;
  const top = rect ? rect.y - origin.y : 0;
  const onScreen =
    rect !== null &&
    left + rect.width > 0 &&
    top + rect.height > 0 &&
    left < window.innerWidth &&
    top < window.innerHeight;

  return (
    <div className="fixed inset-0 cursor-crosshair" onPointerDown={grab}>
      <div
        id="region"
        ref={region}
        hidden={!onScreen}
        style={rect ? { left, top, width: rect.width, height: rect.height } : undefined}
        className="absolute cursor-move border-2 border-white shadow-[0_0_0_100vmax_rgba(30,27,75,0.55)] after:pointer-events-none after:absolute after:-inset-0.5 after:border-2 after:border-dashed after:border-mascot after:content-['']"
      >
        <div
          id="size"
          className="absolute top-3 left-3 rounded-md bg-primary px-[9px] py-[3px] text-[11.5px] font-semibold text-white tabular-nums"
        >
          {rect ? `${Math.round(rect.width)} × ${Math.round(rect.height)}` : ''}
        </div>
        {HANDLES.map((handle) => (
          <div key={handle.id} data-handle={handle.id} className={`absolute z-[1] ${handle.className}`} />
        ))}
      </div>
      <div
        id="bar"
        ref={bar}
        className="absolute top-5 left-1/2 flex -translate-x-1/2 cursor-default items-center gap-3 rounded-xl border border-lavender bg-card py-2 pr-2 pl-4 shadow-[0_12px_30px_rgba(15,14,40,0.28)]"
      >
        <span className="flex items-center gap-2 text-[12.5px] font-medium whitespace-nowrap text-foreground">
          <Crop size={15} className="text-accent" />
          {i18n.t('desktop.drawArea')}
        </span>
        <span className="flex gap-2">
          <Button
            id="cancel"
            variant="outline"
            onClick={() => window.mimikOverlay.command('cancelEdit')}
            className="rounded-[10px] text-[12.5px] font-semibold"
          >
            {i18n.t('common.cancel')}
            <kbd className={`${KEY} bg-secondary text-foreground`}>Esc</kbd>
          </Button>
          <Button
            id="done"
            onClick={() => window.mimikOverlay.command('done')}
            className="rounded-[10px] text-[12.5px] font-semibold"
          >
            <Check size={15} />
            {i18n.t('annotationEditor.done')}
            <kbd className={`${KEY} bg-lavender/20 text-lavender`}>Enter</kbd>
          </Button>
        </span>
      </div>
    </div>
  );
}
