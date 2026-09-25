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

describe('toggles', () => {
  function checkbox(checked = false): HTMLInputElement {
    const box = place('input') as HTMLInputElement;
    box.type = 'checkbox';
    box.checked = checked;
    return box;
  }

  function checkedAtCapture(box: HTMLInputElement): boolean[] {
    const seen: boolean[] = [];
    vi.mocked(sendMessage).mockImplementation((async (type: string) => {
      if (type === 'captureStep') seen.push(box.checked);
      return { stepId: 'step-1' };
    }) as unknown as typeof sendMessage);
    return seen;
  }

  it('screenshots a checkbox once it is checked, not in the state it is leaving', async () => {
    const box = checkbox();
    const seen = checkedAtCapture(box);

    userClick(box);
    await settle();

    expect(seen).toEqual([true]);
    expect(box.checked).toBe(true);
  });

  it('screenshots an unchecking click as unchecked', async () => {
    const box = checkbox(true);
    const seen = checkedAtCapture(box);

    userClick(box);
    await settle();

    expect(seen).toEqual([false]);
    expect(box.checked).toBe(false);
  });

  it('records a click on the label once, with the box it drives already flipped', async () => {
    const label = place('label');
    label.innerHTML = '<input type="checkbox"><span>Remember me</span>';
    const box = label.querySelector('input') as HTMLInputElement;
    const seen = checkedAtCapture(box);

    userClick(label.querySelector('span') as HTMLElement);
    await settle();

    expect(seen).toEqual([true]);
    expect(box.checked).toBe(true);
  });

  it('shoots a checkbox in a closing menu while the menu is still open', async () => {
    const menu = place('div');
    menu.setAttribute('role', 'menu');
    menu.innerHTML = '<div role="menuitem" tabindex="0"><input type="checkbox"> Show hidden files</div>';
    const item = menu.firstElementChild as HTMLElement;
    item.addEventListener('click', () => {
      menu.hidden = true;
    });
    const box = menu.querySelector('input') as HTMLInputElement;
    const seen: Array<{ menuOpen: boolean }> = [];
    vi.mocked(sendMessage).mockImplementation((async () => {
      seen.push({ menuOpen: !menu.hidden });
      return { stepId: 'step-1' };
    }) as unknown as typeof sendMessage);

    userClick(box);
    await settle();

    expect(seen).toEqual([{ menuOpen: true }]);
    expect(box.checked).toBe(true);
    expect(menu.hidden).toBe(true);
  });

  it('treats a click on a switch knob as a click on the switch', async () => {
    const toggle = place('div');
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', 'false');
    toggle.innerHTML = '<span></span>';
    toggle.addEventListener('click', () => toggle.setAttribute('aria-checked', 'true'));
    const seen: Array<string | null> = [];
    vi.mocked(sendMessage).mockImplementation((async () => {
      seen.push(toggle.getAttribute('aria-checked'));
      return { stepId: 'step-1' };
    }) as unknown as typeof sendMessage);

    userClick(toggle.querySelector('span') as HTMLElement);
    await settle();

    expect(seen).toEqual(['true']);
  });

  it('lets a switch its own script flips through, so the shot shows it on', async () => {
    const toggle = place('button');
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', 'false');
    toggle.addEventListener('click', () => toggle.setAttribute('aria-checked', 'true'));
    const seen: Array<string | null> = [];
    vi.mocked(sendMessage).mockImplementation((async () => {
      seen.push(toggle.getAttribute('aria-checked'));
      return { stepId: 'step-1' };
    }) as unknown as typeof sendMessage);

    userClick(toggle);
    await settle();

    expect(seen).toEqual(['true']);
  });
});

describe('inside a frame', () => {
  let frameX = 981;
  const parent = {
    postMessage: (ask: { id: string }) => {
      const x = frameX;
      setTimeout(() =>
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { mimikFramePlacement: 'answer', id: ask.id, x, y: 527, scale: 1 },
            source: parent as unknown as Window,
          }),
        ),
      );
    },
  };

  beforeEach(() => {
    frameX = 981;
    Object.defineProperty(window, 'parent', { configurable: true, value: parent });
  });

  afterEach(() => {
    Object.defineProperty(window, 'parent', { configurable: true, value: window });
  });

  function sent(type: string) {
    return vi.mocked(sendMessage).mock.calls.find((c) => c[0] === type)?.[1];
  }

  it('sends the rect and click point where the tab shows them, not where the frame does', async () => {
    userClick(place('button'));
    await settle();

    expect(sent('captureStep')).toMatchObject({
      elementMeta: { rect: { x: 985, y: 533, width: 120, height: 40 }, clickPoint: { x: 991, y: 547 } },
    });
  });

  it('asks where the frame is when the shot is taken, since the page may have scrolled since the click', async () => {
    userClick(place('button'));
    frameX = 1000;
    await settle();

    expect(sent('captureStep')).toMatchObject({ elementMeta: { rect: { x: 1004 } } });
  });

  it('places both the first and the final typing screenshot in the tab', async () => {
    vi.mocked(sendMessage).mockImplementation((async () => ({ stepId: 'step-1' })) as unknown as typeof sendMessage);
    const field = place('input') as HTMLInputElement;
    field.type = 'text';

    userClick(field);
    await settle();
    await handle.stop();

    const placed = { elementMeta: { rect: { x: 985, y: 533, width: 120, height: 40 } } };
    expect(sent('captureStep')).toMatchObject(placed);
    expect(sent('finalizeInputStep')).toMatchObject(placed);
  });
});
