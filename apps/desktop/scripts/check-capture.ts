import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app, nativeImage, screen } from 'electron';
import {
  captureCursorDisplay,
  cursorPoint,
  elementAt,
  elementLookupAvailable,
  focusedWindow,
  keyLabel,
  resolveKey,
  InputHook,
  listDisplays,
} from '../src/main/capture';
import { enableAccessibility, wakeApps } from '../src/main/capture/element';

function distinctColours(png: Buffer): number {
  const bitmap = nativeImage.createFromBuffer(png).toBitmap();
  const seen = new Set<string>();
  for (let i = 0; i < bitmap.length && seen.size <= 64; i += 4 * 997) {
    seen.add(`${bitmap[i]},${bitmap[i + 1]},${bitmap[i + 2]}`);
  }
  return seen.size;
}

const TARGET_PAGE = `<!doctype html><html><body style="margin:0;height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#1E1B4B,#C7D2FE)"><button aria-label="Capture check target" style="width:60vw;height:60vh;font:600 32px sans-serif;color:#1E1B4B;background:#EEF2FF;border:0;border-radius:24px">Capture check target</button></body></html>`;

const TARGET_MAIN = `const { app, BrowserWindow, screen } = require('electron');
app.whenReady().then(() => {
  const target = new BrowserWindow({ ...screen.getPrimaryDisplay().bounds, backgroundColor: '#1E1B4B' });
  target.loadURL('data:text/html,' + encodeURIComponent(${JSON.stringify(TARGET_PAGE)}));
});`;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function showTarget(dir: string): Promise<ChildProcess> {
  const main = join(dir, 'main.cjs');
  writeFileSync(main, TARGET_MAIN);
  const target = spawn(process.execPath, [main], { stdio: 'ignore' });
  await pause(4000);
  await wakeApps();
  await pause(1500);
  return target;
}

type Verdict = 'ok' | 'fail' | 'n/a';

function line(name: string, verdict: Verdict, detail: string): void {
  const tag = verdict === 'ok' ? 'ok  ' : verdict === 'n/a' ? 'n/a ' : 'FAIL';
  process.stdout.write(`${tag} ${name.padEnd(18)} ${detail}\n`);
}

InputHook.preferX11();
app.disableHardwareAcceleration();

async function runChecks(): Promise<number> {
  let failures = 0;

  const displays = listDisplays();
  const displaysOk = displays.length > 0 && displays.every((d) => d.scaleFactor > 0 && d.bounds.width > 0);
  if (!displaysOk) failures++;
  line('displays', displaysOk ? 'ok' : 'fail', displays.map((d) => `${d.bounds.width}x${d.bounds.height}@${d.scaleFactor}x`).join(', '));

  const point = cursorPoint();
  line('cursor', Number.isFinite(point.x) ? 'ok' : 'fail', `${point.x},${point.y}`);

  try {
    const shot = await captureCursorDisplay();
    const ok = shot.png.length > 0 && shot.width > 0;
    if (!ok) failures++;
    line('screenshot', ok ? 'ok' : 'fail', `${shot.width}x${shot.height}, ${(shot.png.length / 1024).toFixed(0)} KB png`);

    const display = screen.getDisplayNearestPoint(point);
    const expected = {
      width: Math.round(display.bounds.width * shot.scaleFactor),
      height: Math.round(display.bounds.height * shot.scaleFactor),
    };
    const sized = shot.width === expected.width && shot.height === expected.height;
    if (!sized) failures++;
    line(
      'frame covers display',
      sized ? 'ok' : 'fail',
      `${shot.width}x${shot.height}, expected ${expected.width}x${expected.height} at ${shot.scaleFactor}x`,
    );

    const colours = distinctColours(shot.png);
    const painted = colours > 1;
    if (!painted) failures++;
    line('frame is not blank', painted ? 'ok' : 'fail', `${colours} distinct colours sampled`);
  } catch (error) {
    failures++;
    line('screenshot', 'fail', error instanceof Error ? error.message : String(error));
  }

  const win = await focusedWindow();
  if (!win.ok && win.reason !== 'unsupported-session') failures++;
  line(
    'focused window',
    win.ok ? 'ok' : win.reason === 'unsupported-session' ? 'n/a' : 'fail',
    win.ok ? `${win.window.app.name} — ${win.window.title ?? '(untitled)'}` : `${win.reason}: ${win.detail}`,
  );

  const lookup = await elementLookupAvailable();
  const session = process.platform !== 'linux' || process.env.XDG_SESSION_TYPE === 'x11';
  const element = lookup && session ? await elementAt(point) : null;
  if (lookup && session && !element) failures++;
  line(
    'element at point',
    lookup && session ? (element ? 'ok' : 'fail') : 'n/a',
    lookup && session
      ? element
        ? `${element.role ?? 'no role'} — ${element.ariaLabel ?? '(unnamed)'}`
        : 'no element resolved under the cursor'
      : lookup
        ? 'Element lookup needs an X11 session'
        : 'the accessibility addon has no build for this platform',
  );

  const named = lookup ? await keyLabel(28) : null;
  const typed = lookup ? await resolveKey(30, false, false, false) : null;
  const keysOk = named === 'Enter' && typed?.length === 1;
  if (lookup && !keysOk) failures++;
  line(
    'key names',
    lookup ? (keysOk ? 'ok' : 'fail') : 'n/a',
    lookup
      ? `scancode 28 names ${named ?? 'nothing'}, scancode 30 types ${typed ?? 'nothing'} on the foreground layout`
      : 'no addon on this platform',
  );

  const hook = new InputHook();
  const started = await hook.start(() => {});
  if (!started.ok && started.reason !== 'unsupported-session') failures++;
  line(
    'input hook',
    started.ok ? 'ok' : started.reason === 'unsupported-session' ? 'n/a' : 'fail',
    started.ok ? 'started' : `${started.reason}: ${started.detail}`,
  );
  hook.stop();
  return failures;
}

app.whenReady().then(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mimik-check-'));
  let target: ChildProcess | null = null;
  let failures = 1;
  try {
    await enableAccessibility();
    target = await showTarget(dir);
    failures = await runChecks();
  } catch (error) {
    line('check', 'fail', error instanceof Error ? error.message : String(error));
  } finally {
    target?.kill();
    rmSync(dir, { recursive: true, force: true });
  }
  process.stdout.write(
    `\n${failures === 0 ? 'no failures — n/a lines are platform limits, not bugs' : `${failures} failure(s)`}\n`,
  );
  app.exit(failures === 0 ? 0 : 1);
});
