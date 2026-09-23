import { app, BrowserWindow, globalShortcut, screen, webContents } from 'electron';
import { clampToDisplays, defaultRegion, loadRegion, type Region, saveRegion } from '../src/main/capture/region';
import type { CaptureMode } from '../src/main/capture/settings';
import { CaptureOverlay } from '../src/main/overlay';
import { bindShortcuts, sameShortcuts, shortcutMap, unbindShortcuts } from '../src/main/shortcuts';

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

async function until(done: () => boolean, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (!done() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  return done();
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
  let mode: CaptureMode = 'region';
  const overlay: CaptureOverlay = new CaptureOverlay(
    (command) => commands.push(command),
    () => mode,
    {
      introFrame: async (): Promise<Region> => overlay.region,
      shortcuts: () => ({ startStop: 'Alt+Shift+R', capture: 'Alt+Shift+C' }),
    },
  );

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
  const { workArea } = screen.getDisplayMatching(overlay.region);
  check(
    'controls dock to the corner, clear of the middle',
    bar !== undefined &&
      bar.x + bar.width <= workArea.x + workArea.width &&
      bar.y + bar.height <= workArea.y + workArea.height &&
      bar.x > workArea.x + workArea.width / 2 &&
      bar.y > workArea.y + workArea.height / 2,
    bar ? `controls at ${bar.x}, ${bar.y} (${bar.width} × ${bar.height}) in a ${workArea.width} × ${workArea.height} work area` : 'no controls window',
  );
  const layout = await controls?.webContents.executeJavaScript(
    "JSON.stringify({ tip: getComputedStyle(document.querySelector('#tip')).position, hint: getComputedStyle(document.querySelector('#keyHint')).position, body: document.body.scrollHeight, win: window.innerHeight })",
  );
  const parsed = JSON.parse(String(layout ?? '{}')) as { tip?: string; hint?: string; body?: number; win?: number };
  check(
    'the card measures itself and owns its own styles',
    parsed.tip === 'static' && parsed.hint === 'static' && typeof parsed.body === 'number' && parsed.body > 0 && parsed.body <= (parsed.win ?? 0) + 4,
    `tip is ${parsed.tip}, key hint is ${parsed.hint}, content ${parsed.body}px in a ${parsed.win}px window`,
  );

  check(
    'the controls card never takes focus',
    controls !== null && !controls.isFocusable() && overlayWindows().every((w) => !w.isFocused()),
    `controls focusable: ${controls?.isFocusable()}, focused overlay windows: ${overlayWindows().filter((w) => w.isFocused()).length}`,
  );

  await controls?.webContents.executeJavaScript("document.querySelector('#primary').click()");
  await settle();
  const starting = await windowWithHash('controls')?.webContents.executeJavaScript(
    "JSON.stringify({ label: document.querySelector('#label').textContent, start: document.querySelector('#primary').disabled })",
  );
  const intro = overlay.introWindow;
  const introBounds = intro?.getBounds();
  const startCard = JSON.parse(String(starting ?? '{}')) as { label?: string; start?: boolean };
  check(
    'Start plays the intro over the capture area before recording',
    intro !== null &&
      !commands.includes('start') &&
      overlay.state === 'armed' &&
      startCard.label === 'Starting…' &&
      startCard.start === true &&
      introBounds?.width === overlay.region.width &&
      introBounds?.height === overlay.region.height,
    `intro ${introBounds ? `${introBounds.width} × ${introBounds.height}` : 'missing'}, card says ${startCard.label}, commands: ${commands.join(', ') || 'none'}`,
  );
  const recorded = await until(() => overlay.state === 'recording', 7_000);
  check(
    'Start reaches the host and records once the intro ends',
    recorded && commands.includes('start') && overlay.introWindow === null,
    `commands: ${commands.join(', ') || 'none'}; state is ${overlay.state}; intro ${overlay.introWindow ? 'still open' : 'closed'}`,
  );
  await windowWithHash('controls')?.webContents.executeJavaScript("document.querySelector('#secondary').click()");
  await settle();
  check(
    'Pause reaches the host and pauses',
    commands.includes('pause') && overlay.state === 'paused',
    `commands: ${commands.join(', ')}; state is ${overlay.state}`,
  );
  await windowWithHash('controls')?.webContents.executeJavaScript("document.querySelector('#primary').click()");
  await settle();
  check(
    'finishing hides the area and the controls',
    overlay.state === 'hidden' && overlayWindows().every((w) => !w.isVisible()),
    `state is ${overlay.state}; ${overlayWindows().filter((w) => w.isVisible()).length} window(s) still visible`,
  );
  overlay.arm();
  await settle();

  const protectedAfterShow = overlayWindows().every((w) => w.isVisible());
  let outOfFrame = false;
  await overlay.withHidden(async () => {
    outOfFrame = process.platform === 'linux' ? overlayWindows().every((w) => !w.isVisible()) : protectedAfterShow;
  });
  await settle();
  const restored = overlayWindows().every((w) => w.isVisible());
  check(
    'overlays leave the frame for a capture',
    outOfFrame && restored,
    process.platform === 'linux'
      ? 'hidden during, restored after'
      : 'content protection applied after show, so no hide is needed',
  );
  const drawn = await windowWithHash('controls')?.webContents.executeJavaScript(
    "JSON.stringify({ paths: document.querySelectorAll('#mascot svg path').length, flash: document.querySelectorAll('#mascot svg .flash').length, visible: !document.querySelector('#intro').hidden, hint: document.querySelector('#keyHint').textContent })",
  );
  const mascot = JSON.parse(String(drawn ?? '{}')) as { paths?: number; flash?: number; visible?: boolean; hint?: string };
  check(
    'the armed card draws the camera mascot and the start shortcut',
    mascot.paths === 4 && mascot.flash === 1 && mascot.visible === true && mascot.hint === 'You can press Alt+Shift+R to start and stop.',
    `${mascot.paths} mascot paths, ${mascot.flash} flash, intro visible: ${mascot.visible}, hint: ${mascot.hint}`,
  );

  const evaluate = (script: string) => windowWithHash('controls')?.webContents.executeJavaScript(script);
  const card = async (fields: string) => JSON.parse(String((await evaluate(`JSON.stringify({ ${fields} })`)) ?? '{}'));
  const src = 'mimik-screenshot://00000000-0000-4000-8000-000000000000';
  overlay.record();
  await settle();
  const idle = await card("tip: document.querySelector('#tip').textContent, hint: document.querySelector('#keyHint').textContent");
  check(
    'recording with no steps waits for the first click',
    idle.tip === 'Your first click will show up here.' && idle.hint === 'You can press Alt+Shift+C to capture without clicking.',
    `tip: ${idle.tip}, hint: ${idle.hint}`,
  );

  overlay.showStep({ id: 'one', index: 1, title: 'Click "Save"', src, source: 'heuristic', pending: false, app: 'Explorer' });
  await settle();
  const step = await card(
    "intro: getComputedStyle(document.querySelector('#intro')).display, title: document.querySelector('#stepTitle').textContent, source: document.querySelector('#source').textContent, meta: document.querySelector('#metaText').textContent",
  );
  check(
    'the first step replaces the instructions, with its source and app',
    step.intro === 'none' && step.title === 'Click "Save"' && step.source === 'Basic' && step.meta === 'Step 1 · Explorer',
    `intro display: ${step.intro}, title: ${step.title}, source: ${step.source}, meta: ${step.meta}`,
  );

  overlay.showStep({ id: 'one', index: 1, title: 'Click "Save"', src, source: 'heuristic', pending: true, app: 'Explorer' });
  await settle();
  const writing = await card("writing: !document.querySelector('#writing').hidden, title: !document.querySelector('#stepTitle').hidden");
  overlay.showStep({ id: 'one', index: 1, title: 'Save the file', src, source: 'ai', pending: false, app: 'Explorer' });
  await settle();
  const rewritten = await card("source: document.querySelector('#source').textContent, title: document.querySelector('#stepTitle').textContent");
  check(
    'a pending description shows as being written, then carries the AI badge',
    writing.writing === true && writing.title === false && rewritten.source === 'AI' && rewritten.title === 'Save the file',
    `writing shown: ${writing.writing}, title shown: ${writing.title}; then ${rewritten.source} "${rewritten.title}"`,
  );

  await evaluate("document.querySelector('#remove').click()");
  await settle();
  check('removing the step reaches the host', commands.includes('remove'), `commands: ${commands.join(', ')}`);

  overlay.setBusy(true);
  await settle();
  const whileBusy = await windowWithHash('controls')?.webContents.executeJavaScript(
    "document.querySelector('#primary').disabled",
  );
  const veil = await card("text: document.querySelector('#veilText').textContent, remove: document.querySelector('#remove').hidden");
  check(
    'a capture in flight shows the mascot over the last screenshot',
    veil.text === 'Capturing step 2…' && veil.remove === true,
    `veil: ${veil.text}, remove hidden: ${veil.remove}`,
  );
  overlay.setBusy(false);
  await settle();
  const whenIdle = await windowWithHash('controls')?.webContents.executeJavaScript(
    "document.querySelector('#primary').disabled",
  );
  const order = await windowWithHash('controls')?.webContents.executeJavaScript(
    "JSON.stringify([...document.querySelectorAll('#foot button')].map((b) => b.id + ':' + b.textContent.trim()))",
  );
  check(
    'Finish sits on the right, as the primary action',
    String(order).includes('secondary:Pause') && String(order).indexOf('primary:Finish') > String(order).indexOf('secondary:Pause'),
    String(order),
  );
  check(
    'Finish is disabled while a capture is in flight',
    whileBusy === true && whenIdle === false,
    `disabled while busy: ${whileBusy}, after: ${whenIdle}`,
  );

  mode = 'screen';
  overlay.refresh();
  await settle();
  const framed = overlayWindows();
  const active = await windowWithHash('controls')?.webContents.executeJavaScript(
    "document.querySelector('button.mode.active')?.dataset.mode ?? 'none'",
  );
  check(
    'whole-screen mode drops the boundary',
    framed.length === 1 && windowWithHash('boundary') === null && active === 'screen',
    `${framed.length} overlay window(s), active mode button is ${active}`,
  );

  const outside = { x: overlay.region.x - 5000, y: overlay.region.y - 5000 };
  const bars = windowWithHash('controls')?.getBounds();
  check(
    'clicks on the controls never become steps',
    overlay.ignores({ x: (bars?.x ?? 0) + 4, y: (bars?.y ?? 0) + 4 }) && !overlay.ignores(outside),
    'the controls bar is ignored, a point away from it is not',
  );

  const keys = { startStop: 'Alt+Shift+F13', pauseResume: 'Alt+Shift+F14', capture: 'Alt+Shift+F15' };
  const fired: string[] = [];
  const refusedIdle = bindShortcuts(shortcutMap(keys, false), (name) => fired.push(name));
  const idleOnly =
    globalShortcut.isRegistered(keys.startStop) &&
    !globalShortcut.isRegistered(keys.pauseResume) &&
    !globalShortcut.isRegistered(keys.capture);
  const refusedRecording = bindShortcuts(shortcutMap(keys, true), (name) => fired.push(name));
  const allThree = Object.values(keys).every((key) => globalShortcut.isRegistered(key));
  unbindShortcuts();
  const released = Object.values(keys).every((key) => !globalShortcut.isRegistered(key));
  check(
    'shortcuts bind only while they can act',
    idleOnly && allThree && released && refusedIdle.length === 0 && refusedRecording.length === 0,
    'start/stop is always live, pause and capture only while recording, all released on unbind',
  );

  bindShortcuts(shortcutMap(keys, true), () => {});
  let rebound = false;
  bindShortcuts(shortcutMap(keys, true), () => {
    rebound = true;
  });
  const stillLive = Object.values(keys).every((key) => globalShortcut.isRegistered(key));
  unbindShortcuts();
  check(
    'rebinding an unchanged set touches nothing',
    stillLive &&
      !rebound &&
      sameShortcuts(shortcutMap(keys, true), shortcutMap(keys, true)) &&
      !sameShortcuts(shortcutMap(keys, false), shortcutMap(keys, true)),
    'the same map is a no-op, so a shortcut never unregisters itself from inside its own handler',
  );

  const clash = bindShortcuts(shortcutMap({ ...keys, startStop: 'NotAKey+@@' }, false), () => {});
  unbindShortcuts();
  check(
    'an unusable accelerator is reported, not thrown',
    clash.length === 1 && clash[0] === 'NotAKey+@@',
    `refused ${clash.join(', ') || 'nothing'}`,
  );

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
