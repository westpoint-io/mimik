import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { app, BrowserWindow, nativeImage, protocol, screen } from 'electron';
import { ask } from '../src/main/ask';
import type { ScreenElement } from '../src/main/capture/element';
import type { KeyAction } from '../src/main/capture/input-hook';
import {
  type CaptureRequest,
  typedTextFor,
  clickAction,
  comboLabel,
  DesktopRecorder,
  frameFor,
  isRepeatClick,
  isRepeatKey,
  isTextKey,
  isBoundShortcut,
  shouldCapture,
  targetRect,
} from '../src/main/capture/recorder';
import { clampToDisplays } from '../src/main/capture/region';
import { registerScreenshotProtocol, SCREENSHOT_SCHEME, sweepScreenshots } from '../src/main/capture/screenshot-store';
import {
  DEFAULT_CAPTURE_SETTINGS,
  loadSettings,
  MAX_TYPING_DEBOUNCE_MS,
  MIN_TYPING_DEBOUNCE_MS,
  normaliseSettings,
  saveSettings,
} from '../src/main/capture/settings';
import type { Capture, Rect } from '../src/main/capture/screenshot';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

function bail(error: unknown): never {
  process.stdout.write(`FAIL check-pipeline aborted: ${error instanceof Error ? error.stack : String(error)}\n`);
  app.exit(1);
  throw error;
}

setTimeout(() => bail(new Error('check did not finish within 120s')), 120_000).unref();

protocol.registerSchemesAsPrivileged([
  { scheme: SCREENSHOT_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  registerScreenshotProtocol();
  const win = new BrowserWindow({
    show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.cjs'), contextIsolation: true },
  });
  await win.loadFile(join(__dirname, '../renderer/check-pipeline.html'));
  const region = clampToDisplays({ x: 0, y: 0, width: 800, height: 600 });
  const display = screen.getDisplayMatching(region);

  function syntheticDisplay(area: Rect): Promise<Capture> {
    const scale = display.scaleFactor;
    const width = Math.round(area.width * scale);
    const height = Math.round(area.height * scale);
    const pixels = Buffer.alloc(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = (i / 4) % 256;
      pixels[i + 1] = 80;
      pixels[i + 2] = 200;
      pixels[i + 3] = 255;
    }
    const image = nativeImage.createFromBuffer(pixels, { width, height });
    return Promise.resolve({ png: image.toPNG(), width, height, scaleFactor: scale, displayId: display.id });
  }

  const REGION_MODE = { ...DEFAULT_CAPTURE_SETTINGS, captureMode: 'region' as const, recordKeys: true };
  let settings = { ...REGION_MODE };
  let activeGuide = '';
  const recorder = new DesktopRecorder(
    () => region,
    (fn) => fn(),
    (request) => ask(win.webContents, 'mimik:capture:step', { ...request, guideId: activeGuide }),
    { grab: async () => syntheticDisplay, settings: () => settings },
  );

  activeGuide = await ask<string>(win.webContents, 'mimik:capture:startGuide');
  const guideId = activeGuide;

  await recorder.capture({ x: region.x + 120, y: region.y + 90 });
  await recorder.capture({ x: region.x + 400, y: region.y + 300 });
  const results = await ask<CheckResult[]>(win.webContents, 'mimik:check:verify', guideId, 60_000);

  const userSettings = loadSettings();
  const clamped = normaliseSettings({ screenshotDelayMs: 5000 });
  const stored = saveSettings({ screenshotDelayMs: 750, keepClicksBeyondArea: true });
  const reloaded = loadSettings();
  results.push({
    name: 'settings clamp and persist',
    ok:
      clamped.screenshotDelayMs === 2000 &&
      normaliseSettings({ captureMode: 'sideways' as never }).captureMode === DEFAULT_CAPTURE_SETTINGS.captureMode &&
      reloaded.screenshotDelayMs === 750 &&
      reloaded.keepClicksBeyondArea === stored.keepClicksBeyondArea,
    detail: `5000 ms clamped to ${clamped.screenshotDelayMs}, 750 ms reloaded as ${reloaded.screenshotDelayMs}`,
  });

  const knobs = normaliseSettings({
    typingDebounceMs: 50,
    recordKeys: 'yes' as never,
    shortcuts: { startStop: '  ', pauseResume: null, capture: 'Alt+F2' } as never,
  });
  const legacy = normaliseSettings({
    captureOutsideClicks: true,
    captureKeys: false,
    captureTyping: false,
  });
  results.push({
    name: 'settings saved under the old names carry over',
    ok:
      legacy.keepClicksBeyondArea &&
      !legacy.recordKeys &&
      !legacy.recordTyping &&
      normaliseSettings({ recordTyping: true, captureTyping: false }).recordTyping,
    detail: 'each old key maps onto its new name, and the new name wins when both are present',
  });

  results.push({
    name: 'toggles, knobs and shortcuts normalise',
    ok:
      knobs.typingDebounceMs === MIN_TYPING_DEBOUNCE_MS &&
      normaliseSettings({ typingDebounceMs: 90_000 }).typingDebounceMs === MAX_TYPING_DEBOUNCE_MS &&
      knobs.recordKeys === DEFAULT_CAPTURE_SETTINGS.recordKeys &&
      knobs.shortcuts.startStop === null &&
      knobs.shortcuts.pauseResume === null &&
      knobs.shortcuts.capture === 'Alt+F2' &&
      normaliseSettings({}).shortcuts.startStop === DEFAULT_CAPTURE_SETTINGS.shortcuts.startStop,
    detail: `50 ms clamped to ${knobs.typingDebounceMs}, a blank accelerator cleared, a missing one kept its default`,
  });

  results.push({
    name: 'a right click is its own action',
    ok: clickAction(1) === 'click' && clickAction(2) === 'auxclick' && clickAction(3) === 'click',
    detail: 'the right button reads as auxclick, left and middle as click',
  });
  saveSettings(userSettings);

  const outsidePoint = { x: region.x + region.width + 40, y: region.y + 20 };
  results.push({
    name: 'outside clicks are opt in',
    ok:
      !shouldCapture({ ...REGION_MODE, keepClicksBeyondArea: false }, region, outsidePoint) &&
      shouldCapture({ ...REGION_MODE, keepClicksBeyondArea: true }, region, outsidePoint) &&
      shouldCapture({ ...REGION_MODE, keepClicksBeyondArea: false }, region, {
        x: region.x + 10,
        y: region.y + 10,
      }) &&
      shouldCapture({ ...DEFAULT_CAPTURE_SETTINGS, keepClicksBeyondArea: false }, region, outsidePoint),
    detail: 'ignored when off, captured when on, inside always captured, never filtered outside region mode',
  });

  results.push({
    name: 'a double click is one step',
    ok:
      isRepeatClick(1_000, 1_120) &&
      isRepeatClick(1_000, 1_500) &&
      !isRepeatClick(1_000, 1_501) &&
      !isRepeatClick(null, 1_000),
    detail: 'a press within 500 ms of the last one is dropped, later is kept, the first always captures',
  });

  const insidePoint = { x: region.x + 10, y: region.y + 10 };
  const windowRect = { x: region.x + 5, y: region.y + 5, width: 300, height: 200 };
  const elsewhere = { x: region.x + 900, y: region.y + 900, width: 100, height: 100 };
  const sameRect = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
  results.push({
    name: 'each mode frames its own rectangle',
    ok:
      sameRect(frameFor('screen', insidePoint, region, windowRect), display.bounds) &&
      sameRect(frameFor('window', insidePoint, region, windowRect), windowRect) &&
      sameRect(frameFor('window', insidePoint, region, elsewhere), display.bounds) &&
      sameRect(frameFor('window', insidePoint, region, null), display.bounds) &&
      sameRect(frameFor('region', insidePoint, region, windowRect), region) &&
      sameRect(frameFor('region', outsidePoint, region, windowRect), region),
    detail: 'screen takes the display, window takes the window and falls back twice, region always takes the region',
  });

  let framedBy: CaptureRequest | null = null;
  const clickedWindow = { x: region.x + 40, y: region.y + 30, width: 300, height: 200 };
  const windowed = new DesktopRecorder(
    () => region,
    (fn) => fn(),
    (request) => {
      framedBy = request;
      return Promise.resolve(null);
    },
    {
      grab: async () => syntheticDisplay,
      settings: () => ({ ...DEFAULT_CAPTURE_SETTINGS, captureMode: 'window' }),
      lookup: () => Promise.resolve(null),
      windowAt: () =>
        Promise.resolve({ ok: true, window: { title: 'Left pane', app: { name: 'Explorer' }, bounds: clickedWindow } }),
    },
  );
  await windowed.capture({ x: clickedWindow.x + 20, y: clickedWindow.y + 20 });
  const windowShot = (framedBy as CaptureRequest | null)?.image;
  results.push({
    name: 'window mode crops to the window that was clicked',
    ok: windowShot?.width === Math.round(clickedWindow.width * display.scaleFactor),
    detail: `${windowShot?.width ?? 0} px wide for a ${clickedWindow.width} px window`,
  });

  const control: ScreenElement = {
    role: 'button',
    name: 'SaveButton',
    textContent: null,
    ariaLabel: 'Save',
    altText: null,
    password: false,
    ancestors: [],
    children: [],
    rect: { x: region.x + 40, y: region.y + 30, width: 120, height: 32 },
  };
  let field: ScreenElement | null = {
    role: 'textbox',
    name: 'SearchBox',
    textContent: 'hello world',
    ariaLabel: 'Search',
    altText: null,
    password: false,
    ancestors: [],
    children: [],
    rect: { x: region.x + 20, y: region.y + 20, width: 200, height: 24 },
  };
  let seen: CaptureRequest | null = null;
  const metaRecorder = new DesktopRecorder(
    () => region,
    (fn) => fn(),
    (request) => {
      seen = request;
      return Promise.resolve(null);
    },
    {
      grab: async () => syntheticDisplay,
      settings: () => ({
        ...REGION_MODE,
        shortcuts: { ...REGION_MODE.shortcuts, capture: 'Alt+Shift+S' },
      }),
      lookup: () => Promise.resolve(control),
      focused: () => Promise.resolve(field),
      label: (keycode) => Promise.resolve(keycode === 31 ? 'S' : null),
    },
  );
  await metaRecorder.capture({ x: region.x + 60, y: region.y + 40 });
  const clicked = seen as CaptureRequest | null;
  const meta = clicked?.elementMeta;
  results.push({
    name: 'accessibility metadata reaches the step',
    ok:
      meta?.source === 'uia' &&
      meta.ariaLabel === 'Save' &&
      meta.name === 'SaveButton' &&
      meta.role === 'button' &&
      meta.rect.width === 120 &&
      meta.rect.x === 40,
    detail: `source ${meta?.source ?? 'none'}, role ${meta?.role ?? 'none'}, named ${meta?.ariaLabel ?? 'none'}`,
  });

  seen = null;
  await metaRecorder.writeTyping();
  const typed = seen as CaptureRequest | null;

  seen = null;
  field = { ...control };
  await metaRecorder.writeTyping();
  const onAButton = seen as CaptureRequest | null;

  seen = null;
  field = {
    role: 'textbox',
    name: null,
    textContent: null,
    ariaLabel: 'Search',
    altText: null,
    password: false,
    ancestors: [],
    children: [],
    rect: null,
  };
  await metaRecorder.writeTyping();
  const empty = seen as CaptureRequest | null;

  seen = null;
  field = {
    role: 'textbox',
    name: null,
    textContent: null,
    ariaLabel: 'Password',
    altText: null,
    password: true,
    ancestors: [],
    children: [],
    rect: { x: region.x + 20, y: region.y + 60, width: 200, height: 24 },
  };
  await metaRecorder.writeTyping();
  const secret = seen as CaptureRequest | null;

  results.push({
    name: 'typing lands as one input step',
    ok:
      typed?.action === 'input' &&
      typed.inputValue === 'hello world' &&
      typed.elementMeta.ariaLabel === 'Search' &&
      onAButton === null &&
      empty === null,
    detail: `wrote ${typed?.action ?? 'nothing'} carrying "${typed?.inputValue ?? ''}"; a button and an empty field wrote nothing`,
  });

  results.push({
    name: 'a password is a step but never a value',
    ok:
      secret?.action === 'input' &&
      secret.inputValue === undefined &&
      secret.elementMeta.inputType === 'password' &&
      secret.elementMeta.textContent === null,
    detail: `wrote ${secret?.action ?? 'nothing'} with inputValue ${String(secret?.inputValue)} and no captured text`,
  });

  const press = (keycode: number, held: Partial<KeyAction> = {}) =>
    isTextKey({ kind: 'keydown', keycode, shift: false, alt: false, ctrl: false, meta: false, at: 0, ...held });
  results.push({
    name: 'only typing keys open a session',
    ok:
      press(30) &&
      press(30, { shift: true }) &&
      !press(30, { ctrl: true }) &&
      !press(28) &&
      !press(15) &&
      !press(1) &&
      !press(42),
    detail: 'a letter types, shift still types, a shortcut does not, and Enter, Tab, Escape and Shift all close the session',
  });

  const pressed = (keycode: number, held: Partial<KeyAction> = {}): KeyAction => ({
    kind: 'keydown',
    keycode,
    shift: false,
    alt: false,
    ctrl: false,
    meta: false,
    at: 0,
    ...held,
  });

  seen = null;
  field = { ...control };
  await metaRecorder.captureKey(pressed(31, { ctrl: true }));
  const shortcut = seen as CaptureRequest | null;

  seen = null;
  await metaRecorder.captureKey(pressed(99, { ctrl: true }));
  const unnamed = seen as CaptureRequest | null;

  seen = null;
  await metaRecorder.captureKey(pressed(31, { alt: true, shift: true }));
  const ownHotkey = seen as CaptureRequest | null;

  results.push({
    name: 'our own hotkey never becomes a step',
    ok:
      ownHotkey === null &&
      isBoundShortcut('Alt+Shift+S', pressed(31, { alt: true, shift: true }), 'S') &&
      isBoundShortcut('shift+ALT+s', pressed(31, { alt: true, shift: true }), 'S') &&
      !isBoundShortcut('Alt+Shift+S', pressed(31, { alt: true }), 'S') &&
      !isBoundShortcut('Alt+Shift+S', pressed(31, { alt: true, shift: true, ctrl: true }), 'S') &&
      !isBoundShortcut('Alt+Shift+S', pressed(31, { alt: true, shift: true }), 'R') &&
      !isBoundShortcut(null, pressed(31, { alt: true, shift: true }), 'S'),
    detail: 'the configured accelerator is dropped whatever order it is written in, a near miss is not',
  });

  results.push({
    name: 'a shortcut is its own step',
    ok:
      shortcut?.action === 'keydown:Ctrl+S' &&
      comboLabel(pressed(31, { ctrl: true, shift: true }), 'S') === 'Ctrl+Shift+S' &&
      unnamed === null &&
      isRepeatKey({ keycode: 28, at: 1_000 }, 28, 1_400) &&
      !isRepeatKey({ keycode: 28, at: 1_000 }, 28, 1_600) &&
      !isRepeatKey({ keycode: 28, at: 1_000 }, 15, 1_100),
    detail: `wrote ${shortcut?.action ?? 'nothing'}; an unnameable key wrote nothing, auto-repeat collapses, a different key does not`,
  });

  const editor = (value: string | null): ScreenElement => ({
    role: 'document',
    name: null,
    textContent: value,
    ariaLabel: 'Document',
    altText: null,
    password: false,
    ancestors: [],
    children: [],
    rect: { x: region.x + 10, y: region.y + 10, width: 400, height: 300 },
  });

  seen = null;
  field = editor('x'.repeat(500));
  await metaRecorder.writeTyping('hello');
  const rich = seen as CaptureRequest | null;

  results.push({
    name: 'rich text falls back to the keystrokes',
    ok:
      rich?.inputValue === 'hello' &&
      typedTextFor(editor('a short note'), 'a sho', false) === 'a sho' &&
      typedTextFor(editor('a short note'), 'a sho') === 'a short note' &&
      typedTextFor(editor(null), 'typed') === 'typed' &&
      typedTextFor({ ...editor('\uFEFFhi\u200B'), role: 'textbox' }, '') === 'hi' &&
      typedTextFor(control, 'typed') === null,
    detail: 'a document far longer than the buffer yields the buffer, a short one yields the field, markers are stripped, a button yields nothing',
  });

  const typedThenClicked = async (keysAfterSnapshot: number) => {
    const sent: CaptureRequest[] = [];
    let focus: ScreenElement | null = { ...editor('whats is my ip'), role: 'textbox', ariaLabel: 'Address' };
    const typist = new DesktopRecorder(
      () => region,
      (fn) => fn(),
      (request) => {
        sent.push(request);
        return Promise.resolve(null);
      },
      {
        grab: async () => syntheticDisplay,
        settings: () => REGION_MODE,
        lookup: () => Promise.resolve(control),
        focused: () => Promise.resolve(focus),
        resolve: () => Promise.resolve('x'),
        reset: () => Promise.resolve(),
      },
    );
    const key = () => typist.onAction(pressed(30));
    for (let i = 0; i < 3; i++) key();
    await new Promise((resolve) => setTimeout(resolve, 500));
    for (let i = 0; i < keysAfterSnapshot; i++) key();
    focus = { ...control };
    typist.onAction({ kind: 'click', button: 1, x: region.x + 60, y: region.y + 40, clicks: 1, at: Date.now() });
    await typist.drain();
    return sent.find((request) => request.action === 'input');
  };
  const settledTyping = await typedThenClicked(0);
  const hurriedTyping = await typedThenClicked(1);
  results.push({
    name: 'typing survives a click that moves the focus',
    ok:
      settledTyping?.inputValue === 'whats is my ip' &&
      settledTyping.elementMeta.ariaLabel === 'Address' &&
      hurriedTyping?.inputValue === 'xxxx' &&
      hurriedTyping.elementMeta.ariaLabel === 'Address',
    detail: `a settled field gave "${settledTyping?.inputValue ?? ''}", a key after the snapshot gave "${hurriedTyping?.inputValue ?? ''}"`,
  });

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const calls: string[] = [];
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const busy = new DesktopRecorder(
    () => region,
    (fn) => fn(),
    async () => {
      await gate;
      return null;
    },
    {
      grab: async () => {
        calls.push('grab');
        return syntheticDisplay;
      },
      settings: () => REGION_MODE,
      lookup: () => {
        calls.push('lookup');
        return Promise.resolve(control);
      },
      focused: () => {
        calls.push('focused');
        return Promise.resolve(field);
      },
      resolve: () => Promise.resolve('x'),
      reset: () => Promise.resolve(),
    },
  );
  const tap = (x: number) =>
    busy.onAction({ kind: 'click', button: 1, x: region.x + x, y: region.y + 40, clicks: 1, at: Date.now() });
  tap(60);
  await wait(600);
  tap(200);
  for (let i = 0; i < 3; i++) busy.onAction(pressed(30));
  busy.onAction(pressed(28));
  await wait(50);
  const early = [...calls];
  release();
  await busy.drain();
  const count = (name: string) => early.filter((call) => call === name).length;
  results.push({
    name: 'a press is read when it happens, not when the queue gets to it',
    ok: count('lookup') === 2 && count('grab') === 3 && count('focused') === 1,
    detail: `with the first step still being written: ${count('lookup')} lookups, ${count('grab')} grabs, ${count('focused')} field reads`,
  });

  let busyNow = false;
  const stepless = new DesktopRecorder(
    () => region,
    (fn) => {
      busyNow = true;
      return fn();
    },
    () => Promise.resolve(null),
    {
      grab: async () => syntheticDisplay,
      settings: () => REGION_MODE,
      focused: () => Promise.resolve({ ...control }),
      resolve: () => Promise.resolve('x'),
      reset: () => Promise.resolve(),
      drained: () => {
        busyNow = false;
      },
    },
  );
  for (let i = 0; i < 3; i++) stepless.onAction(pressed(30));
  stepless.onAction(pressed(28));
  await stepless.drain();
  await wait(50);
  results.push({
    name: 'typing that writes no step leaves the card idle',
    ok: !busyNow,
    detail: busyNow ? 'still marked as capturing after the queue emptied' : 'capturing cleared once the queue emptied',
  });

  const page = { x: 0, y: 0, width: 800, height: 600 };
  const click = { x: 160, y: 66 };
  const boxed = (rect: ScreenElement['rect']) => targetRect({ ...control, rect }, page, click).width;
  results.push({
    name: 'the target box hugs the control',
    ok:
      boxed({ x: 100, y: 50, width: 120, height: 32 }) === 120 &&
      targetRect(null, page, click).width === 28 &&
      boxed({ x: 0, y: 0, width: 800, height: 600 }) === 28 &&
      boxed({ x: 700, y: 50, width: 200, height: 32 }) === 28,
    detail: 'a real rectangle wins; no element, one covering the frame, or one overflowing it falls back to the click box',
  });

  activeGuide = await ask<string>(win.webContents, 'mimik:capture:startGuide');

  settings = { ...REGION_MODE, screenshotDelayMs: 400 };
  const before = Date.now();
  await recorder.capture({ x: region.x + 10, y: region.y + 10 });
  const elapsed = Date.now() - before;
  results.push({
    name: 'screenshot delay is honoured',
    ok: elapsed >= 400,
    detail: `${elapsed} ms for a 400 ms delay`,
  });

  const probeSrc = await ask<string | null>(win.webContents, 'mimik:check:screenshotSrc', activeGuide, 20_000);
  const defaultLogo = await ask<boolean>(win.webContents, 'mimik:check:defaultLogo', undefined, 10_000);
  results.push({
    name: 'exports can load the default logo',
    ok: defaultLogo === true,
    detail: defaultLogo ? 'mimik-mark.png served beside the page' : 'mimik-mark.png did not load',
  });

  await ask(win.webContents, 'mimik:check:cleanup', [guideId, activeGuide], 30_000);

  const app_ = new BrowserWindow({
    show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.cjs'), contextIsolation: true },
  });
  await app_.loadFile(join(__dirname, '../renderer/index.html'));
  let wired = 'no reply';
  try {
    const id = await ask<string>(app_.webContents, 'mimik:capture:startGuide', undefined, 20_000);
    wired = typeof id === 'string' && id.length > 0 ? id : `unexpected reply ${JSON.stringify(id)}`;
    await ask(app_.webContents, 'mimik:check:cleanup', [id], 20_000).catch(() => undefined);
  } catch (error) {
    wired = error instanceof Error ? error.message : String(error);
  }
  results.push({
    name: 'the app window answers capture requests',
    ok: /^[0-9a-f-]{36}$/.test(wired),
    detail: wired,
  });

  let titled = 'no reply';
  try {
    const id = await ask<string>(app_.webContents, 'mimik:capture:startGuide', undefined, 20_000);
    await ask(app_.webContents, 'mimik:capture:finishGuide', id, 20_000);
    titled = (await ask<string | null>(win.webContents, 'mimik:check:title', id, 20_000)) ?? 'no guide';
    await ask(app_.webContents, 'mimik:check:cleanup', [id], 20_000).catch(() => undefined);
  } catch (error) {
    titled = error instanceof Error ? error.message : String(error);
  }
  results.push({
    name: 'stopping names the guide',
    ok: titled.length > 0 && titled !== 'Untitled Guide' && !titled.includes('untitledGuide'),
    detail: titled,
  });

  const probe = probeSrc ?? `${SCREENSHOT_SCHEME}://${randomUUID()}`;
  const fetched = await app_.webContents.executeJavaScript(
    `fetch(${JSON.stringify(probe)}).then(r => r.ok ? r.blob().then(b => 'ok ' + b.size + ' bytes') : 'status ' + r.status).catch(e => 'threw ' + e.message)`,
  );
  results.push({
    name: 'the app window can reach the scheme',
    ok: typeof fetched === 'string' && fetched.startsWith('ok '),
    detail: String(fetched),
  });

  const kept = await ask<string[]>(win.webContents, 'mimik:check:screenshotIds', undefined, 20_000);
  const swept = sweepScreenshots(kept);
  results.push({
    name: 'deleted guides leave no files',
    ok: sweepScreenshots(kept) === 0,
    detail: `${swept} orphaned file(s) removed, none left behind`,
  });

  const stopped = 'bc4e4a1e-0000-4000-8000-000000000001';
  app_.webContents.send('mimik:capture:command', 'stop', 'idle', region, stopped);
  let shown = 'no navigation';
  for (let i = 0; i < 40 && !shown.startsWith('#guide/'); i++) {
    await new Promise((r) => setTimeout(r, 50));
    shown = await app_.webContents.executeJavaScript('window.location.hash');
  }
  app_.destroy();
  results.push({
    name: 'stopping opens the new guide',
    ok: shown === `#guide/${stopped}`,
    detail: shown || 'no navigation',
  });

  process.stdout.write(
    `capture area ${region.width} × ${region.height} on a ${display.bounds.width} × ${display.bounds.height} display at ${display.scaleFactor}x\n\n`,
  );
  for (const result of results) {
    process.stdout.write(`${result.ok ? 'ok  ' : 'FAIL'} ${result.name.padEnd(36)} ${result.detail}\n`);
  }

  const failures = results.filter((r) => !r.ok).length;
  process.stdout.write(`\n${failures === 0 ? 'desktop captures are ordinary guides' : `${failures} failure(s)`}\n`);
  app.exit(failures === 0 ? 0 : 1);
}).catch(bail);
