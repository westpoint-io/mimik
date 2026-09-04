import type { ElementMeta } from '@/core/guides/types';

/**
 * `getBoundingClientRect` is relative to the frame it runs in, but the
 * screenshot is of the whole tab. A click inside an iframe therefore reports a
 * rect that is short by the iframe's own position, and the target outline lands
 * that far from the element it is meant to circle.
 *
 * A frame asks its parent where it sits; the parent adds its own offset and
 * answers, so the sum walks all the way up to the top frame. Nothing here can
 * reach across origins by hand — `frameElement` throws on a cross-origin parent,
 * which is exactly the case a fiddle or an embedded widget puts us in — so it
 * goes over postMessage, which crosses origins by design.
 */

const CHANNEL = 'mimik-frame-offset';
const REPLY_TIMEOUT_MS = 300;
const FRAME_SELECTOR = 'iframe, frame, embed, object';

export interface FrameOffset {
  x: number;
  y: number;
}

export const NO_OFFSET: FrameOffset = { x: 0, y: 0 };

interface OffsetRequest {
  channel: typeof CHANNEL;
  kind: 'request';
  id: string;
}

interface OffsetResponse {
  channel: typeof CHANNEL;
  kind: 'response';
  id: string;
  x: number;
  y: number;
}

function isRequest(data: unknown): data is OffsetRequest {
  const msg = data as OffsetRequest | null;
  return !!msg && msg.channel === CHANNEL && msg.kind === 'request' && typeof msg.id === 'string';
}

function isResponse(data: unknown): data is OffsetResponse {
  const msg = data as OffsetResponse | null;
  return (
    !!msg &&
    msg.channel === CHANNEL &&
    msg.kind === 'response' &&
    typeof msg.id === 'string' &&
    Number.isFinite(msg.x) &&
    Number.isFinite(msg.y)
  );
}

/** The child frame element whose document sent this message, if it is ours. */
function frameFor(source: MessageEventSource | null): Element | null {
  if (!source) return null;
  for (const frame of document.querySelectorAll(FRAME_SELECTOR)) {
    if ((frame as HTMLIFrameElement).contentWindow === source) return frame;
  }
  return null;
}

/**
 * Where a frame's content box starts. The child's coordinates begin inside the
 * border and padding, not at the element's edge.
 */
export function contentOrigin(frame: Element): FrameOffset {
  const rect = frame.getBoundingClientRect();
  const style = frame.ownerDocument.defaultView?.getComputedStyle(frame);
  const edge = (value: string | undefined) => {
    const px = Number.parseFloat(value ?? '0');
    return Number.isFinite(px) ? px : 0;
  };
  return {
    x: rect.left + edge(style?.borderLeftWidth) + edge(style?.paddingLeft),
    y: rect.top + edge(style?.borderTopWidth) + edge(style?.paddingTop),
  };
}

/** This frame's position within the top frame. `{0,0}` when already on top. */
export function frameOffset(): Promise<FrameOffset> {
  if (window.self === window.top || !window.parent || window.parent === window.self) {
    return Promise.resolve(NO_OFFSET);
  }

  return new Promise<FrameOffset>((resolve) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let settled = false;

    const finish = (offset: FrameOffset) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(offset);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || !isResponse(event.data) || event.data.id !== id) return;
      finish({ x: event.data.x, y: event.data.y });
    };

    // A parent without the content script never answers, so fall back to the
    // untranslated rect rather than holding the capture queue open.
    const timer = setTimeout(() => finish(NO_OFFSET), REPLY_TIMEOUT_MS);

    window.addEventListener('message', onMessage);
    const request: OffsetRequest = { channel: CHANNEL, kind: 'request', id };
    window.parent.postMessage(request, '*');
  });
}

/**
 * Answer offset requests from child frames. Only frames of this document get an
 * answer, and the reply carries nothing but geometry.
 */
export function installFrameOffsetResponder(): () => void {
  const onMessage = (event: MessageEvent) => {
    if (!isRequest(event.data)) return;
    const frame = frameFor(event.source);
    if (!frame) return;

    const child = event.source as Window;
    const local = contentOrigin(frame);
    void frameOffset().then((own) => {
      const response: OffsetResponse = {
        channel: CHANNEL,
        kind: 'response',
        id: (event.data as OffsetRequest).id,
        x: own.x + local.x,
        y: own.y + local.y,
      };
      child.postMessage(response, '*');
    });
  };

  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

/** Move a frame-local rect and click point into top-frame coordinates. */
export function translateMeta(meta: ElementMeta, offset: FrameOffset): ElementMeta {
  if (offset.x === 0 && offset.y === 0) return meta;
  return {
    ...meta,
    rect: { ...meta.rect, x: meta.rect.x + offset.x, y: meta.rect.y + offset.y },
    clickPoint: meta.clickPoint
      ? { x: meta.clickPoint.x + offset.x, y: meta.clickPoint.y + offset.y }
      : meta.clickPoint,
  };
}
