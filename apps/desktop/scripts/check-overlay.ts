import { join } from 'node:path';
import { CaptureState, captureMachine } from '@mimik/core/capture/machine';
import { app, BrowserWindow, globalShortcut, screen, webContents } from 'electron';
import { clampToDisplays, defaultRegion, loadRegion, type Region, saveRegion } from '../src/main/capture/region';
import type { CaptureMode } from '../src/main/capture/settings';
import { CaptureOverlay } from '../src/main/overlay';
import { bindShortcuts, sameShortcuts, shortcutMap, unbindShortcuts } from '../src/main/shortcuts';
import { createActor } from 'xstate';

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
  let mode: CaptureMode = 'area';
  const capture = createActor(captureMachine).start();
  const record = () => {
    const state = capture.getSnapshot().value;
    if (state === CaptureState.IDLE) capture.send({ type: 'ARM' });
    if (capture.getSnapshot().value === CaptureState.ARMED) capture.send({ type: 'START_RECORDING' });
    if (state === CaptureState.PAUSED) capture.send({ type: 'RESUME_CAPTURE' });
  };
  const pause = () => capture.send({ type: 'PAUSE_CAPTURE', reason: 'manual' });
  const overlay: CaptureOverlay = new CaptureOverlay(
    capture,
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
  check('honours the minimum size', tiny.width >= 60 && tiny.height >= 30, `${tiny.width} × ${tiny.height}`);
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
      overlay.state === CaptureState.ARMED &&
      startCard.label === 'Starting…' &&
      startCard.start === true &&
      introBounds?.width === overlay.region.width &&
      introBounds?.height === overlay.region.height,
    `intro ${introBounds ? `${introBounds.width} × ${introBounds.height}` : 'missing'}, card says ${startCard.label}, commands: ${commands.join(', ') || 'none'}`,
  );
  const recorded = await until(() => overlay.state === CaptureState.RECORDING, 7_000);
  check(
    'Start reaches the host and records once the intro ends',
    recorded && commands.includes('start') && overlay.introWindow === null,
    `commands: ${commands.join(', ') || 'none'}; state is ${overlay.state}; intro ${overlay.introWindow ? 'still open' : 'closed'}`,
  );
  await windowWithHash('controls')?.webContents.executeJavaScript("document.querySelector('#secondary').click()");
  await settle();
  const pausedInto = overlay.isEditing ? 'editor' : overlay.state;
  overlay.run('cancelEdit');
  await settle();
  check(
    'Pause in Area mode pauses and opens the area editor, and Cancel leaves it paused',
    commands.includes('pause') && pausedInto === 'editor' && overlay.state === CaptureState.PAUSED,
    `commands: ${commands.join(', ')}; pause opened ${pausedInto}, cancel left ${overlay.state}`,
  );
  await windowWithHash('controls')?.webContents.executeJavaScript("document.querySelector('#primary').click()");
  await settle();
  check(
    'finishing hides the area and the controls',
    overlay.state === CaptureState.IDLE && overlayWindows().every((w) => !w.isVisible()),
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
    mascot.paths === 4 && mascot.flash === 1 && mascot.visible === true && mascot.hint === 'Tip: you can press Alt+Shift+R to start and stop.',
    `${mascot.paths} mascot paths, ${mascot.flash} flash, intro visible: ${mascot.visible}, hint: ${mascot.hint}`,
  );

  const evaluate = (script: string) => windowWithHash('controls')?.webContents.executeJavaScript(script);
  const card = async (fields: string) => JSON.parse(String((await evaluate(`JSON.stringify({ ${fields} })`)) ?? '{}'));
  const src = 'mimik-screenshot://00000000-0000-4000-8000-000000000000';
  record();
  await settle();
  const idle = await card("tip: document.querySelector('#tip').textContent, hint: document.querySelector('#keyHint').textContent");
  check(
    'recording with no steps waits for the first click',
    idle.tip === 'Your first click will show up here.' && idle.hint === 'Tip: you can press Alt+Shift+C to capture without clicking.',
    `tip: ${idle.tip}, hint: ${idle.hint}`,
  );
  const badgeWhileRecording = await card("badge: !document.querySelector('#badge').hidden && document.querySelector('#badge').textContent");
  pause();
  await settle();
  const resting = await card(
    "tip: document.querySelector('#tip').textContent, intro: !document.querySelector('#intro').hidden, resting: document.body.classList.contains('resting'), hint: document.querySelector('#keyHint').hidden",
  );
  record();
  await settle();
  check(
    'recording names its mode, and an empty pause is not a blank card',
    typeof badgeWhileRecording.badge === 'string' &&
      badgeWhileRecording.badge.length > 0 &&
      resting.tip === 'Nothing is recorded while paused.' &&
      resting.intro === true &&
      resting.resting === true &&
      resting.hint === true,
    `badge ${badgeWhileRecording.badge}, paused tip ${resting.tip}, mascot shown ${resting.intro}`,
  );

  overlay.showStep({ id: 'one', number: 1, title: 'Click "Save"', action: 'click', src, source: 'heuristic', pending: false, app: 'Explorer' });
  await settle();
  const step = await card(
    "intro: getComputedStyle(document.querySelector('#intro')).display, title: document.querySelector('#stepTitle').textContent, source: document.querySelector('#source').textContent, meta: document.querySelector('#metaText').textContent",
  );
  check(
    'the first step replaces the instructions, with its source and app',
    step.intro === 'none' && step.title === 'Click "Save"' && step.source === 'Basic' && step.meta === 'Step 1 · Explorer',
    `intro display: ${step.intro}, title: ${step.title}, source: ${step.source}, meta: ${step.meta}`,
  );

  overlay.showStep({ id: 'one', number: 1, title: 'Click "Save"', action: 'click', src, source: 'heuristic', pending: true, app: 'Explorer' });
  await settle();
  const pendingStep = await card(
    "title: document.querySelector('#stepTitle').textContent, source: document.querySelector('#source').textContent, loaders: document.querySelectorAll('#writing, #skeleton, #pillWriting').length",
  );
  overlay.showStep({ id: 'one', number: 1, title: 'Save the file', action: 'click', src, source: 'ai', pending: false, app: 'Explorer' });
  await settle();
  const rewritten = await card("source: document.querySelector('#source').textContent, title: document.querySelector('#stepTitle').textContent");
  check(
    'a pending description keeps the rule-based title, then the AI text replaces it in place',
    pendingStep.title === 'Click "Save"' &&
      pendingStep.source === 'Basic' &&
      pendingStep.loaders === 0 &&
      rewritten.source === 'AI' &&
      rewritten.title === 'Save the file',
    `while pending: ${pendingStep.source} "${pendingStep.title}", ${pendingStep.loaders} writing loaders; then ${rewritten.source} "${rewritten.title}"`,
  );

  overlay.showStep({ id: 'one', number: 1, title: 'Press ⌃S on "Search"', action: 'keydown:⌃S', src, source: 'heuristic', pending: false, app: 'Chrome' });
  await settle();
  const keyed = await card(
    "key: document.querySelector('#stepTitle kbd')?.textContent ?? null, title: document.querySelector('#stepTitle').textContent",
  );
  check(
    'a key step shows its shortcut in a chip, like the tip',
    keyed.key === '⌃S' && keyed.title === 'Press ⌃S on "Search"',
    `chip ${keyed.key}, title "${keyed.title}"`,
  );

  await evaluate("document.querySelector('#remove').click()");
  await settle();
  check('removing the step reaches the host', commands.includes('deleteStep'), `commands: ${commands.join(', ')}`);

  overlay.run('narration:start');
  await settle();
  check(
    'turning narration on reaches the host and keeps recording',
    commands.includes('narration:start') && overlay.state === CaptureState.RECORDING,
    `state ${overlay.state}, commands: ${commands.join(', ')}`,
  );

  overlay.setNarration({ level: 0.8, speaking: true });
  await settle();
  const narrating = await card(
    "shown: !document.querySelector('#voice').hidden, text: document.querySelector('#voice').textContent, height: document.body.scrollHeight",
  );
  overlay.setNarration(null);
  await settle();
  const quiet = await card("shown: !document.querySelector('#voice').hidden, height: document.body.scrollHeight");
  check(
    'narrating shows the meter, and it goes when narration stops',
    narrating.shown === true && String(narrating.text).includes('Hearing you') && quiet.shown === false,
    `while narrating: ${narrating.text} (${narrating.height}px); after: shown ${quiet.shown} (${quiet.height}px)`,
  );

  overlay.setBusy(true);
  await settle();
  const whileBusy = await windowWithHash('controls')?.webContents.executeJavaScript(
    "document.querySelector('#primary').disabled",
  );
  const veil = await card(
    "text: document.querySelector('#printing').textContent, printer: !document.querySelector('#printer').hidden, remove: document.querySelector('#remove').hidden, shot: getComputedStyle(document.querySelector('#preview')).visibility, height: document.body.scrollHeight",
  );
  overlay.setProgress(60, 0);
  await settle();
  const printed = await card("percent: getComputedStyle(document.querySelector('#printer')).getPropertyValue('--p').trim()");
  check(
    'a capture in flight prints the photo at the reported percentage, over the last screenshot',
    veil.text === 'Capturing step 2' &&
      veil.printer === true &&
      veil.remove === true &&
      veil.shot === 'hidden' &&
      printed.percent === '60',
    `${veil.text}, printer shown: ${veil.printer}, remove hidden: ${veil.remove}, last screenshot: ${veil.shot}, count: ${printed.percent}%`,
  );
  const unaimed = await card("aim: !document.querySelector('#aim').hidden, developing: document.querySelector('#photo').classList.contains('developing')");
  overlay.setPrint({ aim: { x: 0.25, y: 0.5, aspect: 2 } });
  overlay.setPrint({ src });
  await settle();
  const aimed = await card(
    "aim: !document.querySelector('#aim').hidden, left: document.querySelector('#aim').style.left, developing: document.querySelector('#photo').classList.contains('developing'), src: document.querySelector('#photo img').getAttribute('src')",
  );
  check(
    'the photo marks where the click was, and shows the screenshot once it is saved',
    unaimed.aim === false &&
      unaimed.developing === false &&
      aimed.aim === true &&
      aimed.left !== '' &&
      aimed.developing === true &&
      aimed.src === src,
    `before: marker ${unaimed.aim}, developing ${unaimed.developing}; after: marker ${aimed.aim} at ${aimed.left}, developing ${aimed.developing}`,
  );
  overlay.showStep({ id: 'two', number: 2, title: 'Click "Open"', action: 'click', src, source: 'heuristic', pending: true, app: 'Explorer' });
  overlay.setBusy(false);
  await settle();
  const describing = await card(
    "printer: !document.querySelector('#printer').hidden, title: getComputedStyle(document.querySelector('#stepTitle')).visibility",
  );
  overlay.showStep({ id: 'two', number: 2, title: 'Open the file', action: 'click', src, source: 'ai', pending: false, app: 'Explorer' });
  await new Promise((resolve) => setTimeout(resolve, 900));
  await settle();
  const aiLanded = await card(
    "printer: !document.querySelector('#printer').hidden, title: document.querySelector('#stepTitle').textContent, source: document.querySelector('#source').textContent",
  );
  check(
    'the printer waits for the AI description, and the step lands with it',
    describing.printer === true &&
      describing.title === 'hidden' &&
      aiLanded.printer === false &&
      aiLanded.title === 'Open the file' &&
      aiLanded.source === 'AI',
    `while describing: printer ${describing.printer}, title ${describing.title}; landed: printer ${aiLanded.printer}, ${aiLanded.source} "${aiLanded.title}"`,
  );
  const shortTitle = await card("height: document.body.scrollHeight, preview: document.querySelector('#preview').offsetHeight");
  overlay.showStep({ id: 'one', number: 1, title: 'Click '.repeat(40), action: 'click', src, source: 'ai', pending: false, app: 'Explorer' });
  await settle();
  const longTitle = await card("height: document.body.scrollHeight, preview: document.querySelector('#preview').offsetHeight");
  overlay.showStep({ id: 'one', number: 1, title: 'Save the file', action: 'click', src, source: 'ai', pending: false, app: 'Explorer' });
  await settle();
  check(
    'the card keeps its height when a step lands, and a long title takes it from the screenshot',
    shortTitle.height === veil.height && longTitle.height === veil.height && longTitle.preview < shortTitle.preview,
    `${veil.height} px while capturing, ${shortTitle.height} px with a short title, ${longTitle.height} px with a long one, preview ${shortTitle.preview} → ${longTitle.preview} px`,
  );
  overlay.setAiFailure({ reason: 'rejected', provider: 'openai' });
  await settle();
  const failed = await card(
    "shown: !document.querySelector('#aiNotice').hidden, text: document.querySelector('#aiNotice').textContent",
  );
  overlay.setAiFailure(null);
  await settle();
  const cleared = await card("shown: !document.querySelector('#aiNotice').hidden");
  check(
    'a failed AI description says why, in the extension words',
    failed.shown === true && String(failed.text).includes('OpenAI') && cleared.shown === false,
    `notice: ${failed.text}; after clearing shown: ${cleared.shown}`,
  );
  const whenIdle = await windowWithHash('controls')?.webContents.executeJavaScript(
    "document.querySelector('#primary').disabled",
  );
  const order = await windowWithHash('controls')?.webContents.executeJavaScript(
    "JSON.stringify([...document.querySelectorAll('#foot button')].map((b) => b.id + ':' + b.textContent.trim()))",
  );
  check(
    'Finish leads the footer, with the mic, Pause and Discard after it',
    /^\["primary:Finish recording","mic:","secondary:","discard:"\]$/.test(String(order)),
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

  const editorWindows = () => webContents.getAllWebContents().filter((wc) => wc.getURL().includes('#editor'));
  const inEditor = (script: string) => editorWindows()[0]?.executeJavaScript(script);
  const pickArea = () =>
    windowWithHash('controls')?.webContents.executeJavaScript("document.querySelector('button.mode[data-mode=\"area\"]').click()");
  pause();
  await settle();
  await pickArea();
  await settle();
  const opened = { state: overlay.isEditing ? 'editor' : overlay.state, editors: editorWindows().length, sent: commands.at(-1) };
  const look = JSON.parse(
    String(
      (await inEditor(
        "JSON.stringify({ buttons: [...document.querySelectorAll('#bar button')].map((b) => b.textContent.trim()), edge: getComputedStyle(document.querySelector('#region'), '::after').borderTopStyle, corner: getComputedStyle(document.querySelector('.handle[data-handle=\"nw\"]')).borderTopColor })",
      )) ?? '{}',
    ),
  ) as { buttons?: string[]; edge?: string; corner?: string };
  await inEditor("document.querySelector('#bar button.secondary').click()");
  await settle();
  const cancelled = { state: overlay.isEditing ? 'editor' : overlay.state, editors: editorWindows().length, sent: commands.at(-1) };
  await pickArea();
  await settle();
  await inEditor("document.querySelector('#bar button.primary').click()");
  await settle();
  const confirmed = { state: overlay.isEditing ? 'editor' : overlay.state, editors: editorWindows().length, sent: commands.at(-1) };
  check(
    'picking Area while paused opens the editor, Done resumes and Cancel stays paused',
    opened.state === 'editor' &&
      opened.editors === displays.length &&
      opened.sent === 'mode:area' &&
      cancelled.state === CaptureState.PAUSED &&
      cancelled.editors === 0 &&
      cancelled.sent === 'mode:screen' &&
      confirmed.state === CaptureState.RECORDING &&
      confirmed.editors === 0 &&
      confirmed.sent === 'resume',
    `opened ${JSON.stringify(opened)}, cancel ${JSON.stringify(cancelled)}, done ${JSON.stringify(confirmed)}`,
  );
  check(
    'the area editor uses the action bar and the crop frame',
    look.buttons?.join('|') === 'CancelEsc|DoneEnter' && look.edge === 'dashed' && look.corner === 'rgb(79, 70, 229)',
    `buttons ${look.buttons?.join(', ')}, edge ${look.edge}, corner ${look.corner}`,
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

  overlay.reset();
  overlay.destroy();
  saveRegion(defaultRegion());

  const splash = new BrowserWindow({ width: 400, height: 300, show: false, frame: false });
  await splash.loadFile(join(__dirname, '../renderer/splash.html'));
  const splashed = JSON.parse(
    String(
      await splash.webContents.executeJavaScript(
        "JSON.stringify({ word: document.querySelector('#wordmark')?.textContent, paths: document.querySelectorAll('#mascot svg path').length, meter: Boolean(document.querySelector('#meter span')) })",
      ),
    ),
  ) as { word?: string; paths?: number; meter?: boolean };
  splash.destroy();
  check(
    'the loading screen draws the mascot, the name and the bar',
    splashed.word === 'Mimik' && (splashed.paths ?? 0) >= 5 && splashed.meter === true,
    `wordmark ${splashed.word}, ${splashed.paths} mascot paths, bar ${splashed.meter}`,
  );

  for (const result of results) {
    process.stdout.write(`${result.ok ? 'ok  ' : 'FAIL'} ${result.name.padEnd(32)} ${result.detail}\n`);
  }
  const failures = results.filter((r) => !r.ok).length;
  process.stdout.write(`\n${failures === 0 ? 'capture area and controls behave' : `${failures} failure(s)`}\n`);
  app.exit(failures === 0 ? 0 : 1);
}).catch(bail);
