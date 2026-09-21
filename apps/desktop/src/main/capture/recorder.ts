import { randomUUID } from 'node:crypto';
import type { CaptureImage } from '@mimik/core/capture/sink';
import type { ElementMeta } from '@mimik/core/guides/types';
import { screen } from 'electron';
import { cursorPoint } from './displays';
import {
  elementAt,
  focusedField,
  isTextField,
  keyLabel,
  resetDeadKeyState,
  resolveKey,
  type ScreenElement,
} from './element';
import { focusedWindow } from './focused-window';
import { type InputAction, InputHook, type KeyAction, type PointerAction } from './input-hook';
import type { Region } from './region';
import { type Capture, captureArea, type Rect } from './screenshot';
import { writeScreenshot } from './screenshot-store';
import { type CaptureMode, type CaptureSettings, DEFAULT_CAPTURE_SETTINGS } from './settings';

const TARGET_SIZE = 28;
const SETTLE_MS = 60;
const REPEAT_CLICK_MS = 500;
const TEXT_MARKERS = /[\uFFF9-\uFFFD\uFEFF\u200B]/g;
const LONG_FIELD_CHARS = 80;

const KEY = {
  escape: 1,
  backspace: 14,
  tab: 15,
  enter: 28,
  ctrl: 29,
  shift: 42,
  shiftRight: 54,
  alt: 56,
  capsLock: 58,
  numpadEnter: 3612,
  ctrlRight: 3613,
  altRight: 3640,
  meta: 3675,
  metaRight: 3676,
} as const;

const MODIFIER_KEYS: ReadonlySet<number> = new Set([
  KEY.ctrl,
  KEY.ctrlRight,
  KEY.shift,
  KEY.shiftRight,
  KEY.alt,
  KEY.altRight,
  KEY.meta,
  KEY.metaRight,
  KEY.capsLock,
]);

const COMMIT_KEYS: ReadonlySet<number> = new Set([KEY.enter, KEY.numpadEnter, KEY.tab, KEY.escape]);

export interface Point {
  x: number;
  y: number;
}

export interface CursorMark extends Point {
  style: CaptureSettings['cursorStyle'];
  scale: number;
}

export interface CaptureRequest {
  action: string;
  elementMeta: ElementMeta;
  image: CaptureImage;
  inputValue?: string;
  cursor?: CursorMark;
}

export interface RecorderHooks {
  grab?: (area: Rect) => Promise<Capture>;
  settings?: () => CaptureSettings;
  ignores?: (point: Point) => boolean;
  lookup?: (point: Point) => Promise<ScreenElement | null>;
  focused?: () => Promise<ScreenElement | null>;
  label?: (keycode: number) => Promise<string | null>;
  resolve?: (keycode: number, shift: boolean, ctrl: boolean, alt: boolean) => Promise<string | null>;
  reset?: () => Promise<void>;
}

export type RecorderStart = { ok: true } | { ok: false; reason: string; detail: string };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inside(region: Region, point: Point): boolean {
  return (
    point.x >= region.x &&
    point.y >= region.y &&
    point.x < region.x + region.width &&
    point.y < region.y + region.height
  );
}

export function isRepeatClick(previousAt: number | null, at: number): boolean {
  return previousAt !== null && at - previousAt <= REPEAT_CLICK_MS;
}

export function shouldCapture(settings: CaptureSettings, region: Region, point: Point): boolean {
  if (settings.captureMode !== 'region') return true;
  return inside(region, point) || settings.captureOutsideClicks;
}

export function frameFor(mode: CaptureMode, point: Point, region: Region, window: Rect | null): Rect {
  const display = screen.getDisplayNearestPoint(point).bounds;
  if (mode === 'screen') return display;
  if (mode === 'window') return window && inside(window, point) ? window : display;
  return inside(region, point) ? region : display;
}

export function isRepeatKey(previous: { keycode: number; at: number } | null, keycode: number, at: number): boolean {
  return previous !== null && previous.keycode === keycode && at - previous.at <= REPEAT_CLICK_MS;
}

export function comboLabel(action: KeyAction, key: string): string {
  const held: string[] = [];
  if (action.meta) held.push('Meta');
  if (action.ctrl) held.push('Ctrl');
  if (action.alt) held.push('Alt');
  if (action.shift) held.push('Shift');
  return [...held, key].join('+');
}

export function clickAction(button: number): string {
  return button === 2 ? 'auxclick' : 'click';
}

export function chooseTypedText(field: ScreenElement | null, buffer: string, smart = true): string | null {
  if (!isTextField(field)) return null;
  if (!smart) return buffer || null;
  const value = (field?.textContent ?? '').replace(TEXT_MARKERS, '');
  if (!value.trim()) return buffer || null;
  const typed = [...buffer].length;
  if (typed > 0 && [...value].length > Math.max(2 * typed, LONG_FIELD_CHARS)) return buffer;
  return value;
}

export function matchesShortcut(accelerator: string | null, action: KeyAction, key: string): boolean {
  if (!accelerator) return false;
  const parts = accelerator
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const wanted = parts.pop();
  if (!wanted || wanted !== key.toLowerCase()) return false;

  const held = new Set(parts);
  const either = held.has('commandorcontrol') || held.has('cmdorctrl');
  const onMac = process.platform === 'darwin';
  return (
    held.has('alt') === action.alt &&
    held.has('shift') === action.shift &&
    (held.has('control') || held.has('ctrl') || (either && !onMac)) === action.ctrl &&
    (held.has('super') || held.has('meta') || held.has('cmd') || held.has('command') || (either && onMac)) ===
      action.meta
  );
}

export function isTypingKey(action: KeyAction): boolean {
  if (MODIFIER_KEYS.has(action.keycode)) return false;
  if (action.ctrl || action.alt || action.meta) return false;
  return !COMMIT_KEYS.has(action.keycode);
}

export function targetRect(element: ScreenElement | null, framed: Rect, point: Point): ElementMeta['rect'] {
  const local = { x: point.x - framed.x, y: point.y - framed.y };
  const box = {
    x: local.x - TARGET_SIZE / 2,
    y: local.y - TARGET_SIZE / 2,
    width: TARGET_SIZE,
    height: TARGET_SIZE,
  };
  const rect = element?.rect;
  if (!rect) return box;
  if (rect.width * rect.height > framed.width * framed.height * 0.5) return box;
  const inner = { x: rect.x - framed.x, y: rect.y - framed.y, width: rect.width, height: rect.height };
  if (inner.x < 0 || inner.y < 0) return box;
  if (inner.x + inner.width > framed.width || inner.y + inner.height > framed.height) return box;
  return inner;
}

export function centreOf(element: ScreenElement | null): Point | null {
  const rect = element?.rect;
  if (!rect) return null;
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export class DesktopRecorder {
  private hook = new InputHook();
  private queue: Promise<unknown> = Promise.resolve();
  private paused = false;
  private running = false;
  private lastClickAt: number | null = null;
  private lastKey: { keycode: number; at: number } | null = null;
  private typing = false;
  private buffer = '';
  private appending: Promise<unknown> = Promise.resolve();
  private idle: NodeJS.Timeout | null = null;
  private readonly grab: (area: Rect) => Promise<Capture>;
  private readonly settings: () => CaptureSettings;
  private readonly ignores: (point: Point) => boolean;
  private readonly lookup: (point: Point) => Promise<ScreenElement | null>;
  private readonly focused: () => Promise<ScreenElement | null>;
  private readonly label: (keycode: number) => Promise<string | null>;
  private readonly resolve: (keycode: number, shift: boolean, ctrl: boolean, alt: boolean) => Promise<string | null>;
  private readonly reset: () => Promise<void>;

  constructor(
    private readonly region: () => Region,
    private readonly withHidden: <T>(fn: () => Promise<T>) => Promise<T>,
    private readonly send: (request: CaptureRequest) => Promise<unknown>,
    hooks: RecorderHooks = {},
  ) {
    this.grab = hooks.grab ?? captureArea;
    this.settings = hooks.settings ?? (() => DEFAULT_CAPTURE_SETTINGS);
    this.ignores = hooks.ignores ?? (() => false);
    this.lookup = hooks.lookup ?? elementAt;
    this.focused = hooks.focused ?? focusedField;
    this.label = hooks.label ?? keyLabel;
    this.resolve = hooks.resolve ?? resolveKey;
    this.reset = hooks.reset ?? resetDeadKeyState;
  }

  async start(): Promise<RecorderStart> {
    if (this.running) return { ok: true };
    const started = await this.hook.start((action) => this.onAction(action));
    if (!started.ok) return { ok: false, reason: started.reason, detail: started.detail };
    this.running = true;
    this.paused = false;
    this.lastClickAt = null;
    return { ok: true };
  }

  pause(): void {
    this.commitTyping();
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  stop(): void {
    this.commitTyping();
    this.hook.stop();
    this.running = false;
    this.paused = false;
  }

  get isRecording(): boolean {
    return this.running && !this.paused;
  }

  private onAction(action: InputAction): void {
    if (!this.isRecording) return;
    if (action.kind === 'click') this.onClick(action);
    else this.onKey(action);
  }

  private onClick(action: PointerAction): void {
    const point = { x: action.x, y: action.y };
    if (this.ignores(point)) return;
    if (!shouldCapture(this.settings(), this.region(), point)) return;
    const at = Date.now();
    const repeat = isRepeatClick(this.lastClickAt, at);
    this.lastClickAt = at;
    if (repeat) return;
    this.commitTyping();
    const named = clickAction(action.button);
    this.enqueue(() => this.write(named, point, this.lookup(point)));
  }

  private onKey(action: KeyAction): void {
    if (MODIFIER_KEYS.has(action.keycode)) return;
    const settings = this.settings();
    if (isTypingKey(action)) {
      if (!settings.captureTyping) return;
      this.typing = true;
      this.buffered(action);
      if (this.idle) clearTimeout(this.idle);
      this.idle = setTimeout(() => this.commitTyping(), settings.typingDebounceMs);
      this.idle.unref?.();
      return;
    }

    const submitted = this.typing;
    this.commitTyping();

    const at = Date.now();
    const repeat = isRepeatKey(this.lastKey, action.keycode, at);
    this.lastKey = { keycode: action.keycode, at };
    if (repeat) return;
    if (submitted && !action.ctrl && !action.alt && !action.meta) return;
    if (!settings.captureKeys) return;
    this.enqueue(() => this.captureKey(action));
  }

  async captureKey(action: KeyAction): Promise<void> {
    const key = await this.label(action.keycode);
    if (!key) return;
    const { shortcuts } = this.settings();
    if (Object.values(shortcuts).some((accelerator) => matchesShortcut(accelerator, action, key))) return;
    const field = await this.focused();
    await this.write(`keydown:${comboLabel(action, key)}`, centreOf(field) ?? cursorPoint(), Promise.resolve(field));
  }

  private buffered(action: KeyAction): void {
    this.appending = this.appending.then(async () => {
      if (action.keycode === KEY.backspace) {
        this.buffer = [...this.buffer].slice(0, -1).join('');
        return;
      }
      const typed = await this.resolve(action.keycode, action.shift, action.ctrl, action.alt);
      if (typed) this.buffer += typed;
    });
  }

  private commitTyping(): void {
    if (this.idle) {
      clearTimeout(this.idle);
      this.idle = null;
    }
    if (!this.typing) return;
    this.typing = false;
    this.enqueue(async () => {
      await this.appending;
      const buffer = this.buffer;
      this.buffer = '';
      await this.reset();
      await this.captureTyping(buffer);
    });
  }

  private enqueue(job: () => Promise<void>): void {
    this.queue = this.queue.then(job).catch((error) => {
      process.stderr.write(`mimik: capture failed: ${error instanceof Error ? error.message : String(error)}\n`);
    });
  }

  captureNow(point: Point): void {
    if (!this.isRecording) return;
    this.commitTyping();
    this.enqueue(() => this.write('click', point, this.lookup(point)));
  }

  async capture(point: Point): Promise<void> {
    await this.write('click', point, this.lookup(point));
  }

  async captureTyping(buffer = ''): Promise<void> {
    const field = await this.focused();
    const where = centreOf(field) ?? cursorPoint();
    if (field?.password) {
      await this.write('input', where, Promise.resolve(field));
      return;
    }
    const typed = chooseTypedText(field, buffer, this.settings().typingSmartDetection);
    if (!typed) return;
    await this.write('input', where, Promise.resolve(field), typed);
  }

  private async write(
    action: string,
    point: Point,
    element: Promise<ScreenElement | null>,
    inputValue?: string,
  ): Promise<void> {
    const settings = this.settings();
    const region = this.region();

    const taken = await this.withHidden(async () => {
      await delay(SETTLE_MS + settings.screenshotDelayMs);
      const focused = await focusedWindow();
      const rect = frameFor(settings.captureMode, point, region, focused.ok ? focused.window.bounds : null);
      return { found: focused, framed: rect, shot: await this.grab(rect) };
    });
    const { found, framed, shot } = taken;
    const scale = shot.scaleFactor;

    const screenshotId = randomUUID();
    const local = { x: point.x - framed.x, y: point.y - framed.y };
    const target = await element;

    await this.send({
      action,
      elementMeta: {
        source: target ? 'uia' : 'screen',
        textContent: target?.textContent ?? null,
        ariaLabel: target?.ariaLabel ?? null,
        placeholder: null,
        altText: target?.altText ?? null,
        name: target?.name ?? null,
        role: target?.role ?? null,
        rect: targetRect(target, framed, point),
        ...(target?.password ? { inputType: 'password' } : {}),
        devicePixelRatio: scale,
        clickPoint: local,
        ...(found.ok ? { app: found.window.app, window: { title: found.window.title } } : {}),
      },
      image: {
        screenshotId,
        src: writeScreenshot(screenshotId, shot.png),
        width: shot.width,
        height: shot.height,
      },
      ...(inputValue === undefined ? {} : { inputValue }),
      ...(settings.showCursor && action === 'click'
        ? { cursor: { x: local.x, y: local.y, style: settings.cursorStyle, scale } }
        : {}),
    });
  }

  async drain(): Promise<void> {
    await this.queue;
  }
}
