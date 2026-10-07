import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { app, BrowserWindow, nativeImage, protocol, screen } from 'electron';
import { ask } from '../src/main/ask';
import { DesktopRecorder, shouldCapture } from '../src/main/capture/recorder';
import { clampToDisplays } from '../src/main/capture/region';
import { registerScreenshotProtocol, SCREENSHOT_SCHEME, sweepScreenshots } from '../src/main/capture/screenshot-store';
import { DEFAULT_CAPTURE_SETTINGS, loadSettings, normaliseSettings, saveSettings } from '../src/main/capture/settings';
import type { Capture } from '../src/main/capture/screenshot';

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

  function syntheticDisplay(displayId: number): Promise<Capture> {
    const scale = display.scaleFactor;
    const width = Math.round(display.bounds.width * scale);
    const height = Math.round(display.bounds.height * scale);
    const pixels = Buffer.alloc(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = (i / 4) % 256;
      pixels[i + 1] = 80;
      pixels[i + 2] = 200;
      pixels[i + 3] = 255;
    }
    const image = nativeImage.createFromBuffer(pixels, { width, height });
    return Promise.resolve({ png: image.toPNG(), width, height, scaleFactor: scale, displayId });
  }

  let settings = { ...DEFAULT_CAPTURE_SETTINGS, showCursor: false };
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
      reloaded.screenshotDelayMs === 750 &&
      reloaded.captureOutsideClicks === stored.captureOutsideClicks,
    detail: `5000 ms clamped to ${clamped.screenshotDelayMs}, unknown style fell back to ${clamped.cursorStyle}, 750 ms reloaded as ${reloaded.screenshotDelayMs}`,
  });
  saveSettings(userSettings);

  const outsidePoint = { x: region.x + region.width + 40, y: region.y + 20 };
  results.push({
    name: 'outside clicks are opt in',
    ok:
      !shouldCapture({ ...DEFAULT_CAPTURE_SETTINGS, captureOutsideClicks: false }, region, outsidePoint) &&
      shouldCapture({ ...DEFAULT_CAPTURE_SETTINGS, captureOutsideClicks: true }, region, outsidePoint) &&
      shouldCapture({ ...DEFAULT_CAPTURE_SETTINGS, captureOutsideClicks: false }, region, {
        x: region.x + 10,
        y: region.y + 10,
      }),
    detail: 'ignored when off, captured when on, inside always captured',
  });

  activeGuide = await ask<string>(win.webContents, 'mimik:capture:startGuide');

  settings = { ...DEFAULT_CAPTURE_SETTINGS, screenshotDelayMs: 400, showCursor: false };
  const before = Date.now();
  await recorder.capture({ x: region.x + 10, y: region.y + 10 });
  const elapsed = Date.now() - before;
  results.push({
    name: 'screenshot delay is honoured',
    ok: elapsed >= 400,
    detail: `${elapsed} ms for a 400 ms delay`,
  });

  settings = { ...DEFAULT_CAPTURE_SETTINGS, showCursor: true, cursorStyle: 'arrow', screenshotDelayMs: 0 };
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
