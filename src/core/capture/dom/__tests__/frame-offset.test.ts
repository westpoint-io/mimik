// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  contentOrigin,
  frameOffset,
  installFrameOffsetResponder,
  NO_OFFSET,
  translateMeta,
} from '@/core/capture/dom/frame-offset';
import type { ElementMeta } from '@/core/guides/types';

function meta(over: Partial<ElementMeta> = {}): ElementMeta {
  return {
    tag: 'input',
    cssSelector: '#vehicle1',
    textContent: null,
    ariaLabel: null,
    placeholder: null,
    altText: null,
    name: 'vehicle1',
    role: 'input',
    href: null,
    inputType: 'checkbox',
    dataTestId: null,
    rect: { x: 20, y: 30, width: 13, height: 13 },
    devicePixelRatio: 1,
    ...over,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('translateMeta', () => {
  it('moves a frame-local rect into top-frame coordinates', () => {
    // The jsfiddle reproduction: the result frame sits at 981,527.
    const moved = translateMeta(meta(), { x: 981, y: 527 });
    expect(moved.rect).toEqual({ x: 1001, y: 557, width: 13, height: 13 });
  });

  it('moves the click point with the rect, so the marker lands on the element', () => {
    const moved = translateMeta(meta({ clickPoint: { x: 26, y: 36 } }), { x: 981, y: 527 });
    expect(moved.clickPoint).toEqual({ x: 1007, y: 563 });
  });

  it('leaves a top-frame capture untouched', () => {
    const original = meta({ clickPoint: { x: 26, y: 36 } });
    expect(translateMeta(original, NO_OFFSET)).toBe(original);
  });

  it('keeps every other field of the meta intact', () => {
    const moved = translateMeta(meta(), { x: 10, y: 10 });
    expect(moved).toMatchObject({ cssSelector: '#vehicle1', inputType: 'checkbox', name: 'vehicle1' });
  });

  it('does not invent a click point where there was none', () => {
    expect(translateMeta(meta(), { x: 10, y: 10 }).clickPoint).toBeUndefined();
  });
});

describe('contentOrigin', () => {
  it('starts inside the frame border and padding, where the child coordinates do', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 200 } as DOMRect);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      borderLeftWidth: '2px',
      borderTopWidth: '4px',
      paddingLeft: '6px',
      paddingTop: '8px',
    } as CSSStyleDeclaration);

    expect(contentOrigin(frame)).toEqual({ x: 108, y: 212 });
  });

  it('treats missing style values as no edge rather than NaN', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({ left: 50, top: 60 } as DOMRect);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({} as CSSStyleDeclaration);

    expect(contentOrigin(frame)).toEqual({ x: 50, y: 60 });
  });
});

describe('frameOffset in the top frame', () => {
  it('does not ask anyone, because there is nothing above it', async () => {
    const post = vi.spyOn(window, 'postMessage');
    await expect(frameOffset()).resolves.toEqual(NO_OFFSET);
    expect(post).not.toHaveBeenCalled();
  });
});

describe('frameOffset in a child frame', () => {
  function pretendNested() {
    const parent = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(window, 'parent', { configurable: true, value: parent });
    Object.defineProperty(window, 'top', { configurable: true, value: parent });
    return {
      parent,
      restore: () => {
        Object.defineProperty(window, 'parent', { configurable: true, value: window });
        Object.defineProperty(window, 'top', { configurable: true, value: window });
      },
    };
  }

  it('takes the offset its parent reports', async () => {
    const { parent, restore } = pretendNested();
    const pending = frameOffset();

    const request = vi.mocked(parent.postMessage).mock.calls[0][0] as { id: string };
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { channel: 'mimik-frame-offset', kind: 'response', id: request.id, x: 981, y: 527 },
        source: parent,
      }),
    );

    await expect(pending).resolves.toEqual({ x: 981, y: 527 });
    restore();
  });

  it('ignores an answer that does not match the question it asked', async () => {
    vi.useFakeTimers();
    const { parent, restore } = pretendNested();
    const pending = frameOffset();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { channel: 'mimik-frame-offset', kind: 'response', id: 'someone-elses', x: 999, y: 999 },
        source: parent,
      }),
    );
    await vi.advanceTimersByTimeAsync(400);

    await expect(pending).resolves.toEqual(NO_OFFSET);
    vi.useRealTimers();
    restore();
  });

  it('gives up rather than stalling the capture when no parent answers', async () => {
    vi.useFakeTimers();
    const { restore } = pretendNested();
    const pending = frameOffset();

    await vi.advanceTimersByTimeAsync(400);

    await expect(pending).resolves.toEqual(NO_OFFSET);
    vi.useRealTimers();
    restore();
  });
});

describe('the responder', () => {
  function childFrame(rect: { left: number; top: number }) {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({} as CSSStyleDeclaration);
    return frame;
  }

  function ask(source: Window | null, id = 'req-1') {
    window.dispatchEvent(
      new MessageEvent('message', { data: { channel: 'mimik-frame-offset', kind: 'request', id }, source }),
    );
  }

  it('tells a child frame where it sits', async () => {
    const stop = installFrameOffsetResponder();
    const frame = childFrame({ left: 981, top: 527 });
    const child = frame.contentWindow as Window;
    const replies: unknown[] = [];
    vi.spyOn(child, 'postMessage').mockImplementation(((msg: unknown) => replies.push(msg)) as never);

    ask(child);
    await Promise.resolve();
    await Promise.resolve();

    expect(replies).toEqual([{ channel: 'mimik-frame-offset', kind: 'response', id: 'req-1', x: 981, y: 527 }]);
    stop();
  });

  it('ignores a window that is not one of its frames', async () => {
    const stop = installFrameOffsetResponder();
    const stranger = { postMessage: vi.fn() } as unknown as Window;

    ask(stranger);
    await Promise.resolve();
    await Promise.resolve();

    expect(stranger.postMessage).not.toHaveBeenCalled();
    stop();
  });

  it('ignores traffic that is not an offset request', async () => {
    const stop = installFrameOffsetResponder();
    const frame = childFrame({ left: 10, top: 10 });
    const child = frame.contentWindow as Window;
    const post = vi.spyOn(child, 'postMessage').mockImplementation((() => {}) as never);

    window.dispatchEvent(new MessageEvent('message', { data: { hello: 'there' }, source: child }));
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { channel: 'mimik-frame-offset', kind: 'response', id: 'x' },
        source: child,
      }),
    );
    await Promise.resolve();

    expect(post).not.toHaveBeenCalled();
    stop();
  });

  it('stops answering once torn down', async () => {
    const stop = installFrameOffsetResponder();
    const frame = childFrame({ left: 10, top: 10 });
    const child = frame.contentWindow as Window;
    const post = vi.spyOn(child, 'postMessage').mockImplementation((() => {}) as never);

    stop();
    ask(child);
    await Promise.resolve();

    expect(post).not.toHaveBeenCalled();
  });
});
