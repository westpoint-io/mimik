import type { ElementMeta } from '@/core/guides/types';

export interface FramePlacement {
  x: number;
  y: number;
  scale: number;
}

export const IDENTITY: FramePlacement = { x: 0, y: 0, scale: 1 };

const KEY = 'mimikFramePlacement';
const ANSWER_TIMEOUT_MS = 250;
const FRAME_SELECTOR = 'iframe, frame, object';
const MAX_OFFSET_PX = 1e6;
const MIN_SCALE = 1e-3;
const MAX_SCALE = 1e3;

interface Ask {
  [KEY]: 'ask';
  id: string;
}

let asked = 0;

function isAsk(data: unknown): data is Ask {
  const msg = data as Partial<Ask> | null;
  return typeof msg === 'object' && msg !== null && msg[KEY] === 'ask' && typeof msg.id === 'string';
}

function isPlausibleOffset(value: unknown): value is number {
  return typeof value === 'number' && Math.abs(value) <= MAX_OFFSET_PX;
}

function isPlausibleScale(value: unknown): value is number {
  return typeof value === 'number' && value >= MIN_SCALE && value <= MAX_SCALE;
}

function readAnswer(data: unknown, id: string): FramePlacement | null {
  const msg = data as Record<string, unknown> | null;
  if (typeof msg !== 'object' || msg === null || msg[KEY] !== 'answer' || msg.id !== id) return null;
  const { x, y, scale } = msg;
  if (!isPlausibleOffset(x) || !isPlausibleOffset(y) || !isPlausibleScale(scale)) return null;
  return { x, y, scale };
}

function within(outer: FramePlacement, inner: FramePlacement): FramePlacement {
  return {
    x: outer.x + inner.x * outer.scale,
    y: outer.y + inner.y * outer.scale,
    scale: outer.scale * inner.scale,
  };
}

function isChildOf(win: Window, source: MessageEventSource | null): source is Window {
  return !!source && 'parent' in source && source.parent === win && source !== win;
}

function frameElementFor(root: Document | ShadowRoot, source: Window): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLIFrameElement>(FRAME_SELECTOR)) {
    if (el.contentWindow === source) return el;
  }
  for (const host of root.querySelectorAll('*')) {
    const hit = host.shadowRoot && frameElementFor(host.shadowRoot, source);
    if (hit) return hit;
  }
  return null;
}

export function contentBox(frame: HTMLElement): FramePlacement {
  const box = frame.getBoundingClientRect();
  const scale = frame.offsetWidth > 0 && box.width > 0 ? box.width / frame.offsetWidth : 1;
  const style = frame.ownerDocument.defaultView?.getComputedStyle(frame);
  const inset = (border?: string, padding?: string) =>
    ((Number.parseFloat(border ?? '') || 0) + (Number.parseFloat(padding ?? '') || 0)) * scale;
  return {
    x: box.left + inset(style?.borderLeftWidth, style?.paddingLeft),
    y: box.top + inset(style?.borderTopWidth, style?.paddingTop),
    scale,
  };
}

export function locateFrame(win: Window = window): Promise<FramePlacement> {
  const parent = win.parent;
  if (!parent || parent === win) return Promise.resolve(IDENTITY);

  const id = `${Date.now().toString(36)}.${++asked}.${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    const settle = (placement: FramePlacement) => {
      clearTimeout(timer);
      win.removeEventListener('message', onMessage);
      resolve(placement);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== parent) return;
      const placement = readAnswer(event.data, id);
      if (placement) settle(placement);
    };
    const timer = setTimeout(() => settle(IDENTITY), ANSWER_TIMEOUT_MS);
    win.addEventListener('message', onMessage);
    parent.postMessage({ [KEY]: 'ask', id } satisfies Ask, '*');
  });
}

export function answerChildFrames(win: Window = window): () => void {
  const onMessage = (event: MessageEvent) => {
    const ask = event.data;
    const child = event.source;
    if (!isAsk(ask) || !isChildOf(win, child)) return;
    const frame = frameElementFor(win.document, child);
    if (!frame) return;
    const local = contentBox(frame);
    void locateFrame(win).then((own) => {
      child.postMessage({ [KEY]: 'answer', id: ask.id, ...within(own, local) }, '*');
    });
  };
  win.addEventListener('message', onMessage);
  return () => win.removeEventListener('message', onMessage);
}

export function placeInTab(meta: ElementMeta, at: FramePlacement): ElementMeta {
  if (at.x === 0 && at.y === 0 && at.scale === 1) return meta;
  const point = (p: { x: number; y: number }) => ({ x: at.x + p.x * at.scale, y: at.y + p.y * at.scale });
  return {
    ...meta,
    rect: { ...point(meta.rect), width: meta.rect.width * at.scale, height: meta.rect.height * at.scale },
    ...(meta.clickPoint ? { clickPoint: point(meta.clickPoint) } : {}),
  };
}
