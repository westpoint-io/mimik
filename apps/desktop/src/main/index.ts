import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, protocol, screen, shell, Tray } from 'electron';
import { registerAiFetch } from './ai-fetch';
import { ask } from './ask';
import { focusedWindow } from './capture/focused-window';
import type { CaptureInsert } from './capture/insert';
import { DesktopRecorder, frameFor } from './capture/recorder';
import { registerScreenshotProtocol, SCREENSHOT_SCHEME, sweepScreenshots } from './capture/screenshot-store';
import { type CaptureMode, type CaptureSettings, loadSettings, saveSettings } from './capture/settings';
import { CaptureOverlay, type OverlayAiFailure, type OverlayCommand, type OverlayStep } from './overlay';
import { bindShortcuts, type ShortcutName, shortcutMap, unbindShortcuts } from './shortcuts';
import { checkForUpdates } from './updater';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let overlay: CaptureOverlay | null = null;
let recorder: DesktopRecorder | null = null;
let guideId: string | null = null;
let insert: CaptureInsert | null = null;
let describing = true;
let captureSettings: CaptureSettings | null = null;
let steps: OverlayStep[] = [];

function resource(file: string): string {
  return app.isPackaged ? join(process.resourcesPath, file) : join(__dirname, '../../resources', file);
}

function opensAtLogin(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}

function setOpenAtLogin(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: enabled });
  refreshTrayMenu();
}

let restoreAfterCapture = false;

function enterCapture(): void {
  mainWindow?.webContents.setBackgroundThrottling(false);
  if (!mainWindow?.isVisible()) return;
  restoreAfterCapture = true;
  mainWindow.hide();
}

function leaveCapture(finished: boolean): void {
  mainWindow?.webContents.setBackgroundThrottling(true);
  if (finished || restoreAfterCapture) showWindow();
  restoreAfterCapture = false;
}

function trayIcon(recording: boolean): Electron.NativeImage {
  const icon = nativeImage.createFromPath(resource(recording ? 'tray-recording32.png' : 'icon32.png'));
  return process.platform === 'darwin' ? icon.resize({ width: 16, height: 16 }) : icon;
}

function isCapturing(): boolean {
  return overlay?.state === 'recording' || overlay?.state === 'paused';
}

function refreshTray(): void {
  if (!tray) return;
  const recording = isCapturing();
  tray.setImage(trayIcon(recording));
  tray.setToolTip(recording ? 'Mimik is recording. Click to finish.' : 'Mimik');
}

function showWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

const SPLASH_MIN_MS = 1500;
const SPLASH_MAX_WAIT_MS = 3000;
let splash: BrowserWindow | null = null;
let splashShownAt: number | null = null;

function openSplash(): void {
  splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    center: true,
  });
  splash.once('ready-to-show', () => {
    splash?.show();
    splashShownAt = Date.now();
  });
  splash.on('closed', () => {
    splash = null;
  });
  if (process.env.ELECTRON_RENDERER_URL) splash.loadURL(`${process.env.ELECTRON_RENDERER_URL}/splash.html`);
  else splash.loadFile(join(__dirname, '../renderer/splash.html'));
}

function closeSplash(then: () => void): void {
  const close = () => {
    if (splash && !splash.isDestroyed()) splash.close();
    then();
  };
  if (!splash || splash.isDestroyed()) {
    then();
    return;
  }
  if (splashShownAt === null) {
    const giveUp = setTimeout(close, SPLASH_MAX_WAIT_MS);
    splash.once('show', () => {
      clearTimeout(giveUp);
      setTimeout(close, SPLASH_MIN_MS);
    });
    return;
  }
  setTimeout(close, Math.max(0, SPLASH_MIN_MS - (Date.now() - splashShownAt)));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    icon: resource(process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    backgroundColor: '#EEF2FF',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    closeSplash(() => {
      if (!app.getLoginItemSettings().wasOpenedAsHidden) mainWindow?.show();
    });
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function refreshTrayMenu(): void {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Mimik', click: () => showWindow() },
      {
        label: 'Set capture area',
        click: () => {
          if (!isCapturing()) {
            insert = null;
            enterCapture();
          }
          overlay?.edit();
        },
      },
      { type: 'separator' },
      {
        label: 'Start at login',
        type: 'checkbox',
        checked: opensAtLogin(),
        click: (item) => setOpenAtLogin(item.checked),
      },
      { label: 'Check for updates', click: () => checkForUpdates({ notifyWhenUpToDate: true }) },
      { type: 'separator' },
      { label: 'Quit Mimik', click: () => quit() },
    ]),
  );
}

function createTray(): void {
  tray = new Tray(trayIcon(false));
  tray.setToolTip('Mimik');
  tray.on('click', () => {
    if (isCapturing()) overlay?.run('stop');
    else showWindow();
  });
  refreshTrayMenu();
}

function broadcastOverlay(command: OverlayCommand, id: string | null): void {
  mainWindow?.webContents.send('mimik:capture:command', command, overlay?.state, overlay?.region, id);
}

function applyShortcuts(): void {
  setImmediate(() => {
    if (!overlay) return;
    const recording = overlay.state === 'recording' || overlay.state === 'paused';
    bindShortcuts(shortcutMap((captureSettings ?? loadSettings()).shortcuts, recording), onShortcut);
  });
}

function onShortcut(name: ShortcutName): void {
  if (!overlay) return;
  if (name === 'startStop') {
    if (overlay.state === 'hidden') {
      insert = null;
      enterCapture();
    }
    overlay.run(overlay.state === 'hidden' || overlay.state === 'armed' ? 'start' : 'stop');
    return;
  }
  if (name === 'pauseResume') {
    if (overlay.state === 'recording') overlay.run('pause');
    else if (overlay.state === 'paused') overlay.run('resume');
    return;
  }
  recorder?.captureNow(screen.getCursorScreenPoint());
}

async function onOverlayCommand(command: OverlayCommand): Promise<void> {
  let finished: string | null = null;
  if (command.startsWith('mode:')) {
    captureSettings = saveSettings({ captureMode: command.slice(5) as CaptureMode });
    overlay?.refresh();
    return;
  }
  if (command === 'remove') {
    const removed = steps.pop();
    if (removed && guideId) {
      await ask(mainWindow?.webContents ?? null, 'mimik:capture:removeStep', { guideId, stepId: removed.id }).catch(
        () => undefined,
      );
    }
    overlay?.showStep(steps.at(-1) ?? null);
    return;
  }
  if (command === 'start' && !guideId) {
    steps = [];
    overlay?.setAiFailure(null);
    try {
      guideId = await ask<string>(mainWindow?.webContents ?? null, 'mimik:capture:startGuide', insert !== null);
    } catch (error) {
      overlay?.hide();
      dialog.showErrorBox('Mimik cannot record', error instanceof Error ? error.message : String(error));
      return;
    }
    const started = await recorder?.start();
    if (started && !started.ok) {
      guideId = null;
      overlay?.hide();
      dialog.showErrorBox('Mimik cannot record', started.detail);
      return;
    }
  } else if (command === 'pause') {
    recorder?.pause();
  } else if (command === 'resume') {
    recorder?.resume();
  } else if (command === 'stop' || command === 'cancel') {
    recorder?.stop();
    await recorder?.drain();
    const target = insert;
    insert = null;
    if (guideId && target) {
      await ask(
        mainWindow?.webContents ?? null,
        'mimik:capture:insertGuide',
        { guideId, targetGuideId: target.guideId, atIndex: target.atIndex },
        45_000,
      ).catch(() => undefined);
      if (command === 'stop' && steps.length > 0) finished = target.guideId;
    } else {
      if (command === 'stop' && steps.length > 0) finished = guideId;
      if (finished) {
        await ask(mainWindow?.webContents ?? null, 'mimik:capture:finishGuide', finished, 45_000).catch(
          () => undefined,
        );
      }
    }
    guideId = null;
  }
  broadcastOverlay(command, finished ?? guideId);
  applyShortcuts();
  refreshTray();
  if (command === 'stop' || command === 'cancel') leaveCapture(Boolean(finished));
}

let isQuitting = false;

function quit(): void {
  isQuitting = true;
  app.quit();
}

protocol.registerSchemesAsPrivileged([
  { scheme: SCREENSHOT_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(() => {
    if (!app.getLoginItemSettings().wasOpenedAsHidden) openSplash();
    registerScreenshotProtocol();
    registerAiFetch();
    ipcMain.handle('mimik:openAtLogin:get', () => opensAtLogin());
    ipcMain.handle('mimik:openAtLogin:set', (_event, enabled: boolean) => {
      setOpenAtLogin(Boolean(enabled));
      return opensAtLogin();
    });
    ipcMain.handle('mimik:version', () => app.getVersion());
    ipcMain.handle('mimik:updates:check', () => checkForUpdates({ notifyWhenUpToDate: true }));
    ipcMain.handle('mimik:screenshots:sweep', (_event, keep: string[]) => sweepScreenshots(keep));
    ipcMain.on('mimik:app:relocalise', () => {
      for (const win of BrowserWindow.getAllWindows()) win.webContents.reload();
    });

    captureSettings = loadSettings();
    const shortcutLabel = (accelerator: string | null) =>
      accelerator?.replace(/CommandOrControl|CmdOrCtrl/g, process.platform === 'darwin' ? 'Cmd' : 'Ctrl') || null;
    overlay = new CaptureOverlay(
      (command) => void onOverlayCommand(command),
      () => (captureSettings ?? loadSettings()).captureMode,
      {
        introFrame: async () => {
          const settings = captureSettings ?? loadSettings();
          const focused = settings.captureMode === 'window' ? await focusedWindow() : null;
          const region = overlay?.region ?? { x: 0, y: 0, width: 0, height: 0 };
          return frameFor(
            settings.captureMode,
            screen.getCursorScreenPoint(),
            region,
            focused?.ok ? focused.window.bounds : null,
          );
        },
        shortcuts: () => {
          const { shortcuts } = captureSettings ?? loadSettings();
          return { startStop: shortcutLabel(shortcuts.startStop), capture: shortcutLabel(shortcuts.capture) };
        },
      },
    );
    recorder = new DesktopRecorder(
      () => overlay?.region ?? { x: 0, y: 0, width: 0, height: 0 },
      (fn) => {
        overlay?.setBusy(true);
        return overlay ? overlay.withHidden(fn) : fn();
      },
      async (request) => {
        const reply = await ask<{ stepId?: string; title?: string; pending?: boolean }>(
          mainWindow?.webContents ?? null,
          'mimik:capture:step',
          { ...request, guideId },
        ).catch(() => undefined);
        if (reply?.stepId && reply.title) {
          const step: OverlayStep = {
            id: reply.stepId,
            index: steps.length + 1 + (insert?.afterStep ?? 0),
            title: reply.title,
            src: request.image.src,
            source: 'heuristic',
            pending: reply.pending === true,
            app: request.elementMeta.app?.name ?? null,
          };
          steps.push(step);
          describing = step.pending;
          overlay?.showStep(step);
          if (step.pending) overlay?.setProgress(95, 3500);
        }
        return reply;
      },
      {
        settings: () => captureSettings ?? loadSettings(),
        ignores: (point) => overlay?.ignores(point) ?? false,
        drained: () => overlay?.setBusy(false),
        progress: (fraction, ms) => overlay?.setProgress(Math.round(fraction * (describing ? 45 : 100)), ms),
        aimed: (aim) => overlay?.setPrint({ aim }),
        saved: (src) => overlay?.setPrint({ src }),
      },
    );

    ipcMain.handle('mimik:capture:settings:get', () => captureSettings ?? loadSettings());
    ipcMain.handle('mimik:capture:settings:set', (_event, patch: Partial<CaptureSettings>) => {
      captureSettings = saveSettings(patch);
      overlay?.refresh();
      applyShortcuts();
      return captureSettings;
    });
    ipcMain.on(
      'mimik:capture:described',
      (_event, stepId: string, description: string | null, failure: OverlayAiFailure | null) => {
        if (failure) overlay?.setAiFailure(failure);
        const step = steps.find((candidate) => candidate.id === stepId);
        if (!step) return;
        if (description) {
          step.title = description;
          step.source = 'ai';
        }
        step.pending = false;
        if (step === steps.at(-1)) {
          overlay?.setProgress(100, 200);
          overlay?.showStep(step);
        }
      },
    );
    ipcMain.handle('mimik:capture:region', () => overlay?.region);
    ipcMain.handle('mimik:capture:edit', (_event, target?: CaptureInsert) => {
      insert = target ?? null;
      enterCapture();
      overlay?.edit();
    });
    ipcMain.handle('mimik:capture:arm', (_event, target?: CaptureInsert) => {
      insert = target ?? null;
      enterCapture();
      overlay?.arm();
    });

    applyShortcuts();
    createWindow();
    createTray();
    checkForUpdates({ notifyWhenUpToDate: false });
  });

  app.on('activate', () => showWindow());
  app.on('before-quit', () => {
    isQuitting = true;
    unbindShortcuts();
    recorder?.stop();
    overlay?.destroy();
  });
  app.on('window-all-closed', () => {});
}
