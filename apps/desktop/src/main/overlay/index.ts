import { join } from 'node:path';
import { BrowserWindow, ipcMain, screen } from 'electron';
import { clampToDisplays, loadRegion, type Region, saveRegion } from '../capture/region';
import type { CaptureMode } from '../capture/settings';

export type OverlayState = 'hidden' | 'editing' | 'armed' | 'recording' | 'paused';
export type OverlayCommand =
  | 'edit'
  | 'arm'
  | 'cancel'
  | 'start'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'mode:window'
  | 'mode:screen'
  | 'mode:region';

const BORDER = 3;
const CONTROLS = { width: 300, height: 190, margin: 24 };

function rendererFile(): string {
  return join(__dirname, '../renderer/overlay.html');
}

function preloadFile(): string {
  return join(__dirname, '../preload/overlay.cjs');
}

function protect(win: BrowserWindow): void {
  if (!win.isDestroyed()) win.setContentProtection(true);
}

function overlayWindow(bounds: Electron.Rectangle, hash: string, interactive: boolean): BrowserWindow {
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
    focusable: interactive,
    acceptFirstMouse: true,
    webPreferences: { preload: preloadFile(), contextIsolation: true, nodeIntegration: false },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
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
  private current: OverlayState = 'hidden';
  private rect: Region;
  private last: { index: number; title: string; src: string } | null = null;
  private size = { width: CONTROLS.width, height: CONTROLS.height };
  private busy = false;

  constructor(
    private onCommand: (command: OverlayCommand) => void,
    private mode: () => CaptureMode = () => 'region',
  ) {
    this.rect = loadRegion();
    ipcMain.handle('mimik:overlay:region', () => this.rect);
    ipcMain.handle('mimik:overlay:state', () => this.current);
    ipcMain.handle('mimik:overlay:last', () => this.last);
    ipcMain.handle('mimik:overlay:mode', () => this.mode());
    ipcMain.handle('mimik:overlay:busy', () => this.busy);
    ipcMain.on('mimik:overlay:setRegion', (_event, next: Region) => this.setRegion(next));
    ipcMain.on('mimik:overlay:command', (_event, command: OverlayCommand) => this.command(command));
    ipcMain.on('mimik:overlay:size', (_event, width: number, height: number) => this.resize(width, height));
  }

  get region(): Region {
    return this.rect;
  }

  get state(): OverlayState {
    return this.current;
  }

  private windows(): BrowserWindow[] {
    return [...this.editors, this.boundary, this.controls].filter(
      (w): w is BrowserWindow => w !== null && !w.isDestroyed(),
    );
  }

  private broadcast(): void {
    for (const win of this.windows())
      win.webContents.send('mimik:overlay:update', this.current, this.rect, this.last, this.mode(), this.busy);
  }

  refresh(): void {
    if (this.current !== 'hidden' && this.current !== 'editing') this.show(this.current);
    else this.broadcast();
  }

  ignores(point: { x: number; y: number }): boolean {
    return this.windows().some((win) => {
      if (!win.isVisible() || win === this.boundary) return false;
      const b = win.getBounds();
      return point.x >= b.x && point.y >= b.y && point.x < b.x + b.width && point.y < b.y + b.height;
    });
  }

  stepCaptured(index: number, title: string, src: string): void {
    this.last = { index, title, src };
    this.broadcast();
  }

  setBusy(busy: boolean): void {
    if (this.busy === busy) return;
    this.busy = busy;
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
    const { workArea } = screen.getDisplayMatching(this.rect);
    const { width, height } = this.size;
    this.controls.setBounds({
      x: Math.round(Math.max(workArea.x + workArea.width - width - CONTROLS.margin, workArea.x)),
      y: Math.round(Math.max(workArea.y + workArea.height - height - CONTROLS.margin, workArea.y)),
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
      this.controls = overlayWindow({ x: 0, y: 0, ...this.size }, 'controls', true);
      this.controls.setIgnoreMouseEvents(false);
    }
    this.positionControls();
  }

  edit(): void {
    this.current = 'editing';
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

  private show(state: Exclude<OverlayState, 'hidden' | 'editing'>): void {
    this.closeEditors();
    this.current = state;
    this.ensureBoundary();
    this.ensureControls();
    for (const win of this.windows()) {
      win.showInactive();
      protect(win);
    }
    this.broadcast();
  }

  arm(): void {
    this.show('armed');
  }

  record(): void {
    this.show('recording');
  }

  pause(): void {
    this.show('paused');
  }

  hide(): void {
    this.current = 'hidden';
    this.closeEditors();
    for (const win of this.windows()) win.hide();
  }

  private command(command: OverlayCommand): void {
    if (command.startsWith('mode:')) {
      this.onCommand(command);
      return;
    }
    if (command === 'edit') this.edit();
    else if (command === 'arm') this.arm();
    else if (command === 'start' || command === 'resume') this.record();
    else if (command === 'pause') this.pause();
    else {
      this.last = null;
      this.hide();
    }
    this.onCommand(command);
  }

  async withHidden<T>(fn: () => Promise<T>): Promise<T> {
    if (process.platform !== 'linux') return fn();
    const shown = this.windows().filter((win) => win.isVisible());
    for (const win of shown) win.hide();
    try {
      return await fn();
    } finally {
      for (const win of shown) {
        if (win.isDestroyed()) continue;
        win.showInactive();
        protect(win);
      }
    }
  }

  destroy(): void {
    this.closeEditors();
    for (const win of [this.boundary, this.controls]) if (win && !win.isDestroyed()) win.destroy();
    this.boundary = null;
    this.controls = null;
    this.current = 'hidden';
    for (const channel of [
      'mimik:overlay:region',
      'mimik:overlay:state',
      'mimik:overlay:last',
      'mimik:overlay:mode',
      'mimik:overlay:busy',
    ])
      ipcMain.removeHandler(channel);
    ipcMain.removeAllListeners('mimik:overlay:setRegion');
    ipcMain.removeAllListeners('mimik:overlay:command');
    ipcMain.removeAllListeners('mimik:overlay:size');
  }
}

export { clampToDisplays, loadRegion, type Region, saveRegion };
