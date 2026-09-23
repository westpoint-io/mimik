// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { HoverRing } from '@/lib/hover-ring';
import { sendMessage } from '@/lib/messaging';
import { type CaptureHandle, startCapture } from '../handlers';

vi.mock('@/lib/messaging', () => ({ sendMessage: vi.fn(), onMessage: vi.fn() }));

vi.mock('@/lib/browser-api/local-storage', () => ({
  localStorage: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

const VIEWPORT_WIDTH = 1000;
const VIEWPORT_HEIGHT = 800;

interface Deferred {
  promise: Promise<{ stepId: string }>;
  resolve: () => void;
}

function deferred(): Deferred {
  let release!: () => void;
  const promise = new Promise<{ stepId: string }>((resolve) => {
    release = () => resolve({ stepId: 'step-1' });
  });
  return { promise, resolve: release };
}

let pending: Deferred[];
let showSpy: MockInstance<(el: Element) => void>;
let hideSpy: MockInstance<() => void>;
let handle: CaptureHandle;

function place(tag: string, width = 120, height = 40): HTMLElement {
  const el = document.createElement(tag);
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height }),
  });
  document.body.appendChild(el);
  return el;
}

function hover(el: Element) {
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
}

function click(el: Element) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 }));
}

async function settle(turns = 12) {
  for (let i = 0; i < turns; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function resolveAllPending() {
  for (const d of pending) d.resolve();
  pending = [];
}

beforeEach(() => {
  document.body.innerHTML = '';
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: VIEWPORT_WIDTH });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEWPORT_HEIGHT });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    setTimeout(() => cb(0), 0);
    return 0;
  });
  pending = [];
  vi.mocked(sendMessage).mockImplementation((() => {
    const d = deferred();
    pending.push(d);
    return d.promise;
  }) as unknown as typeof sendMessage);
  showSpy = vi.spyOn(HoverRing.prototype, 'show');
  hideSpy = vi.spyOn(HoverRing.prototype, 'hide');
  handle = startCapture('guide-1');
});

afterEach(() => {
  handle.stop();
  resolveAllPending();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('hover ring targeting', () => {
  it('shows the ring on a hovered element', () => {
    const button = place('button');

    hover(button);

    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(showSpy).toHaveBeenCalledWith(button);
  });

  it('hides the ring when hovering into an embedded frame', () => {
    const button = place('button');
    const frame = place('iframe', 400, 300);

    hover(button);
    showSpy.mockClear();
    hover(frame);

    expect(showSpy).not.toHaveBeenCalled();
    expect(hideSpy).toHaveBeenCalled();
  });

  it('hides the ring when hovering an element wider than 80% of the viewport', () => {
    const button = place('button');
    const banner = place('div', VIEWPORT_WIDTH * 0.9, 60);

    hover(button);
    showSpy.mockClear();
    hover(banner);

    expect(showSpy).not.toHaveBeenCalled();
    expect(hideSpy).toHaveBeenCalled();
  });

  it('hides the ring when hovering an element taller than 80% of the viewport', () => {
    const button = place('button');
    const sidebar = place('div', 80, VIEWPORT_HEIGHT * 0.9);

    hover(button);
    showSpy.mockClear();
    hover(sidebar);

    expect(showSpy).not.toHaveBeenCalled();
    expect(hideSpy).toHaveBeenCalled();
  });
});

describe('hover ring while a capture is pending', () => {
  it('hides the ring the moment a click is enqueued', () => {
    const button = place('button');

    hover(button);
    hideSpy.mockClear();
    click(button);

    expect(hideSpy).toHaveBeenCalled();
  });

  it('never shows the ring while the capture message is unresolved', async () => {
    const button = place('button');

    hover(button);
    click(button);
    showSpy.mockClear();

    await settle();

    expect(pending.length).toBeGreaterThan(0);
    expect(showSpy).not.toHaveBeenCalled();
  });

  it('never shows the ring when hovering a different element mid-capture', async () => {
    const first = place('button');
    const second = place('button');

    hover(first);
    click(first);
    showSpy.mockClear();

    hover(second);
    await settle();
    hover(first);
    await settle();

    expect(pending.length).toBeGreaterThan(0);
    expect(showSpy).not.toHaveBeenCalled();
  });

  it('never shows the ring mid-capture even for a text field click that opens an input session', async () => {
    const field = place('input');
    field.setAttribute('type', 'text');
    const button = place('button');

    hover(field);
    click(field);
    showSpy.mockClear();

    hover(button);
    await settle();

    expect(pending.length).toBeGreaterThan(0);
    expect(showSpy).not.toHaveBeenCalled();
  });
});

describe('hover ring after the queue drains', () => {
  it('shows the ring again on the element hovered most recently', async () => {
    const first = place('button');
    const second = place('button');

    hover(first);
    click(first);
    hover(second);
    showSpy.mockClear();

    await settle();
    resolveAllPending();
    await settle();

    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(showSpy).toHaveBeenCalledWith(second);
  });

  it('does not show the ring when the hovered element left the document mid-capture', async () => {
    const button = place('button');

    hover(button);
    click(button);
    button.remove();
    showSpy.mockClear();

    await settle();
    resolveAllPending();
    await settle();

    expect(showSpy).not.toHaveBeenCalled();
  });

  it('does not show the ring when the pointer left the element mid-capture', async () => {
    const button = place('button');

    hover(button);
    click(button);
    button.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    showSpy.mockClear();

    await settle();
    resolveAllPending();
    await settle();

    expect(showSpy).not.toHaveBeenCalled();
  });
});

describe('hover ring after stop', () => {
  it('does not show the ring once capture has stopped', async () => {
    const button = place('button');

    hover(button);
    click(button);
    handle.stop();
    showSpy.mockClear();

    resolveAllPending();
    await settle();

    expect(showSpy).not.toHaveBeenCalled();
  });

  it('ignores hover events after capture has stopped', async () => {
    const button = place('button');

    handle.stop();
    showSpy.mockClear();

    hover(button);
    await settle();

    expect(showSpy).not.toHaveBeenCalled();
  });
});
