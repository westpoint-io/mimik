import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { CaptureInsert } from '@mimik/core/capture/capture-insert';
import { isLive } from '@mimik/core/capture/is-live';
import { CaptureState, captureMachine } from '@mimik/core/capture/machine';
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, protocol, screen, shell, Tray } from 'electron';
import { createActor } from 'xstate';
import { shortcutLabel } from '../renderer/lib/shortcut-label';
import { registerAiFetch } from './ai-fetch';
import { APP_ICON_SCHEME, registerAppIconProtocol } from './app-icon';
import { ask } from './ask';
import { DesktopRecorder, frameFor } from './capture/recorder';
import { grabDisplay } from './capture/screenshot';
import { registerScreenshotProtocol, SCREENSHOT_SCHEME, sweepScreenshots } from './capture/screenshot-store';
import { type CaptureMode, type CaptureSettings, loadSettings, saveSettings } from './capture/settings';
import { mainI18n } from './i18n';
import {
  CaptureOverlay,
  type OverlayAiFailure,
  type OverlayCommand,
  type OverlayNarration,
  type OverlayStep,
} from './overlay';
import {
  askMicrophone,
  captureWasHeld,
  holdCapture,
  microphoneAccess,
  type PermissionKind,
  readPermissions,
  requestPermission,
} from './permissions';
import { bindShortcuts, type ShortcutName, shortcutMap, unbindShortcuts } from './shortcuts';
import { checkForUpdates } from './updater';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let overlay: CaptureOverlay | null = null;
let recorder: DesktopRecorder | null = null;
const capture = createActor(captureMachine).start();
let currentGuideId: string | null = null;
let insert: CaptureInsert | null = null;
let describing = true;
let captureSettings: CaptureSettings | null = null;
let steps: OverlayStep[] = [];

let pendingStart: (() => void) | null = captureWasHeld()
  ? () => mainWindow?.webContents.send('mimik:capture:openSheet')
  : null;

const BUNDLE_SUFFIX = '.mimik';

function bundleArg(argv: string[]): string | null {
  return argv.find((arg) => arg.toLowerCase().endsWith(BUNDLE_SUFFIX)) ?? null;
}

let openedFile = bundleArg(process.argv);

function openBundle(path: string | null): void {
  if (!path) return;
  openedFile = path;
  if (!app.isReady()) return;
  showWindow();
  mainWindow?.webContents.send('mimik:app:fileOpened');
}

let screenWarmed = false;

function warmScreenCapture(): void {
  if (process.platform !== 'darwin' || screenWarmed) return;
  screenWarmed = true;
  void grabDisplay(screen.getCursorScreenPoint()).catch(() => undefined);
}

function whenPermitted(start: () => void): void {
  const granted = readPermissions();
  if (granted.accessibility && granted.screen) {
    warmScreenCapture();
    start();
    return;
  }
  pendingStart = start;
  holdCapture(true);
  showWindow();
  mainWindow?.webContents.send('mimik:permissions:show');
}

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

function refreshTray(): void {
  if (!tray) return;
  const recording = isLive(capture.getSnapshot().value);
  tray.setImage(trayIcon(recording));
  tray.setToolTip(recording ? mainI18n.t('desktop.trayRecording') : 'Mimik');
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

function openInWindow(target: 'library' | 'capture' | 'settings'): void {
  showWindow();
  mainWindow?.webContents.send('mimik:app:open', target);
}

function refreshTrayMenu(): void {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: mainI18n.t('fullview.allGuides'), click: () => openInWindow('library') },
      { label: mainI18n.t('capture.startCapture'), click: () => openInWindow('capture') },
      { label: mainI18n.t('settings.title'), click: () => openInWindow('settings') },
      { type: 'separator' },
      { label: mainI18n.t('desktop.version', [app.getVersion()]), enabled: false },
      { type: 'separator' },
      { label: mainI18n.t('desktop.trayQuit'), click: () => quit() },
    ]),
  );
}

function createTray(): void {
  tray = new Tray(trayIcon(false));
  tray.setToolTip('Mimik');
  tray.on('click', () => {
    if (isLive(capture.getSnapshot().value)) overlay?.run('stop');
    else showWindow();
  });
  refreshTrayMenu();
}

function captureStateUpdate(command: OverlayCommand | null, guideId: string | null) {
  const { value, context } = capture.getSnapshot();
  return {
    command,
    state: value,
    pauseReason: context.pauseReason,
    currentGuideId: guideId,
    stepCount: context.stepCount,
  };
}

function broadcastState(command: OverlayCommand, guideId: string | null): void {
  mainWindow?.webContents.send('mimik:capture:stateUpdate', captureStateUpdate(command, guideId));
}

function applyShortcuts(): void {
  setImmediate(() => {
    if (!overlay) return;
    bindShortcuts(
      shortcutMap((captureSettings ?? loadSettings()).shortcuts, isLive(capture.getSnapshot().value)),
      onShortcut,
    );
  });
}

function onShortcut(name: ShortcutName): void {
  if (!overlay) return;
  const state = capture.getSnapshot().value;
  if (name === 'startStop') {
    if (state === CaptureState.IDLE) {
      whenPermitted(() => {
        insert = null;
        enterCapture();
        overlay?.run('start');
      });
      return;
    }
    overlay.run(state === CaptureState.ARMED ? 'start' : 'stop');
    return;
  }
  if (name === 'pauseResume') {
    if (state === CaptureState.RECORDING) overlay.run('pause');
    else if (state === CaptureState.PAUSED) overlay.run('resume');
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
  if (command === 'narration:start' || command === 'narration:stop') {
    if (command === 'narration:stop' || (await askMicrophone())) broadcastState(command, currentGuideId);
    return;
  }
  if (command === 'deleteStep') {
    const removed = steps.pop();
    if (removed && currentGuideId) {
      capture.send({ type: 'STEP_REMOVED' });
      await ask(mainWindow?.webContents ?? null, 'mimik:capture:deleteStep', {
        guideId: currentGuideId,
        stepId: removed.id,
      }).catch(() => undefined);
    }
    overlay?.showStep(steps.at(-1) ?? null);
    return;
  }
  if (command === 'start') {
    steps = [];
    overlay?.setAiFailure(null);
    currentGuideId = capture.getSnapshot().context.currentGuideId;
    try {
      await ask(mainWindow?.webContents ?? null, 'mimik:capture:createGuide', {
        guideId: currentGuideId,
        staging: insert !== null,
      });
    } catch (error) {
      currentGuideId = null;
      overlay?.reset();
      dialog.showErrorBox(mainI18n.t('desktop.cannotRecord'), error instanceof Error ? error.message : String(error));
      return;
    }
    const started = await recorder?.start();
    if (started && !started.ok) {
      currentGuideId = null;
      overlay?.reset();
      dialog.showErrorBox(mainI18n.t('desktop.cannotRecord'), started.detail);
      return;
    }
  } else if (command === 'pause') {
    recorder?.pause();
  } else if (command === 'resume') {
    recorder?.resume();
  } else if (command === 'stop') {
    recorder?.stop();
    await recorder?.drain();
    const target = insert;
    insert = null;
    if (currentGuideId && target) {
      await ask(
        mainWindow?.webContents ?? null,
        'mimik:capture:mergeGuideInto',
        {
          guideId: currentGuideId,
          insertTargetGuideId: target.insertTargetGuideId,
          insertAtIndex: target.insertAtIndex,
        },
        45_000,
      ).catch(() => undefined);
      if (steps.length > 0) finished = target.insertTargetGuideId;
    } else if (currentGuideId) {
      finished = currentGuideId;
      void ask(mainWindow?.webContents ?? null, 'mimik:capture:finishGuide', finished, 45_000).catch(() => undefined);
    }
    currentGuideId = null;
  } else if (command === 'disarm' || command === 'cancelEdit') {
    insert = null;
  }
  broadcastState(command, finished ?? currentGuideId);
  applyShortcuts();
  refreshTray();
  if (command === 'stop' || command === 'disarm' || command === 'cancelEdit') leaveCapture(Boolean(finished));
}

let isQuitting = false;

function quit(): void {
  isQuitting = true;
  app.quit();
}

protocol.registerSchemesAsPrivileged([
  { scheme: SCREENSHOT_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: APP_ICON_SCHEME, privileges: { standard: true, secure: true } },
]);

app.on('open-file', (event, path) => {
  event.preventDefault();
  openBundle(path);
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    showWindow();
    openBundle(bundleArg(argv));
  });

  app.whenReady().then(() => {
    mainI18n.setLocale(app.getLocale());
    if (!app.getLoginItemSettings().wasOpenedAsHidden) openSplash();
    registerScreenshotProtocol();
    registerAppIconProtocol();
    registerAiFetch();
    ipcMain.handle('mimik:openAtLogin:get', () => opensAtLogin());
    ipcMain.handle('mimik:openAtLogin:set', (_event, enabled: boolean) => {
      setOpenAtLogin(Boolean(enabled));
      return opensAtLogin();
    });
    ipcMain.handle('mimik:version', () => app.getVersion());
    ipcMain.handle('mimik:app:takeOpenedFile', async () => {
      const path = openedFile;
      openedFile = null;
      if (!path) return null;
      try {
        return { name: basename(path), bytes: await readFile(path) };
      } catch {
        return null;
      }
    });
    ipcMain.handle('mimik:updates:check', () => checkForUpdates({ notifyWhenUpToDate: true }));
    ipcMain.handle('mimik:screenshots:sweep', (_event, keep: string[]) => sweepScreenshots(keep));
    ipcMain.on('mimik:app:relocalise', () => {
      for (const win of BrowserWindow.getAllWindows()) win.webContents.reload();
    });
    ipcMain.on('mimik:app:locale', (_event, code: string) => {
      mainI18n.setLocale(code);
      refreshTrayMenu();
      refreshTray();
    });

    captureSettings = loadSettings();
    const labelOf = (accelerator: string | null) =>
      accelerator ? shortcutLabel(accelerator, process.platform === 'darwin') : null;
    overlay = new CaptureOverlay(
      capture,
      (command) => void onOverlayCommand(command),
      () => (captureSettings ?? loadSettings()).captureMode,
      {
        insert: () => insert,
        introFrame: async () => {
          const { captureMode } = captureSettings ?? loadSettings();
          const region = overlay?.region ?? { x: 0, y: 0, width: 0, height: 0 };
          return frameFor(captureMode === 'area' ? 'area' : 'screen', screen.getCursorScreenPoint(), region, null);
        },
        shortcuts: () => {
          const { shortcuts } = captureSettings ?? loadSettings();
          return { startStop: labelOf(shortcuts.startStop), capture: labelOf(shortcuts.capture) };
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
          'mimik:capture:captureStep',
          { ...request, guideId: currentGuideId },
        ).catch(() => undefined);
        if (reply?.stepId && reply.title) {
          const step: OverlayStep = {
            id: reply.stepId,
            index: steps.length + 1 + (insert?.afterStep ?? 0),
            title: reply.title,
            action: request.action,
            src: request.image?.src ?? '',
            source: 'heuristic',
            pending: reply.pending === true,
            app: request.elementMeta.app?.name ?? null,
          };
          steps.push(step);
          capture.send({ type: 'USER_ACTION' });
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
    ipcMain.on('mimik:capture:narration', (_event, narration: OverlayNarration | null) =>
      overlay?.setNarration(narration),
    );
    ipcMain.on(
      'mimik:capture:described',
      (
        _event,
        stepId: string,
        description: string | null,
        failure: OverlayAiFailure | null,
        source: 'ai' | 'narration' = 'ai',
      ) => {
        if (failure) overlay?.setAiFailure(failure);
        const step = steps.find((candidate) => candidate.id === stepId);
        if (!step) return;
        if (description) {
          step.title = description;
          step.source = source;
        }
        step.pending = false;
        if (step === steps.at(-1)) {
          overlay?.setProgress(100, 200);
          overlay?.showStep(step);
        }
      },
    );
    ipcMain.handle('mimik:capture:region', () => overlay?.region);
    ipcMain.handle('mimik:capture:getState', () => captureStateUpdate(null, currentGuideId));
    ipcMain.handle('mimik:capture:edit', (_event, target?: CaptureInsert) => {
      whenPermitted(() => {
        insert = target ?? null;
        enterCapture();
        overlay?.edit();
      });
    });
    ipcMain.handle('mimik:capture:arm', (_event, target?: CaptureInsert) => {
      whenPermitted(() => {
        insert = target ?? null;
        enterCapture();
        overlay?.arm();
      });
    });
    ipcMain.handle('mimik:permissions:get', () => {
      if (pendingStart) holdCapture(true);
      return { ...readPermissions(), pending: pendingStart !== null };
    });
    ipcMain.handle('mimik:permissions:request', (_event, kind: PermissionKind) => requestPermission(kind));
    ipcMain.handle('mimik:microphone:get', () => microphoneAccess());
    ipcMain.handle('mimik:microphone:request', async () => {
      await askMicrophone();
      return microphoneAccess();
    });
    ipcMain.on('mimik:permissions:continue', () => {
      const start = pendingStart;
      pendingStart = null;
      holdCapture(false);
      warmScreenCapture();
      start?.();
    });
    ipcMain.on('mimik:permissions:cancel', () => {
      pendingStart = null;
      holdCapture(false);
    });
    ipcMain.on('mimik:permissions:restart', () => {
      app.relaunch();
      quit();
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
