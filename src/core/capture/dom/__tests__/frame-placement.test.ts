// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerChildFrames, contentBox, IDENTITY, locateFrame, placeInTab } from '@/core/capture/dom/frame-placement';
import type { ElementMeta } from '@/core/guides/types';

type Listener = (event: MessageEvent) => void;
interface FakeWindow {
  document: Document;
  parent: Pick<Window, 'postMessage'> | FakeWindow;
  listeners: Set<Listener>;
  addEventListener: (type: string, fn: Listener) => void;
  removeEventListener: (type: string, fn: Listener) => void;
  postMessage: (data: unknown) => void;
}

function deliver(to: FakeWindow, data: unknown, source: unknown) {
  const copy = structuredClone(data);
  setTimeout(() => {
    for (const fn of [...to.listeners]) fn({ data: copy, source } as MessageEvent);
  }, 0);
}

function fakeWindow(document: Document): FakeWindow {
  const listeners = new Set<Listener>();
  const win: FakeWindow = {
    document,
    parent: undefined as unknown as FakeWindow,
    listeners,
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
    postMessage: (data) => deliver(win, data, win.parent),
  };
  win.parent = win;
  return win;
}

interface Box {
  left: number;
  top: number;
  width?: number;
  offsetWidth?: number;
  style?: Partial<CSSStyleDeclaration>;
  root?: Document | ShadowRoot;
}

function embed(parent: FakeWindow, box: Box): { child: FakeWindow; frame: HTMLIFrameElement } {
  const frame = parent.document.createElement('iframe');
  ((box.root ?? parent.document.body) as ParentNode).appendChild(frame);
  const width = box.width ?? 300;
  frame.getBoundingClientRect = () =>
    ({ left: box.left, top: box.top, x: box.left, y: box.top, width, height: 150 }) as DOMRect;
  Object.defineProperty(frame, 'offsetWidth', { value: box.offsetWidth ?? width });
  Object.assign(frame.style, { border: '0' }, box.style ?? {});

  const child = fakeWindow(document.implementation.createHTMLDocument());
  const childAsParentSeesIt = { parent, postMessage: (data: unknown) => deliver(child, data, child.parent) };
  child.parent = { postMessage: (data: unknown) => deliver(parent, data, childAsParentSeesIt) } as Pick<
    Window,
    'postMessage'
  >;
  Object.defineProperty(frame, 'contentWindow', { value: childAsParentSeesIt });
  return { child, frame };
}

const asWindow = (win: FakeWindow) => win as unknown as Window;

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
    rect: { x: 8, y: 10, width: 13, height: 13 },
    devicePixelRatio: 2,
    ...over,
  };
}

const teardowns: Array<() => void> = [];

function answering(win: FakeWindow) {
  teardowns.push(answerChildFrames(asWindow(win)));
}

afterEach(() => {
  for (const stop of teardowns.splice(0)) stop();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('locateFrame', () => {
  it('asks nobody from the top frame, which is the tab', async () => {
    const top = fakeWindow(document);
    const post = vi.spyOn(top, 'postMessage');

    await expect(locateFrame(asWindow(top))).resolves.toEqual(IDENTITY);
    expect(post).not.toHaveBeenCalled();
  });

  it('takes the position its parent measures, even across origins', async () => {
    const top = fakeWindow(document);
    answering(top);
    const { child } = embed(top, { left: 981, top: 527 });

    await expect(locateFrame(asWindow(child))).resolves.toEqual({ x: 981, y: 527, scale: 1 });
  });

  it('starts inside the frame border and padding, where the child coordinates begin', async () => {
    const top = fakeWindow(document);
    answering(top);
    const { child } = embed(top, { left: 100, top: 50, style: { border: '2px solid', padding: '3px' } });

    await expect(locateFrame(asWindow(child))).resolves.toEqual({ x: 105, y: 55, scale: 1 });
  });

  it('adds up every frame between it and the tab', async () => {
    const top = fakeWindow(document);
    answering(top);
    const { child: middle } = embed(top, { left: 100, top: 50 });
    answering(middle);
    const { child: inner } = embed(middle, { left: 10, top: 20 });

    await expect(locateFrame(asWindow(inner))).resolves.toEqual({ x: 110, y: 70, scale: 1 });
  });

  it('carries a scaled frame through to the frames inside it', async () => {
    const top = fakeWindow(document);
    answering(top);
    const { child: middle } = embed(top, { left: 100, top: 50, width: 400, offsetWidth: 800 });
    answering(middle);
    const { child: inner } = embed(middle, { left: 10, top: 20 });

    await expect(locateFrame(asWindow(inner))).resolves.toEqual({ x: 105, y: 60, scale: 0.5 });
  });

  it('finds a frame a web component keeps in its shadow root', async () => {
    const top = fakeWindow(document);
    answering(top);
    const host = document.createElement('video-embed');
    document.body.appendChild(host);
    const { child } = embed(top, { left: 40, top: 60, root: host.attachShadow({ mode: 'open' }) });

    await expect(locateFrame(asWindow(child))).resolves.toEqual({ x: 40, y: 60, scale: 1 });
  });

  it('measures the frame that asked, not the first frame on the page', async () => {
    const top = fakeWindow(document);
    answering(top);
    embed(top, { left: 10, top: 10 });
    const { child } = embed(top, { left: 400, top: 250 });

    await expect(locateFrame(asWindow(child))).resolves.toEqual({ x: 400, y: 250, scale: 1 });
  });

  it.each([
    ['an offset', { x: 2e6, y: 0, scale: 1 }],
    ['a vertical offset', { x: 0, y: -2e6, scale: 1 }],
    ['a collapsed scale', { x: 0, y: 0, scale: 0 }],
    ['a runaway scale', { x: 0, y: 0, scale: 1e4 }],
  ])('refuses %s too large to be a real placement', async (_what, forged) => {
    vi.useFakeTimers();
    const top = fakeWindow(document);
    const { child } = embed(top, { left: 981, top: 527 });
    const parent = child.parent;
    parent.postMessage = (data: unknown) => {
      const { id } = data as { id: string };
      deliver(child, { mimikFramePlacement: 'answer', id, ...forged }, parent);
    };

    const placement = locateFrame(asWindow(child));
    await vi.advanceTimersByTimeAsync(1000);

    await expect(placement).resolves.toEqual(IDENTITY);
  });

  it('gives up and leaves the rect where it was when the parent never answers', async () => {
    vi.useFakeTimers();
    const top = fakeWindow(document);
    const { child } = embed(top, { left: 981, top: 527 });

    const placement = locateFrame(asWindow(child));
    await vi.advanceTimersByTimeAsync(1000);

    await expect(placement).resolves.toEqual(IDENTITY);
  });

  it('ignores an answer from a window other than its parent', async () => {
    vi.useFakeTimers();
    const top = fakeWindow(document);
    const { child } = embed(top, { left: 981, top: 527 });
    const stranger = fakeWindow(document.implementation.createHTMLDocument());
    const toParent = child.parent.postMessage;
    child.parent.postMessage = (data: unknown) => {
      const { id } = data as { id: string };
      deliver(child, { mimikFramePlacement: 'answer', id, x: 5, y: 5, scale: 1 }, stranger);
      toParent(data, '*');
    };

    const placement = locateFrame(asWindow(child));
    await vi.advanceTimersByTimeAsync(1000);

    await expect(placement).resolves.toEqual(IDENTITY);
  });
});

describe('answerChildFrames', () => {
  it('does not answer a window that is not one of its frames', async () => {
    const top = fakeWindow(document);
    answering(top);
    const stranger = fakeWindow(document.implementation.createHTMLDocument());
    const reply = vi.spyOn(stranger, 'postMessage');

    deliver(top, { mimikFramePlacement: 'ask', id: 'x' }, stranger);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(reply).not.toHaveBeenCalled();
  });

  it('turns a stranger away without searching the page for it', async () => {
    const top = fakeWindow(document);
    answering(top);
    embed(top, { left: 10, top: 10 });
    const search = vi.spyOn(document, 'querySelectorAll');

    deliver(top, { mimikFramePlacement: 'ask', id: 'x' }, fakeWindow(document.implementation.createHTMLDocument()));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(search).not.toHaveBeenCalled();
    search.mockRestore();
  });

  it('stops answering once torn down', async () => {
    vi.useFakeTimers();
    const top = fakeWindow(document);
    const stop = answerChildFrames(asWindow(top));
    const { child } = embed(top, { left: 981, top: 527 });
    stop();

    const placement = locateFrame(asWindow(child));
    await vi.advanceTimersByTimeAsync(1000);

    await expect(placement).resolves.toEqual(IDENTITY);
  });
});

describe('contentBox', () => {
  it('scales the border inset with a transformed frame', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400 }) as DOMRect;
    Object.defineProperty(frame, 'offsetWidth', { value: 800 });
    frame.style.border = '4px solid';

    expect(contentBox(frame)).toEqual({ x: 2, y: 2, scale: 0.5 });
  });

  it('treats a frame with no layout as unscaled rather than dividing by zero', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    frame.getBoundingClientRect = () => ({ left: 7, top: 9, width: 0 }) as DOMRect;
    frame.style.border = '0';

    expect(contentBox(frame)).toEqual({ x: 7, y: 9, scale: 1 });
  });
});

describe('placeInTab', () => {
  it('moves the rect and the click point by the same placement', () => {
    const placed = placeInTab(meta({ clickPoint: { x: 14, y: 16 } }), { x: 981, y: 527, scale: 1 });
    expect(placed.rect).toEqual({ x: 989, y: 537, width: 13, height: 13 });
    expect(placed.clickPoint).toEqual({ x: 995, y: 543 });
  });

  it('shrinks the rect with a scaled frame', () => {
    const placed = placeInTab(meta(), { x: 100, y: 50, scale: 0.5 });
    expect(placed.rect).toEqual({ x: 104, y: 55, width: 6.5, height: 6.5 });
  });

  it('keeps the rest of the meta, pixel ratio included', () => {
    const placed = placeInTab(meta(), { x: 1, y: 1, scale: 1 });
    expect(placed).toMatchObject({ cssSelector: '#vehicle1', inputType: 'checkbox', devicePixelRatio: 2 });
    expect(placed).not.toHaveProperty('clickPoint');
  });

  it('returns a top-frame meta untouched', () => {
    const original = meta();
    expect(placeInTab(original, IDENTITY)).toBe(original);
  });
});
