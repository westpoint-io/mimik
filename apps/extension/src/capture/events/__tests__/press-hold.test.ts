// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/lib/messaging';
import { type CaptureHandle, startCapture } from '../handlers';

vi.mock('@/lib/messaging', () => ({ sendMessage: vi.fn(), onMessage: vi.fn() }));

vi.mock('@/lib/browser-api/local-storage', () => ({
  localStorage: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) },
}));

let handle: CaptureHandle;
let release: Array<() => void>;

function place(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  for (const el of host.querySelectorAll('*')) {
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ x: 4, y: 6, top: 6, left: 4, right: 124, bottom: 46, width: 120, height: 40 }),
    });
  }
  document.body.appendChild(host);
  return host;
}

function trusted<T extends Event>(event: T): T {
  Object.defineProperty(event, 'isTrusted', { configurable: true, value: true });
  return event;
}

function pointer(type: string, at = { x: 10, y: 20 }) {
  const init = { bubbles: true, cancelable: true, composed: true, clientX: at.x, clientY: at.y, button: 0 };
  return type.startsWith('pointer')
    ? trusted(new PointerEvent(type, { ...init, pointerType: 'mouse', pointerId: 1, isPrimary: true }))
    : trusted(new MouseEvent(type, init));
}

function press(el: Element) {
  el.dispatchEvent(pointer('pointerdown'));
  el.dispatchEvent(pointer('mousedown'));
}

function lift(el: Element) {
  el.dispatchEvent(pointer('pointerup'));
  el.dispatchEvent(pointer('mouseup'));
}

function userClick(el: Element) {
  press(el);
  lift(el);
  if (el.isConnected) el.dispatchEvent(pointer('click'));
}

function record(el: EventTarget, seen: string[]) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.addEventListener(type, () => seen.push(type));
  }
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
  release = [];
  vi.mocked(sendMessage).mockClear();
  vi.mocked(sendMessage).mockImplementation(
    (() =>
      new Promise((resolve) => release.push(() => resolve({ stepId: 'step-1' })))) as unknown as typeof sendMessage,
  );
  handle = startCapture('guide-1');
});

afterEach(() => {
  handle.stop();
  for (const done of release) done();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('holding back the press on a control', () => {
  it('records an item in a menu that commits and closes on mouse release', async () => {
    const host = place('<div role="menu"><div id="item" tabindex="-1">Statusbar</div></div>');
    const item = host.querySelector('#item')!;
    let chosen = '';
    document.addEventListener('mouseup', (e) => {
      const hit = (e.target as Element).closest('#item');
      if (hit) {
        chosen = hit.textContent ?? '';
        host.remove();
      }
    });

    userClick(item);
    await settle();

    expect(vi.mocked(sendMessage).mock.calls.filter((c) => c[0] === 'captureStep')).toHaveLength(1);
    expect(chosen).toBe('');

    for (const done of release) done();
    await settle();

    expect(chosen).toBe('Statusbar');
  });

  it('hands the page the full press, release and click, in order, once the capture is done', async () => {
    const host = place('<button id="b">Save</button>');
    const button = host.querySelector('#b')!;
    const seen: string[] = [];
    record(button, seen);

    userClick(button);
    await settle();
    expect(seen).toEqual([]);

    for (const done of release) done();
    await settle();

    expect(seen).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
  });

  it('keeps focus where the page keeps it when the page cancels the press', async () => {
    const host = place('<input id="field"><div role="listbox"><div id="opt" role="option" tabindex="-1">A</div></div>');
    const field = host.querySelector<HTMLInputElement>('#field')!;
    const option = host.querySelector('#opt')!;
    option.addEventListener('mousedown', (e) => e.preventDefault());
    field.focus();

    userClick(option);
    await settle();
    for (const done of release) done();
    await settle();

    expect(document.activeElement).toBe(field);
  });

  it('moves focus to the control when the page lets the press through', async () => {
    const host = place('<input id="field"><button id="b">Go</button>');
    host.querySelector<HTMLInputElement>('#field')!.focus();
    const button = host.querySelector<HTMLButtonElement>('#b')!;

    userClick(button);
    await settle();
    for (const done of release) done();
    await settle();

    expect(document.activeElement).toBe(button);
  });

  it('lets the press through at once when the pointer starts dragging', () => {
    const host = place('<div id="handle" role="button" tabindex="0">Drag me</div>');
    const knob = host.querySelector('#handle')!;
    const seen: string[] = [];
    record(knob, seen);

    press(knob);
    expect(seen).toEqual([]);
    knob.dispatchEvent(pointer('pointermove', { x: 60, y: 20 }));

    expect(seen).toEqual(['pointerdown', 'mousedown']);
  });

  it('lets the press through when no click follows the release', async () => {
    const host = place('<button id="b">Save</button>');
    const button = host.querySelector('#b')!;
    const seen: string[] = [];
    record(button, seen);

    press(button);
    lift(button);
    await settle();

    expect(seen).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup']);
  });

  it('never holds the press on a text field or on plain text', () => {
    const host = place('<input id="field"><p id="text">Some words</p>');
    const seen: string[] = [];
    record(host.querySelector('#field')!, seen);
    record(host.querySelector('#text')!, seen);

    press(host.querySelector('#field')!);
    press(host.querySelector('#text')!);

    expect(seen).toEqual(['pointerdown', 'mousedown', 'pointerdown', 'mousedown']);
  });
});
