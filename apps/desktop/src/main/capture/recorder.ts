import { randomUUID } from 'node:crypto';
import type { CaptureImage } from '@mimik/core/capture/sink';
import type { ElementMeta } from '@mimik/core/guides/types';
import { clipboard, screen } from 'electron';
import { shortcutLabel } from '../../renderer/lib/shortcut-label';
import { cursorPoint } from './displays';
import {
  clearDeadKey,
  elementAt,
  focusedField,
  isTextField,
  keyLabel,
  releaseWebContent,
  resolveKey,
  type ScreenElement,
} from './element';
import { type FocusedWindowResult, focusedWindow, windowAt } from './focused-window';
import { type InputAction, InputHook, type KeyAction, type PointerAction } from './input-hook';
import type { Region } from './region';
import { type Frame, grabDisplay, type Rect } from './screenshot';
import { writeScreenshot } from './screenshot-store';
import { type CaptureMode, type CaptureSettings, DEFAULT_CAPTURE_SETTINGS } from './settings';

const TARGET_SIZE = 28;
const SETTLE_MS = 60;
const SNAPSHOT_MS = 400;
const REPEAT_CLICK_MS = 500;
const HIDDEN_CHARACTERS = /[\p{Cf}\uFFFC\uFFFD]/gu;
const STEP_TEXT_LIMIT = 200;

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
  a: 30,
  v: 47,
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

export interface CaptureRequest {
  action: string;
  elementMeta: ElementMeta;
  image?: CaptureImage;
  inputValue?: string;
  zoomLevel?: number;
}

export interface RecorderHooks {
  grab?: (point: Point) => Promise<Frame>;
  settings?: () => CaptureSettings;
  ignores?: (point: Point) => boolean;
  lookup?: (point: Point) => Promise<ScreenElement | null>;
  focused?: () => Promise<ScreenElement | null>;
  windowAt?: (point: Point) => Promise<FocusedWindowResult>;
  label?: (keycode: number) => Promise<string | null>;
  resolve?: (keycode: number, shift: boolean, ctrl: boolean, alt: boolean) => Promise<string | null>;
  reset?: () => Promise<void>;
  release?: () => Promise<void>;
  drained?: () => void;
  progress?: (fraction: number, ms: number) => void;
  aimed?: (aim: { x: number; y: number; aspect: number }) => void;
  saved?: (src: string) => void;
}

export type RecorderStart = { ok: true } | { ok: false; reason: string; detail: string };

const CAPTURE_ESTIMATE_MS = 450;
const SECURE_INPUT_HIDES_KEYS = process.platform === 'darwin';
const FOCUS_SETTLE_MS = 200;
const PASSWORD_POLL_MS = 400;

interface PasswordWatch {
  field: ScreenElement;
  start: number;
  last: number;
  shot: Promise<Frame> | null;
  timer: NodeJS.Timeout;
  idle: NodeJS.Timeout | null;
}

function sameRect(a: ScreenElement['rect'], b: ScreenElement['rect']): boolean {
  return a?.x === b?.x && a?.y === b?.y && a?.width === b?.width && a?.height === b?.height;
}

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
  return inside(region, point) || settings.keepClicksBeyondArea;
}

export function frameFor(mode: CaptureMode, point: Point, region: Region, window: Rect | null): Rect {
  const display = screen.getDisplayNearestPoint(point).bounds;
  if (mode === 'screen') return display;
  if (mode === 'window') return window && inside(window, point) ? window : display;
  return region;
}

export function isRepeatKey(previous: { keycode: number; at: number } | null, keycode: number, at: number): boolean {
  return previous !== null && previous.keycode === keycode && at - previous.at <= REPEAT_CLICK_MS;
}

export function comboLabel(action: KeyAction, key: string, mac = process.platform === 'darwin'): string {
  const held: string[] = [];
  if (action.meta) held.push(mac ? 'Command' : 'Meta');
  if (action.ctrl) held.push('Ctrl');
  if (action.alt) held.push('Alt');
  if (action.shift) held.push('Shift');
  return mac ? shortcutLabel([...held, key].join('+'), true) : [...held, key].join('+');
}

export function clickAction(button: number): string {
  return button === 2 ? 'auxclick' : 'click';
}

export function typedTextFor(field: ScreenElement | null, buffer: string, readField = true): string | null {
  if (!field || !isTextField(field)) return null;
  if (!readField) return buffer || null;
  const shown = (field.textContent ?? '').replace(HIDDEN_CHARACTERS, '');
  if (!shown.trim()) return buffer || null;
  const wholeCanvas = /[\r\n]/.test(shown) || [...shown].length > STEP_TEXT_LIMIT;
  return buffer && wholeCanvas ? buffer : shown;
}

export function isBoundShortcut(accelerator: string | null, action: KeyAction, key: string): boolean {
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

export function isTextKey(action: KeyAction): boolean {
  if (MODIFIER_KEYS.has(action.keycode)) return false;
  if (action.ctrl || action.meta || (action.alt && process.platform !== 'darwin')) return false;
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

function centreOf(element: ScreenElement | null): Point | null {
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
  private keys = 0;
  private snapshot: { field: Promise<ScreenElement | null>; keys: number } | null = null;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private appending: Promise<unknown> = Promise.resolve();
  private idle: NodeJS.Timeout | null = null;
  private passwordWatch: PasswordWatch | null = null;
  private readonly grab: (point: Point) => Promise<Frame>;
  private readonly settings: () => CaptureSettings;
  private readonly ignores: (point: Point) => boolean;
  private readonly lookup: (point: Point) => Promise<ScreenElement | null>;
  private readonly focused: () => Promise<ScreenElement | null>;
  private readonly windowAt: (point: Point) => Promise<FocusedWindowResult>;
  private readonly label: (keycode: number) => Promise<string | null>;
  private readonly resolve: (keycode: number, shift: boolean, ctrl: boolean, alt: boolean) => Promise<string | null>;
  private readonly reset: () => Promise<void>;
  private readonly release: () => Promise<void>;
  private readonly drained: () => void;
  private readonly progress: (fraction: number, ms: number) => void;
  private readonly aimed: (aim: { x: number; y: number; aspect: number }) => void;
  private readonly saved: (src: string) => void;
  private pending = 0;

  constructor(
    private readonly region: () => Region,
    private readonly withHidden: <T>(fn: () => Promise<T>) => Promise<T>,
    private readonly send: (request: CaptureRequest) => Promise<unknown>,
    hooks: RecorderHooks = {},
  ) {
    this.grab = hooks.grab ?? grabDisplay;
    this.settings = hooks.settings ?? (() => DEFAULT_CAPTURE_SETTINGS);
    this.ignores = hooks.ignores ?? (() => false);
    this.lookup = hooks.lookup ?? elementAt;
    this.focused = hooks.focused ?? focusedField;
    this.windowAt = hooks.windowAt ?? windowAt;
    this.label = hooks.label ?? keyLabel;
    this.resolve = hooks.resolve ?? resolveKey;
    this.reset = hooks.reset ?? clearDeadKey;
    this.release = hooks.release ?? releaseWebContent;
    this.drained = hooks.drained ?? (() => {});
    this.progress = hooks.progress ?? (() => {});
    this.aimed = hooks.aimed ?? (() => {});
    this.saved = hooks.saved ?? (() => {});
  }

  async start(): Promise<RecorderStart> {
    if (this.running) return { ok: true };
    const started = await this.hook.start((action) => {
      if (this.isRecording) this.onAction(action);
    });
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
    void this.release().catch(() => undefined);
    this.running = false;
    this.paused = false;
  }

  get isRecording(): boolean {
    return this.running && !this.paused;
  }

  onAction(action: InputAction): void {
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
    this.clickAt(clickAction(action.button), point);
  }

  private clickAt(action: string, point: Point): void {
    this.commitTyping();
    this.watchPassword();
    const element = this.lookup(point);
    const frame = this.shoot(point);
    const place = this.windowAt(point).catch(() => focusedWindow());
    this.enqueue(() => this.write(action, point, element, frame, undefined, place));
  }

  private watchPassword(): void {
    if (!SECURE_INPUT_HIDES_KEYS || !this.settings().recordTyping) return;
    const settle = setTimeout(async () => {
      const field = await this.focused().catch(() => null);
      if (!field?.password || this.passwordWatch || !this.isRecording) return;
      const length = field.length ?? 0;
      const watch: PasswordWatch = {
        field,
        start: length,
        last: length,
        shot: null,
        timer: setInterval(() => void this.pollPassword(watch), PASSWORD_POLL_MS),
        idle: null,
      };
      watch.timer.unref?.();
      this.passwordWatch = watch;
    }, FOCUS_SETTLE_MS);
    settle.unref?.();
  }

  private async pollPassword(watch: PasswordWatch): Promise<void> {
    const now = await this.focused().catch(() => null);
    if (this.passwordWatch !== watch || !now) return;
    if (!now.password || !sameRect(now.rect, watch.field.rect)) {
      this.closePassword();
      return;
    }
    const length = now.length ?? watch.last;
    if (length === watch.last) return;
    watch.last = length;
    watch.shot = this.grab(centreOf(watch.field) ?? cursorPoint());
    watch.shot.catch(() => undefined);
    if (watch.idle) clearTimeout(watch.idle);
    watch.idle = setTimeout(() => {
      if (this.passwordWatch === watch) this.writePassword(watch, Promise.resolve(watch.last));
    }, this.settings().typingDebounceMs);
    watch.idle.unref?.();
  }

  private writePassword(watch: PasswordWatch, final: Promise<number>): void {
    if (watch.idle) clearTimeout(watch.idle);
    watch.idle = null;
    const { start, field } = watch;
    const centre = centreOf(field) ?? cursorPoint();
    const shot = watch.shot ?? this.grab(centre);
    shot.catch(() => undefined);
    watch.shot = null;
    watch.start = watch.last;
    this.enqueue(async () => {
      if ((await final) === start) return;
      const place = this.windowAt(centre).catch(() => focusedWindow());
      await this.write('input', centre, Promise.resolve(field), shot, undefined, place);
    });
  }

  private closePassword(): void {
    const watch = this.passwordWatch;
    if (!watch) return;
    this.passwordWatch = null;
    clearInterval(watch.timer);
    const final = this.focused()
      .catch(() => null)
      .then((now) => (now?.password && sameRect(now.rect, watch.field.rect) ? (now.length ?? watch.last) : watch.last));
    this.writePassword(watch, final);
  }

  private onKey(action: KeyAction): void {
    if (MODIFIER_KEYS.has(action.keycode)) return;
    const settings = this.settings();
    if (isTextKey(action)) {
      if (!settings.recordTyping) return;
      this.buffered(action);
      this.extendTyping(settings);
      return;
    }

    const primary = process.platform === 'darwin' ? action.meta : action.ctrl;
    if (primary && !action.alt && settings.recordTyping) {
      const pasted = action.keycode === KEY.v ? clipboard.readText() : '';
      if (pasted) {
        this.appending = this.appending.then(() => {
          this.buffer += pasted;
        });
        this.extendTyping(settings);
        return;
      }
      if (action.keycode === KEY.a && this.typing) {
        this.appending = this.appending.then(() => {
          this.buffer = '';
        });
        return;
      }
    }

    const submitted = this.typing;
    this.commitTyping(true);
    if (action.keycode === KEY.tab) this.watchPassword();

    const at = Date.now();
    const repeat = isRepeatKey(this.lastKey, action.keycode, at);
    this.lastKey = { keycode: action.keycode, at };
    if (repeat) return;
    if (submitted && !action.ctrl && !action.alt && !action.meta) return;
    if (!settings.recordKeys) return;
    this.enqueue(() => this.captureKey(action));
  }

  private extendTyping(settings: CaptureSettings): void {
    this.typing = true;
    this.keys += 1;
    if (this.idle) clearTimeout(this.idle);
    this.idle = setTimeout(() => this.commitTyping(true), settings.typingDebounceMs);
    this.idle.unref?.();
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.snapshotTimer = setTimeout(() => {
      this.snapshot = { field: this.focused().catch(() => null), keys: this.keys };
    }, SNAPSHOT_MS);
    this.snapshotTimer.unref?.();
  }

  async captureKey(action: KeyAction): Promise<void> {
    const key = await this.label(action.keycode);
    if (!key) return;
    const { shortcuts } = this.settings();
    if (Object.values(shortcuts).some((accelerator) => isBoundShortcut(accelerator, action, key))) return;
    const field = await this.focused();
    const where = centreOf(field) ?? cursorPoint();
    await this.write(`keydown:${comboLabel(action, key)}`, where, Promise.resolve(field), this.shoot(where));
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

  private commitTyping(live = false): void {
    this.closePassword();
    if (this.idle) clearTimeout(this.idle);
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.idle = null;
    this.snapshotTimer = null;
    const snapshot = live ? null : this.snapshot;
    this.snapshot = null;
    if (!this.typing) return;
    this.typing = false;
    const fresh = !snapshot || snapshot.keys === this.keys;
    const field = snapshot ? snapshot.field : this.focused().catch(() => null);
    const frame = field.then((found) => this.shoot(centreOf(found) ?? cursorPoint()));
    frame.catch(() => undefined);
    this.enqueue(async () => {
      await this.appending;
      const buffer = this.buffer;
      this.buffer = '';
      await this.reset();
      await this.writeTyping(buffer, { field: await field, fresh }, frame);
    });
  }

  private shoot(point: Point): Promise<Frame> {
    const { screenshotDelayMs, captureMode } = this.settings();
    const region = this.region();
    const at = captureMode === 'region' ? { x: region.x + region.width / 2, y: region.y + region.height / 2 } : point;
    const grabbed = this.withHidden(async () => {
      this.progress(0, 0);
      this.progress(0.9, screenshotDelayMs + CAPTURE_ESTIMATE_MS);
      await delay(screenshotDelayMs);
      return this.grab(at);
    });
    const frame = Promise.all([grabbed, delay(SETTLE_MS + screenshotDelayMs)]).then(([taken]) => taken);
    frame.catch(() => undefined);
    return frame;
  }

  private enqueue(job: () => Promise<void>): void {
    this.pending += 1;
    this.queue = this.queue
      .then(job)
      .catch((error) => {
        process.stderr.write(`mimik: capture failed: ${error instanceof Error ? error.message : String(error)}\n`);
      })
      .finally(() => {
        this.pending -= 1;
        if (this.pending === 0) this.drained();
      });
  }

  captureNow(point: Point): void {
    if (!this.isRecording) return;
    this.clickAt('click', point);
  }

  async capture(point: Point): Promise<void> {
    const element = this.lookup(point);
    const taken = this.shoot(point);
    const place = this.windowAt(point);
    place
      .then((found) => {
        const frame = frameFor(
          this.settings().captureMode,
          point,
          this.region(),
          found.ok ? found.window.bounds : null,
        );
        this.aimed({
          x: (point.x - frame.x) / frame.width,
          y: (point.y - frame.y) / frame.height,
          aspect: frame.width / frame.height,
        });
      })
      .catch(() => undefined);
    await this.write('click', point, element, taken, undefined, place);
  }

  async writeTyping(
    buffer = '',
    seen: { field: ScreenElement | null; fresh: boolean } | null = null,
    frame?: Promise<Frame>,
  ): Promise<void> {
    const field = seen ? seen.field : await this.focused();
    const centre = centreOf(field);
    const where = centre ?? cursorPoint();
    const shot = frame ?? this.shoot(where);
    const place = centre ? this.windowAt(centre).catch(() => focusedWindow()) : undefined;
    if (field?.password) {
      if (SECURE_INPUT_HIDES_KEYS) return;
      await this.write('input', where, Promise.resolve(field), shot, undefined, place);
      return;
    }
    const typed = typedTextFor(field, buffer, seen?.fresh ?? true);
    if (!typed) return;
    await this.write('input', where, Promise.resolve(field), shot, typed, place);
  }

  private async write(
    action: string,
    point: Point,
    element: Promise<ScreenElement | null>,
    taken: Promise<Frame>,
    inputValue?: string,
    place?: Promise<FocusedWindowResult>,
  ): Promise<void> {
    const settings = this.settings();
    const region = this.region();

    const lost = (error: unknown) => {
      process.stderr.write(`mimik: screenshot failed: ${error instanceof Error ? error.message : String(error)}\n`);
      return null;
    };
    const frame = await taken.catch(lost);
    const found = await (place ?? focusedWindow());
    const framed = frameFor(settings.captureMode, point, region, found.ok ? found.window.bounds : null);
    const image = frame
      ? await frame(framed)
          .then((shot) => {
            const screenshotId = randomUUID();
            const src = writeScreenshot(screenshotId, shot.png);
            this.saved(src);
            return { screenshotId, src, width: shot.width, height: shot.height, scale: shot.scaleFactor };
          })
          .catch(lost)
      : null;
    const scale = image?.scale ?? screen.getDisplayNearestPoint(point).scaleFactor;
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
        ...(target?.ancestors.length ? { ancestors: target.ancestors } : {}),
        ...(target?.children.length ? { children: target.children } : {}),
        ...(found.ok ? { app: found.window.app, window: { title: found.window.title } } : {}),
      },
      ...(image
        ? { image: { screenshotId: image.screenshotId, src: image.src, width: image.width, height: image.height } }
        : {}),
      ...(inputValue === undefined ? {} : { inputValue }),
      ...(settings.zoomLevel === null ? {} : { zoomLevel: settings.zoomLevel }),
    });
    this.progress(1, 150);
  }

  async drain(): Promise<void> {
    await this.queue;
  }
}
