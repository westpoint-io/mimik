import { i18n } from '@mimik/core/env';
import { icon } from '../icons';
import { el } from './el';
import type { Region } from './types';

const MIN = { width: 60, height: 30 };

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;

type Handle = (typeof HANDLES)[number];

function normalise(a: { x: number; y: number }, b: { x: number; y: number }): Region {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.max(Math.abs(a.x - b.x), MIN.width),
    height: Math.max(Math.abs(a.y - b.y), MIN.height),
  };
}

export function editor(origin: { x: number; y: number }): void {
  document.body.className = 'editor';

  const size = el('div', { id: 'size' });
  const region = el('div', { id: 'region', className: 'empty' }, size);
  for (const handle of HANDLES) {
    const node = el('div', { className: 'handle' });
    node.dataset.handle = handle;
    region.append(node);
  }

  const cancel = el(
    'button',
    { type: 'button', className: 'secondary' },
    i18n.t('common_cancel'),
    el('kbd', {}, 'Esc'),
  );
  const done = el(
    'button',
    { type: 'button', className: 'primary' },
    icon('check', 15),
    i18n.t('annotationEditor_done'),
    el('kbd', {}, 'Enter'),
  );
  cancel.addEventListener('click', () => window.mimikOverlay.command('cancel'));
  done.addEventListener('click', () => window.mimikOverlay.command('arm'));
  const bar = el(
    'div',
    { id: 'bar' },
    el('span', { id: 'barText' }, icon('area', 15), 'Drag to draw the capture area'),
    el('span', { id: 'barActions' }, cancel, done),
  );
  document.body.append(region, bar);

  let rect: Region | null = null;

  function paint(): void {
    if (!rect) {
      region.className = 'empty';
      return;
    }
    const local = { left: rect.x - origin.x, top: rect.y - origin.y };
    const onScreen =
      local.left + rect.width > 0 &&
      local.top + rect.height > 0 &&
      local.left < window.innerWidth &&
      local.top < window.innerHeight;
    region.className = onScreen ? '' : 'empty';
    region.style.left = `${local.left}px`;
    region.style.top = `${local.top}px`;
    region.style.width = `${rect.width}px`;
    region.style.height = `${rect.height}px`;
    size.textContent = `${rect.width} × ${rect.height}`;
  }

  function commit(next: Region): void {
    rect = next;
    paint();
    window.mimikOverlay.setRegion(next);
  }

  document.body.addEventListener('pointerdown', (event) => {
    const target = event.target as HTMLElement;
    if (bar.contains(target)) return;
    const handle = target.dataset.handle as Handle | undefined;
    const moving = !handle && region.contains(target) && rect !== null;
    const start = { x: event.clientX + origin.x, y: event.clientY + origin.y };
    const from = rect ? { ...rect } : null;

    document.body.setPointerCapture(event.pointerId);
    event.preventDefault();

    const move = (e: PointerEvent) => {
      const point = { x: e.clientX + origin.x, y: e.clientY + origin.y };
      if (handle && from) {
        const left = handle.includes('w') ? point.x : from.x;
        const top = handle.includes('n') ? point.y : from.y;
        const right = handle.includes('e') ? point.x : from.x + from.width;
        const bottom = handle.includes('s') ? point.y : from.y + from.height;
        commit(normalise({ x: left, y: top }, { x: right, y: bottom }));
      } else if (moving && from) {
        commit({ ...from, x: from.x + (point.x - start.x), y: from.y + (point.y - start.y) });
      } else {
        commit(normalise(start, point));
      }
    };

    const up = () => {
      document.body.removeEventListener('pointermove', move);
      document.body.removeEventListener('pointerup', up);
    };

    document.body.addEventListener('pointermove', move);
    document.body.addEventListener('pointerup', up);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') window.mimikOverlay.command('arm');
    if (event.key === 'Escape') window.mimikOverlay.command('cancel');
  });

  window.mimikOverlay.region().then((current) => {
    rect = current;
    paint();
  });
  window.mimikOverlay.onUpdate(({ region: current }) => {
    rect = current;
    paint();
  });
}
