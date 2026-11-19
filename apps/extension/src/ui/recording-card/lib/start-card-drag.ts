import type { PointerEvent } from 'react';
import { postToPage } from './post-to-page';

export function startCardDrag(event: PointerEvent<HTMLElement>): void {
  if (event.button !== 0) return;
  const handle = event.currentTarget;
  handle.setPointerCapture(event.pointerId);
  let last = { x: event.screenX, y: event.screenY };
  const move = (next: globalThis.PointerEvent) => {
    postToPage({ mimikCard: 'move', dx: next.screenX - last.x, dy: next.screenY - last.y });
    last = { x: next.screenX, y: next.screenY };
  };
  const drop = () => {
    handle.removeEventListener('pointermove', move);
    postToPage({ mimikCard: 'drop' });
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('lostpointercapture', drop, { once: true });
}
