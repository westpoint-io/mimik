import { randomUUID } from 'node:crypto';
import type { CaptureImage } from '@mimik/core/capture/sink';
import type { ElementMeta } from '@mimik/core/guides/types';
import { screen } from 'electron';
import { focusedWindow } from './focused-window';
import { type InputAction, InputHook } from './input-hook';
import type { Region } from './region';
import { type Capture, captureArea, type Rect } from './screenshot';
import { writeScreenshot } from './screenshot-store';
import { type CaptureSettings, DEFAULT_CAPTURE_SETTINGS } from './settings';

const TARGET_SIZE = 28;
const SETTLE_MS = 60;

export interface CursorMark {
  x: number;
  y: number;
  style: CaptureSettings['cursorStyle'];
  scale: number;
}

export interface CaptureRequest {
  action: string;
  elementMeta: ElementMeta;
  image: CaptureImage;
  cursor?: CursorMark;
}

export type RecorderStart = { ok: true } | { ok: false; reason: string; detail: string };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inside(region: Region, point: { x: number; y: number }): boolean {
  return (
    point.x >= region.x &&
    point.y >= region.y &&
    point.x < region.x + region.width &&
    point.y < region.y + region.height
  );
}

export function shouldCapture(settings: CaptureSettings, region: Region, point: { x: number; y: number }): boolean {
  return inside(region, point) || settings.captureOutsideClicks;
}

export class DesktopRecorder {
  private hook = new InputHook();
  private queue: Promise<unknown> = Promise.resolve();
  private paused = false;
  private running = false;

  constructor(
    private readonly region: () => Region,
    private readonly withHidden: <T>(fn: () => Promise<T>) => Promise<T>,
    private readonly send: (request: CaptureRequest) => Promise<unknown>,
    private readonly grab: (area: Rect) => Promise<Capture> = captureArea,
    private readonly settings: () => CaptureSettings = () => DEFAULT_CAPTURE_SETTINGS,
  ) {}

  async start(): Promise<RecorderStart> {
    if (this.running) return { ok: true };
    const started = await this.hook.start((action) => this.onAction(action));
    if (!started.ok) return { ok: false, reason: started.reason, detail: started.detail };
    this.running = true;
    this.paused = false;
    return { ok: true };
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  stop(): void {
    this.hook.stop();
    this.running = false;
    this.paused = false;
  }

  get isRecording(): boolean {
    return this.running && !this.paused;
  }

  private onAction(action: InputAction): void {
    if (action.kind !== 'click' || !this.isRecording) return;
    const point = { x: action.x, y: action.y };
    if (!shouldCapture(this.settings(), this.region(), point)) return;
    this.enqueue(point);
  }

  private enqueue(point: { x: number; y: number }): void {
    this.queue = this.queue
      .then(() => this.capture(point))
      .catch((error) => {
        process.stderr.write(`mimik: capture failed: ${error instanceof Error ? error.message : String(error)}\n`);
      });
  }

  async capture(point: { x: number; y: number }): Promise<void> {
    const settings = this.settings();
    const region = this.region();
    const framed = inside(region, point) ? region : screen.getDisplayNearestPoint(point).bounds;

    const shot = await this.withHidden(async () => {
      await delay(SETTLE_MS + settings.screenshotDelayMs);
      return this.grab(framed);
    });
    const scale = shot.scaleFactor;

    const screenshotId = randomUUID();
    const local = { x: point.x - framed.x, y: point.y - framed.y };
    const found = await focusedWindow();

    await this.send({
      action: 'click',
      elementMeta: {
        source: 'screen',
        textContent: null,
        ariaLabel: null,
        placeholder: null,
        altText: null,
        name: null,
        role: null,
        rect: {
          x: local.x - TARGET_SIZE / 2,
          y: local.y - TARGET_SIZE / 2,
          width: TARGET_SIZE,
          height: TARGET_SIZE,
        },
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
      ...(settings.showCursor ? { cursor: { x: local.x, y: local.y, style: settings.cursorStyle, scale } } : {}),
    });
  }

  async drain(): Promise<void> {
    await this.queue;
  }
}
