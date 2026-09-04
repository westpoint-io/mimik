// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/lib/messaging';
import { type CaptureHandle, startCapture } from '../handlers';

vi.mock('@/lib/messaging', () => ({ sendMessage: vi.fn(), onMessage: vi.fn() }));

vi.mock('@/lib/browser-api', () => ({
  localStorage: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) },
}));

interface Deferred {
  promise: Promise<{ stepId: string }>;
  resolve: () => void;
  reject: (err: Error) => void;
}

let pending: Deferred[];
let handle: CaptureHandle;

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<{ stepId: string }>((ok, no) => {
    resolve = () => ok({ stepId: 'step-1' });
    reject = no;
  });
  return { promise, resolve, reject };
}

function place(tag: string): HTMLElement {
  const el = document.createElement(tag);
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ x: 4, y: 6, top: 6, left: 4, right: 124, bottom: 46, width: 120, height: 40 }),
  });
  document.body.appendChild(el);
  return el;
}

function userClick(el: Element, over: MouseEventInit = {}) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 20, ...over });
  Object.defineProperty(event, 'isTrusted', { configurable: true, value: true });
  el.dispatchEvent(event);
  return event;
}

async function settle(turns = 16) {
  for (let i = 0; i < turns; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    setTimeout(() => cb(0), 0);
    return 0;
  });
  pending = [];
  vi.mocked(sendMessage).mockClear();
  vi.mocked(sendMessage).mockImplementation((() => {
    const d = deferred();
    pending.push(d);
    return d.promise;
  }) as unknown as typeof sendMessage);
  handle = startCapture('guide-1');
});

afterEach(() => {
  handle.stop();
  for (const d of pending) d.resolve();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('click interception', () => {
  it('keeps the click from the page until the screenshot has been taken', async () => {
    const button = place('button');
    let seen = 0;
    button.addEventListener('click', () => {
      seen += 1;
    });

    userClick(button);
    await settle();

    expect(seen).toBe(0);
    expect(sendMessage).toHaveBeenCalledWith('captureStep', expect.anything());
  });

  it('performs the click once the capture resolves', async () => {
    const button = place('button');
    let seen = 0;
    button.addEventListener('click', () => {
      seen += 1;
    });

    userClick(button);
    await settle();
    expect(seen).toBe(0);

    for (const d of pending) d.resolve();
    await settle();

    expect(seen).toBe(1);
  });

  it('still performs the click when the capture fails, so nothing is swallowed', async () => {
    const button = place('button');
    let seen = 0;
    button.addEventListener('click', () => {
      seen += 1;
    });

    userClick(button);
    await settle();
    for (const d of pending) d.reject(new Error('background gone'));
    await settle();

    expect(seen).toBe(1);
  });

  it('does not record its own replay as a second step', async () => {
    const button = place('button');

    userClick(button);
    await settle();
    for (const d of pending) d.resolve();
    await settle();

    expect(vi.mocked(sendMessage).mock.calls.filter((c) => c[0] === 'captureStep')).toHaveLength(1);
  });

  it('lets a shift-click through untouched and records nothing', async () => {
    const button = place('button');
    let seen = 0;
    button.addEventListener('click', () => {
      seen += 1;
    });

    userClick(button, { shiftKey: true });
    await settle();

    expect(seen).toBe(1);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('leaves a text field click to the typing session rather than replaying it', async () => {
    const field = place('input');
    let seen = 0;
    field.addEventListener('click', () => {
      seen += 1;
    });

    userClick(field);
    await settle();

    expect(seen).toBe(1);
  });
});

describe('toggle controls', () => {
  function placeCheckbox(): HTMLInputElement {
    const box = place('input') as HTMLInputElement;
    box.type = 'checkbox';
    return box;
  }

  function recordCheckedAtCapture(box: HTMLInputElement): boolean[] {
    const seen: boolean[] = [];
    vi.mocked(sendMessage).mockImplementation(((name: string) => {
      if (name === 'captureStep') seen.push(box.checked);
      const d = deferred();
      pending.push(d);
      return d.promise;
    }) as unknown as typeof sendMessage);
    return seen;
  }

  it('screenshots a checkbox after it flips, not in the state it is leaving', async () => {
    const box = placeCheckbox();
    const checkedAtCapture = recordCheckedAtCapture(box);

    userClick(box);
    await settle();

    expect(box.checked).toBe(true);
    expect(checkedAtCapture).toEqual([true]);
  });

  it('screenshots an unchecking click as unchecked', async () => {
    const box = placeCheckbox();
    box.checked = true;
    const checkedAtCapture = recordCheckedAtCapture(box);

    userClick(box);
    await settle();

    expect(box.checked).toBe(false);
    expect(checkedAtCapture).toEqual([false]);
  });

  it('does not hold the toggle back from the page', async () => {
    const box = placeCheckbox();
    let seen = 0;
    box.addEventListener('click', () => {
      seen += 1;
    });

    userClick(box);
    await settle();

    expect(seen).toBe(1);
  });

  it('records the toggle once, not once per replay', async () => {
    const box = placeCheckbox();

    userClick(box);
    await settle();
    for (const d of pending) d.resolve();
    await settle();

    expect(vi.mocked(sendMessage).mock.calls.filter((c) => c[0] === 'captureStep')).toHaveLength(1);
  });
});
