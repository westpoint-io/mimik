import { join } from 'node:path';
import type { AiFailureReason } from '@mimik/core/capture/ai/errors';
import {
  CaptureState,
  type CaptureStateValue,
  type captureMachine,
  type PauseReason,
} from '@mimik/core/capture/machine';
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import type { Actor } from 'xstate';
import { clampToDisplays, loadRegion, type Region, saveRegion } from '../capture/region';
import type { CaptureMode } from '../capture/settings';

export type CaptureActor = Actor<typeof captureMachine>;
export type OverlayCommand =
  | 'done'
  | 'cancelEdit'
  | 'disarm'
  | 'start'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'mode:window'
  | 'mode:screen'
  | 'mode:region'
  | 'deleteStep'
  | 'narration:start'
  | 'narration:stop'
  | 'intro:done';

export interface OverlayStep {
  id: string;
  index: number;
  title: string;
  action: string;
  src: string;
  source: 'heuristic' | 'ai' | 'narration';
  pending: boolean;
  app: string | null;
}

export interface OverlayProgress {
  percent: number;
  ms: number;
}

export interface OverlayShortcuts {
  startStop: string | null;
  capture: string | null;
}

export interface OverlayAiFailure {
  reason: AiFailureReason;
  provider: string;
}

export interface OverlayNarration {
  level: number;
  speaking: boolean;
}

export interface OverlayAim {
  x: number;
  y: number;
  aspect: number;
}

export interface OverlayPrint {
  src: string | null;
  aim: OverlayAim | null;
}

export interface OverlayView {
  state: CaptureStateValue;
  pauseReason: PauseReason | null;
  region: Region;
  step: OverlayStep | null;
  mode: CaptureMode;
  busy: boolean;
  progress: OverlayProgress;
  print: OverlayPrint;
  starting: boolean;
  shortcuts: OverlayShortcuts;
  aiFailure: OverlayAiFailure | null;
  narration: OverlayNarration | null;
}

export interface OverlayOptions {
  introFrame?: () => Promise<Region>;
  insert?: () => { insertTargetGuideId: string; insertAtIndex: number } | null;
  shortcuts?: () => OverlayShortcuts;
}

const BORDER = 3;
const CONTROLS = { width: 300, height: 190, margin: 24 };
const INTRO_LIMIT_MS = 6000;
const HIDE_SETTLE_MS = 60;
const NO_SHORTCUTS: OverlayShortcuts = { startStop: null, capture: null };

function rendererFile(): string {
  return join(__dirname, '../renderer/overlay.html');
}

function preloadFile(): string {
  return join(__dirname, '../preload/overlay.cjs');
}

function protect(win: BrowserWindow): void {
  if (!win.isDestroyed()) win.setContentProtection(true);
}

function overlayWindow(
  bounds: Electron.Rectangle,
  hash: string,
  interactive: boolean,
  focusable = interactive,
): BrowserWindow {
  const win = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable,
    acceptFirstMouse: true,
    webPreferences: { preload: preloadFile(), contextIsolation: true, nodeIntegration: false },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  app.dock?.hide();
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  void app.dock?.show();
  if (!interactive) win.setIgnoreMouseEvents(true);
  const load = process.env.ELECTRON_RENDERER_URL
    ? win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay.html#${hash}`)
    : win.loadFile(rendererFile(), { hash });
  load.catch((error) => {
    process.stderr.write(`overlay window ${hash} failed to load: ${error}\n`);
  });
  return win;
}

export class CaptureOverlay {
  private editors: BrowserWindow[] = [];
  private boundary: BrowserWindow | null = null;
  private controls: BrowserWindow | null = null;
  private anchor: { right: number; bottom: number } | null = null;
  private intro: BrowserWindow | null = null;
  private introDone: ((finished: boolean) => void) | null = null;
  private editing = false;
  private rect: Region;
  private step: OverlayStep | null = null;
  private size = { width: CONTROLS.width, height: CONTROLS.height };
  private busy = false;
  private progress: OverlayProgress = { percent: 0, ms: 0 };
  private print: OverlayPrint = { src: null, aim: null };
  private aiFailure: OverlayAiFailure | null = null;
  private narration: OverlayNarration | null = null;
  private modeBeforeEdit: CaptureMode | null = null;
  private hiding: { shown: BrowserWindow[]; ready: Promise<unknown>; users: number } | null = null;
  private starting = false;

  constructor(
    private capture: CaptureActor,
    private onCommand: (command: OverlayCommand) => void,
    private mode: () => CaptureMode = () => 'region',
    private options: OverlayOptions = {},
  ) {
    this.rect = loadRegion();
    ipcMain.handle('mimik:overlay:region', () => this.rect);
    ipcMain.handle('mimik:overlay:view', () => this.view());
    ipcMain.on('mimik:overlay:setRegion', (_event, next: Region) => this.setRegion(next));
    ipcMain.on('mimik:overlay:command', (_event, command: OverlayCommand) => this.command(command));
    ipcMain.on('mimik:overlay:size', (_event, width: number, height: number) => this.resize(width, height));
    capture.subscribe(() => this.render());
  }

  get region(): Region {
    return this.rect;
  }

  get state(): CaptureStateValue {
    return this.capture.getSnapshot().value;
  }

  get isEditing(): boolean {
    return this.editing;
  }

  private windows(): BrowserWindow[] {
    return [...this.editors, this.boundary, this.controls].filter(
      (w): w is BrowserWindow => w !== null && !w.isDestroyed(),
    );
  }

  get introWindow(): BrowserWindow | null {
    return this.intro && !this.intro.isDestroyed() ? this.intro : null;
  }

  private view(): OverlayView {
    return {
      state: this.state,
      pauseReason: this.capture.getSnapshot().context.pauseReason,
      region: this.rect,
      step: this.step,
      mode: this.mode(),
      busy: this.busy,
      progress: this.progress,
      print: this.print,
      starting: this.starting,
      shortcuts: this.options.shortcuts?.() ?? NO_SHORTCUTS,
      aiFailure: this.aiFailure,
      narration: this.narration,
    };
  }

  private broadcast(): void {
    const view = this.view();
    for (const win of this.windows()) win.webContents.send('mimik:overlay:update', view);
  }

  refresh(): void {
    this.render();
  }

  ignores(point: { x: number; y: number }): boolean {
    return this.windows().some((win) => {
      if (!win.isVisible() || win === this.boundary) return false;
      const b = win.getBounds();
      return point.x >= b.x && point.y >= b.y && point.x < b.x + b.width && point.y < b.y + b.height;
    });
  }

  showStep(step: OverlayStep | null): void {
    this.step = step ? { ...step } : null;
    this.broadcast();
  }

  setAiFailure(failure: OverlayAiFailure | null): void {
    this.aiFailure = failure;
    this.broadcast();
  }

  setNarration(narration: OverlayNarration | null): void {
    this.narration = narration;
    this.broadcast();
  }

  setBusy(busy: boolean): void {
    if (this.busy === busy) return;
    this.busy = busy;
    if (busy) {
      this.progress = { percent: 0, ms: 0 };
      this.print = { src: null, aim: null };
    }
    this.broadcast();
  }

  setPrint(patch: Partial<OverlayPrint>): void {
    this.print = { ...this.print, ...patch };
    this.broadcast();
  }

  setProgress(percent: number, ms: number): void {
    this.progress = { percent, ms };
    this.broadcast();
  }

  private resize(width: number, height: number): void {
    const next = { width: Math.round(width), height: Math.round(height) };
    if (next.width < 80 || next.height < 40) return;
    if (next.width === this.size.width && next.height === this.size.height) return;
    this.size = next;
    this.positionControls();
  }

  private setRegion(next: Region): void {
    this.rect = saveRegion(next);
    if (this.boundary && !this.boundary.isDestroyed()) this.boundary.setBounds(this.frameBounds());
    this.positionControls();
    this.broadcast();
  }

  private frameBounds(): Electron.Rectangle {
    return {
      x: this.rect.x - BORDER,
      y: this.rect.y - BORDER,
      width: this.rect.width + BORDER * 2,
      height: this.rect.height + BORDER * 2,
    };
  }

  private positionControls(): void {
    if (!this.controls || this.controls.isDestroyed()) return;
    const { width, height } = this.size;
    const { workArea } = this.anchor
      ? screen.getDisplayNearestPoint({ x: this.anchor.right - 1, y: this.anchor.bottom - 1 })
      : screen.getDisplayMatching(this.rect);
    const right = this.anchor?.right ?? workArea.x + workArea.width - CONTROLS.margin;
    const bottom = this.anchor?.bottom ?? workArea.y + workArea.height - CONTROLS.margin;
    this.controls.setBounds({
      x: Math.round(Math.max(Math.min(right - width, workArea.x + workArea.width - width), workArea.x)),
      y: Math.round(Math.max(Math.min(bottom - height, workArea.y + workArea.height - height), workArea.y)),
      width,
      height,
    });
  }

  private closeEditors(): void {
    for (const win of this.editors) if (!win.isDestroyed()) win.destroy();
    this.editors = [];
  }

  private ensureBoundary(): void {
    if (this.mode() !== 'region') {
      if (this.boundary && !this.boundary.isDestroyed()) this.boundary.destroy();
      this.boundary = null;
      return;
    }
    if (this.boundary && !this.boundary.isDestroyed()) {
      this.boundary.setBounds(this.frameBounds());
      return;
    }
    this.boundary = overlayWindow(this.frameBounds(), 'boundary', false);
  }

  private ensureControls(): void {
    if (this.controls?.isDestroyed()) this.controls = null;
    if (!this.controls) {
      this.controls = overlayWindow({ x: 0, y: 0, ...this.size }, 'controls', true, false);
      this.controls.setIgnoreMouseEvents(false);
      this.controls.setMovable(true);
      const card = this.controls;
      let dragged = false;
      card.on('will-move', () => {
        dragged = true;
      });
      card.on('move', () => {
        if (!dragged) return;
        const moved = card.getBounds();
        this.anchor = { right: moved.x + moved.width, bottom: moved.y + moved.height };
      });
    }
    this.positionControls();
  }

  edit(): void {
    this.editing = true;
    if (this.boundary && !this.boundary.isDestroyed()) this.boundary.hide();
    if (this.controls && !this.controls.isDestroyed()) this.controls.hide();
    this.closeEditors();

    this.editors = screen.getAllDisplays().map((display) => {
      const win = overlayWindow(display.bounds, `editor:${display.bounds.x}:${display.bounds.y}`, true);
      win.setIgnoreMouseEvents(false);
      win.once('ready-to-show', () => {
        win.show();
        protect(win);
      });
      return win;
    });
  }

  private stopEditing(): void {
    this.editing = false;
    this.modeBeforeEdit = null;
    this.closeEditors();
  }

  private render(): void {
    if (this.editing) {
      this.broadcast();
      return;
    }
    if (this.state === CaptureState.IDLE) {
      for (const win of this.windows()) win.hide();
      this.broadcast();
      return;
    }
    this.ensureBoundary();
    this.ensureControls();
    for (const win of this.windows()) {
      win.showInactive();
      protect(win);
    }
    this.broadcast();
  }

  arm(): void {
    this.stopEditing();
    if (this.state === CaptureState.IDLE) this.capture.send({ type: 'ARM' });
    else this.render();
  }

  private async begin(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    this.arm();
    const frame = await (this.options.introFrame?.() ?? Promise.resolve(this.displayUnderCursor())).catch(() =>
      this.displayUnderCursor(),
    );
    const finished = await this.playIntro(frame);
    this.starting = false;
    if (!finished || this.state !== CaptureState.ARMED) return;
    this.capture.send({ type: 'START_RECORDING', ...(this.options.insert?.() ?? {}) });
    this.onCommand('start');
  }

  private displayUnderCursor(): Region {
    return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).bounds;
  }

  private playIntro(frame: Region): Promise<boolean> {
    return new Promise((resolve) => {
      const win = overlayWindow(frame, 'intro', false);
      this.intro = win;
      let settled = false;
      const done = (finished: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(limit);
        this.introDone = null;
        this.intro = null;
        if (!win.isDestroyed()) win.destroy();
        resolve(finished);
      };
      const limit = setTimeout(() => done(true), INTRO_LIMIT_MS);
      this.introDone = done;
      win.once('ready-to-show', () => {
        win.showInactive();
        protect(win);
      });
      win.once('closed', () => done(true));
    });
  }

  reset(): void {
    this.introDone?.(false);
    this.starting = false;
    this.narration = null;
    this.step = null;
    this.stopEditing();
    if (this.state === CaptureState.ARMED) this.capture.send({ type: 'DISARM' });
    else if (this.state !== CaptureState.IDLE) this.capture.send({ type: 'STOP_RECORDING' });
    this.render();
  }

  run(command: OverlayCommand): void {
    this.command(command);
  }

  private command(command: OverlayCommand): void {
    const state = this.state;
    if (command.startsWith('mode:')) {
      const before = this.mode();
      this.onCommand(command);
      if (command === 'mode:region' && state === CaptureState.PAUSED && !this.editing) {
        this.edit();
        this.modeBeforeEdit = before;
      }
      return;
    }
    if (command === 'done') {
      if (state === CaptureState.PAUSED) this.command('resume');
      else this.arm();
      return;
    }
    if (command === 'cancelEdit') {
      const restore = this.modeBeforeEdit;
      this.stopEditing();
      if (state === CaptureState.PAUSED) {
        if (restore) this.onCommand(`mode:${restore}`);
        this.render();
        return;
      }
      this.reset();
      this.onCommand(command);
      return;
    }
    if (command === 'intro:done') {
      this.introDone?.(true);
      return;
    }
    if (command === 'start') {
      void this.begin();
      return;
    }
    if (command === 'deleteStep') {
      if (!this.busy) this.onCommand(command);
      return;
    }
    if (command === 'narration:start' || command === 'narration:stop') {
      this.onCommand(command);
      return;
    }
    if (command === 'disarm' || (command === 'stop' && state === CaptureState.ARMED)) {
      this.reset();
      this.onCommand('disarm');
      return;
    }
    if (this.starting) return;
    if (command === 'pause' && state === CaptureState.RECORDING) {
      const area = this.mode() === 'region';
      this.capture.send({ type: 'PAUSE_CAPTURE', reason: area ? 'area' : 'manual' });
      this.onCommand(command);
      if (area) this.edit();
    } else if (command === 'resume' && state === CaptureState.PAUSED) {
      this.stopEditing();
      this.capture.send({ type: 'RESUME_CAPTURE' });
      this.onCommand(command);
    } else if (command === 'stop' && state !== CaptureState.IDLE) {
      this.reset();
      this.onCommand(command);
    }
  }

  async withHidden<T>(fn: () => Promise<T>): Promise<T> {
    if (process.platform !== 'linux') return fn();
    if (!this.hiding) {
      const shown = this.windows().filter((win) => win.isVisible());
      for (const win of shown) win.hide();
      const ready = new Promise((resolve) => setTimeout(resolve, shown.length > 0 ? HIDE_SETTLE_MS : 0));
      this.hiding = { shown, ready, users: 0 };
    }
    const hiding = this.hiding;
    hiding.users += 1;
    try {
      await hiding.ready;
      return await fn();
    } finally {
      hiding.users -= 1;
      if (hiding.users === 0) {
        this.hiding = null;
        for (const win of hiding.shown) {
          if (win.isDestroyed()) continue;
          win.showInactive();
          protect(win);
        }
      }
    }
  }

  destroy(): void {
    this.closeEditors();
    this.introDone?.(false);
    for (const win of [this.boundary, this.controls]) if (win && !win.isDestroyed()) win.destroy();
    this.boundary = null;
    this.controls = null;
    this.editing = false;
    for (const channel of ['mimik:overlay:region', 'mimik:overlay:view']) ipcMain.removeHandler(channel);
    ipcMain.removeAllListeners('mimik:overlay:setRegion');
    ipcMain.removeAllListeners('mimik:overlay:command');
    ipcMain.removeAllListeners('mimik:overlay:size');
  }
}

export { clampToDisplays, loadRegion, type Region, saveRegion };
