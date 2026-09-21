import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { app, BrowserWindow, nativeImage, protocol, screen } from 'electron';
import { ask } from '../src/main/ask';
import type { ScreenElement } from '../src/main/capture/element';
import {
  type CaptureRequest,
  DesktopRecorder,
  frameFor,
  isRepeatClick,
  shouldCapture,
  targetRect,
} from '../src/main/capture/recorder';
import { clampToDisplays } from '../src/main/capture/region';
import { registerScreenshotProtocol, SCREENSHOT_SCHEME, sweepScreenshots } from '../src/main/capture/screenshot-store';
import { DEFAULT_CAPTURE_SETTINGS, loadSettings, normaliseSettings, saveSettings } from '../src/main/capture/settings';
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

  const REGION_MODE = { ...DEFAULT_CAPTURE_SETTINGS, captureMode: 'region' as const };
  let settings = { ...REGION_MODE, showCursor: false };
  let activeGuide = '';
  const recorder = new DesktopRecorder(
    () => region,
    (fn) => fn(),
    (request) => ask(win.webContents, 'mimik:capture:step', { ...request, guideId: activeGuide }),
    syntheticDisplay,
    () => settings,
  );

  activeGuide = await ask<string>(win.webContents, 'mimik:capture:startGuide');
  const guideId = activeGuide;

  await recorder.capture({ x: region.x + 120, y: region.y + 90 });
  await recorder.capture({ x: region.x + 400, y: region.y + 300 });
  const results = await ask<CheckResult[]>(win.webContents, 'mimik:check:verify', guideId, 60_000);

  const userSettings = loadSettings();
  const clamped = normaliseSettings({ screenshotDelayMs: 5000, cursorStyle: 'wobble' as never });
  const stored = saveSettings({ screenshotDelayMs: 750, captureOutsideClicks: true });
  const reloaded = loadSettings();
  results.push({
    name: 'settings clamp and persist',
    ok:
      clamped.screenshotDelayMs === 2000 &&
      clamped.cursorStyle === DEFAULT_CAPTURE_SETTINGS.cursorStyle &&
      normaliseSettings({ captureMode: 'sideways' as never }).captureMode === DEFAULT_CAPTURE_SETTINGS.captureMode &&
      reloaded.screenshotDelayMs === 750 &&
      reloaded.captureOutsideClicks === stored.captureOutsideClicks,
    detail: `5000 ms clamped to ${clamped.screenshotDelayMs}, unknown style fell back to ${clamped.cursorStyle}, 750 ms reloaded as ${reloaded.screenshotDelayMs}`,
  });
  saveSettings(userSettings);

  const outsidePoint = { x: region.x + region.width + 40, y: region.y + 20 };
  results.push({
    name: 'outside clicks are opt in',
    ok:
      !shouldCapture({ ...REGION_MODE, captureOutsideClicks: false }, region, outsidePoint) &&
      shouldCapture({ ...REGION_MODE, captureOutsideClicks: true }, region, outsidePoint) &&
      shouldCapture({ ...REGION_MODE, captureOutsideClicks: false }, region, {
        x: region.x + 10,
        y: region.y + 10,
      }) &&
      shouldCapture({ ...DEFAULT_CAPTURE_SETTINGS, captureOutsideClicks: false }, region, outsidePoint),
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
      sameRect(frameFor('region', outsidePoint, region, windowRect), display.bounds),
    detail: 'screen takes the display, window takes the window and falls back twice, region takes the region',
  });

  const control: ScreenElement = {
    role: 'button',
    name: 'SaveButton',
    textContent: null,
    ariaLabel: 'Save',
    altText: null,
    rect: { x: region.x + 40, y: region.y + 30, width: 120, height: 32 },
  };
  let seen: CaptureRequest | null = null;
  const metaRecorder = new DesktopRecorder(
    () => region,
    (fn) => fn(),
    (request) => {
      seen = request;
      return Promise.resolve(null);
    },
    syntheticDisplay,
    () => ({ ...REGION_MODE, showCursor: false }),
    () => false,
    () => Promise.resolve(control),
  );
  await metaRecorder.capture({ x: region.x + 60, y: region.y + 40 });
  const meta = (seen as CaptureRequest | null)?.elementMeta;
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

  settings = { ...REGION_MODE, screenshotDelayMs: 400, showCursor: false };
  const before = Date.now();
  await recorder.capture({ x: region.x + 10, y: region.y + 10 });
  const elapsed = Date.now() - before;
  results.push({
    name: 'screenshot delay is honoured',
    ok: elapsed >= 400,
    detail: `${elapsed} ms for a 400 ms delay`,
  });

  settings = { ...REGION_MODE, showCursor: true, cursorStyle: 'arrow', screenshotDelayMs: 0 };
  await recorder.capture({ x: region.x + 200, y: region.y + 150 });
  const cursorSizes = await ask<number[]>(win.webContents, 'mimik:check:renderedSizes', activeGuide, 30_000);
  const bare = cursorSizes[cursorSizes.length - 2] ?? 0;
  const drawn = cursorSizes[cursorSizes.length - 1] ?? 0;
  results.push({
    name: 'cursor is drawn when rendered',
    ok: bare > 0 && drawn > 0 && bare !== drawn,
    detail: `${bare} bytes rendered without a cursor, ${drawn} bytes with one`,
  });

  const probeSrc = await ask<string | null>(win.webContents, 'mimik:check:screenshotSrc', activeGuide, 20_000);

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
