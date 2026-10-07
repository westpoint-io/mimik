import { app, BrowserWindow, screen, webContents } from 'electron';
import { clampToDisplays, defaultRegion, loadRegion, type Region, saveRegion } from '../src/main/capture/region';
import { CaptureOverlay } from '../src/main/overlay';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function check(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 400));
}

function overlayWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows();
}

function windowWithHash(hash: string): BrowserWindow | null {
  const contents = webContents.getAllWebContents().find((wc) => wc.getURL().endsWith(`#${hash}`));
  return contents ? BrowserWindow.fromWebContents(contents) : null;
}

app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

function bail(error: unknown): never {
  process.stdout.write(`FAIL check-overlay aborted: ${error instanceof Error ? error.stack : String(error)}\n`);
  app.exit(1);
  throw error;
}

setTimeout(() => bail(new Error('check did not finish within 60s')), 60_000).unref();

app.whenReady().then(async () => {
  const commands: string[] = [];
  const overlay = new CaptureOverlay((command) => commands.push(command));

  const stored: Region = { x: 120, y: 90, width: 640, height: 400 };
  const written = saveRegion(stored);
  const read = loadRegion();
  check(
    'region persists',
    read.x === written.x && read.y === written.y && read.width === written.width && read.height === written.height,
    `${read.width} × ${read.height} at ${read.x}, ${read.y} survived a save and reload`,
  );

  const far = clampToDisplays({ x: 100_000, y: 100_000, width: 800, height: 600 });
  const displays = screen.getAllDisplays();
  const landed = displays.find(
    (d) =>
      far.x >= d.workArea.x &&
      far.y >= d.workArea.y &&
      far.x + far.width <= d.workArea.x + d.workArea.width &&
      far.y + far.height <= d.workArea.y + d.workArea.height,
  );
  check(
    'clamps onto a real display',
    Boolean(landed),
    `off-screen rect landed on display ${landed?.id ?? 'none'} of ${displays.length}`,
  );

  const tiny = clampToDisplays({ x: 0, y: 0, width: 10, height: 10 });
  check('honours the minimum size', tiny.width >= 240 && tiny.height >= 160, `${tiny.width} × ${tiny.height}`);
  overlay.edit();
  await settle();
  const editors = overlayWindows();
  check(
    'one editor per display',
    editors.length === displays.length,
    `${editors.length} editor window(s) for ${displays.length} display(s)`,
  );
  overlay.arm();
  await settle();
  const armed = overlayWindows();
  check('boundary and controls shown', armed.length === 2 && armed.every((w) => w.isVisible()), `${armed.length} windows visible`);
  const controls = windowWithHash('controls');
  const bar = controls?.getBounds();
  const r = overlay.region;
  check(
    'controls sit outside the region',
    bar !== undefined && (bar.y >= r.y + r.height || bar.y + bar.height <= r.y),
    bar ? `controls at y ${bar.y}, region spans ${r.y} to ${r.y + r.height}` : 'no controls window',
  );
  await controls?.webContents.executeJavaScript("document.querySelector('button.primary').click()");
  await settle();
  check(
    'Start reaches the host and records',
    commands.includes('start') && overlay.state === 'recording',
    `commands: ${commands.join(', ') || 'none'}; state is ${overlay.state}`,
  );
  await windowWithHash('controls')?.webContents.executeJavaScript("document.querySelector('button.primary').click()");
  await settle();
  check(
    'Pause reaches the host and pauses',
    commands.includes('pause') && overlay.state === 'paused',
    `commands: ${commands.join(', ')}; state is ${overlay.state}`,
  );
  await windowWithHash('controls')?.webContents.executeJavaScript(
    "document.querySelectorAll('button')[document.querySelectorAll('button').length - 1].click()",
  );
  await settle();
  check(
    'finishing hides the area and the controls',
    overlay.state === 'hidden' && overlayWindows().every((w) => !w.isVisible()),
    `state is ${overlay.state}; ${overlayWindows().filter((w) => w.isVisible()).length} window(s) still visible`,
  );
  overlay.arm();
  await settle();

  let hiddenDuringCapture = false;
  await overlay.withHidden(async () => {
    hiddenDuringCapture = overlayWindows().every((w) => !w.isVisible());
  });
  await settle();
  const restored = overlayWindows().every((w) => w.isVisible());
  check('overlays leave the frame for a capture', hiddenDuringCapture && restored, 'hidden during, restored after');
  overlay.hide();
  overlay.destroy();
  saveRegion(defaultRegion());

  for (const result of results) {
    process.stdout.write(`${result.ok ? 'ok  ' : 'FAIL'} ${result.name.padEnd(32)} ${result.detail}\n`);
  }
  const failures = results.filter((r) => !r.ok).length;
  process.stdout.write(`\n${failures === 0 ? 'capture area and controls behave' : `${failures} failure(s)`}\n`);
  app.exit(failures === 0 ? 0 : 1);
}).catch(bail);
