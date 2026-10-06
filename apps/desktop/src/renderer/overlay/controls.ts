import { aiFailureNotice } from '@mimik/core/capture/ai/errors';
import { splitAtShortcut } from '@mimik/core/capture/split-at-shortcut';
import { hasVoiceApiKey, VOICE_KEY_SETTINGS } from '@mimik/core/capture/voice/api-key';
import { i18n, localStorage } from '@mimik/core/env';
import type { OverlayView } from '../../main/overlay';
import { icon } from '../icons';
import { cameraMascot } from './camera-mascot';
import { el } from './el';

const MODES = [
  { id: 'window', label: 'desktop_modeWindow', glyph: 'window' },
  { id: 'screen', label: 'desktop_modeScreen', glyph: 'monitor' },
  { id: 'area', label: 'desktop_modeRegion', glyph: 'area' },
] as const;

const MODE_COMMAND: Record<string, string> = {
  window: 'mode:window',
  screen: 'mode:screen',
  area: 'mode:region',
};

const MODE_ID: Record<string, string> = { window: 'window', screen: 'screen', region: 'area' };

const AI_WAIT_MS = 8000;

const VOICE_BARS = [0.45, 0.75, 1, 0.75, 0.45];
const VOICE_BAR_FLOOR = 0.14;

export function controls(): void {
  document.body.className = 'controls';

  let collapsed = false;

  const dot = el('span', { id: 'dot' });
  const label = el('span', { id: 'label' }, 'Ready');
  const counter = el('span', { id: 'counter' });
  const badge = el('span', { id: 'badge' });
  const collapse = el('button', { id: 'collapse', type: 'button', title: 'Collapse' });
  collapse.append(icon('chevronDown'));
  const head = el('div', { id: 'head' }, dot, label, counter, badge, collapse);

  const shot = el('img', { id: 'shot', alt: '' });
  const veilPause = el('span', { id: 'veilPause' }, icon('pause', 16));
  const veil = el('div', { id: 'veil' }, veilPause);
  const remove = el('button', { id: 'remove', type: 'button', title: i18n.t('recording_deleteStep') });
  remove.setAttribute('aria-label', i18n.t('recording_deleteStep'));
  remove.append(icon('trash', 13));
  const preview = el('div', { id: 'preview' }, shot, veil, remove);

  const stepTitle = el('p', { id: 'stepTitle' });
  const source = el('span', { id: 'source', title: i18n.t('stepSource_hint') });
  const metaText = el('span', { id: 'metaText' });
  const stepMeta = el('div', { id: 'stepMeta' }, source, metaText);

  const tip = el('p', { id: 'tip' });
  const hintKey = el('kbd', { id: 'hintKey' });
  const hintText = el('span', {});
  const hint = el(
    'div',
    { id: 'keyHint' },
    icon('keyboard', 14),
    el('p', {}, el('strong', {}, 'Tip:'), ' you can press ', hintKey, hintText),
  );
  const intro = el('div', { id: 'intro' }, el('div', { id: 'mascot' }, cameraMascot(56)), tip);
  const filmShot = el('img', { alt: '' });
  const aim = el('span', { id: 'aim' }, icon('pointer', 10));
  const film = el('span', { className: 'film' }, filmShot, aim);
  const photo = el('span', { id: 'photo' }, film);
  const printing = el('span', { id: 'printing' });
  const printer = el(
    'div',
    { id: 'printer' },
    el(
      'div',
      { id: 'camera' },
      photo,
      el('span', { id: 'printerMascot' }, cameraMascot(84)),
      el('span', { id: 'slot' }),
    ),
    el('span', { id: 'printerCaption' }, printing, ' · ', el('span', { id: 'percent' })),
  );
  const flyerShot = el('img', { alt: '' });
  const flyer = el('div', { id: 'flyer' }, flyerShot);
  const stage = el('div', { id: 'stage' }, preview, stepTitle, stepMeta, printer, flyer);
  const voiceBars = el('span', { id: 'voiceBars' });
  const bars = VOICE_BARS.map(() => voiceBars.appendChild(el('i', {})));
  const voiceLabel = el('strong', {});
  const voiceHint = el('p', { id: 'voiceHint' }, i18n.t('voice_orderHint'));
  const voice = el(
    'div',
    { id: 'voice', role: 'status' },
    el('div', { id: 'voiceLine' }, voiceBars, voiceLabel),
    voiceHint,
  );
  const body = el('div', { id: 'body' }, stage, intro, hint, voice);

  const modeLabel = el('p', { id: 'modeLabel' }, i18n.t('desktop_captureMode'));
  const modeRow = el('div', { id: 'modes' });
  const modeButtons = MODES.map(({ id, label: text, glyph }) => {
    const button = el('button', { type: 'button', className: 'mode' }, icon(glyph, 13), i18n.t(text));
    button.dataset.mode = id;
    button.addEventListener('click', () => window.mimikOverlay.command(MODE_COMMAND[id]));
    modeRow.append(button);
    return button;
  });
  const modes = el('div', { id: 'modeBlock' }, modeLabel, modeRow);

  const aiHeadline = el('strong', {});
  const aiAction = el('span', {});
  const aiNotice = el(
    'div',
    { id: 'aiNotice', role: 'status' },
    icon('alert', 13),
    el('p', {}, aiHeadline, ' ', aiAction),
  );

  const secondary = el('button', { id: 'secondary', type: 'button' });
  const primary = el('button', { id: 'primary', type: 'button', className: 'primary' });
  const mic = el('button', { id: 'mic', type: 'button' });
  const foot = el('div', { id: 'foot' }, primary, mic, secondary);

  document.body.append(head, body, modes, aiNotice, foot);

  const report = () => window.mimikOverlay.size(document.body.scrollWidth, document.body.scrollHeight);

  let micOn = false;
  let micKeyed = false;
  let shownMic = '';
  let shownIcon = '';
  let shownChevron = '';
  let shownMode = '';
  let wasBusy = false;
  let printingStep = false;
  let aiWait: ReturnType<typeof setTimeout> | null = null;
  let gaveUp: string | null = null;
  let landing = false;
  let landedId: string | null = null;
  let printingIndex = 1;
  let shownPercent = 0;

  const resetPercent = () => {
    printer.style.transition = 'none';
    printer.style.setProperty('--p', '0');
    void printer.offsetWidth;
    shownPercent = 0;
  };

  const setPercent = (percent: number, ms: number) => {
    if (percent <= shownPercent) return;
    printer.style.transition = `--p ${ms}ms cubic-bezier(.2,.7,.3,1)`;
    printer.style.setProperty('--p', String(percent));
    shownPercent = percent;
  };

  const rectIn = (node: Element) => {
    const outer = stage.getBoundingClientRect();
    const inner = node.getBoundingClientRect();
    return {
      left: `${inner.left - outer.left}px`,
      top: `${inner.top - outer.top}px`,
      width: `${inner.width}px`,
      height: `${inner.height}px`,
    };
  };

  const render = (view: OverlayView) => {
    const { state, step, busy, progress, print, starting, mode, shortcuts, aiFailure, narration } = view;
    const armed = state === 'ARMED';
    const recording = state === 'RECORDING';
    const paused = state === 'PAUSED';
    const waiting = recording && !step && !busy;
    const resting = paused && !step && !busy;

    if (busy && !wasBusy) {
      printingIndex = (step?.index ?? 0) + 1;
      if (step) landedId = step.id;
      resetPercent();
      printingStep = true;
    }
    wasBusy = busy;
    const printed = step && step.index >= printingIndex ? step : null;
    const developed = printed?.src ?? print.src;
    if (printingStep && developed && filmShot.getAttribute('src') !== developed) filmShot.src = developed;
    photo.classList.toggle('developing', Boolean(printingStep && developed));
    const describing = printingStep && !busy && printed?.pending === true && gaveUp !== printed.id;
    if (describing && !aiWait) {
      const waited = printed.id;
      aiWait = setTimeout(() => {
        gaveUp = waited;
        aiWait = null;
        paint();
      }, AI_WAIT_MS);
    }
    if (printingStep) setPercent(progress.percent, progress.ms);
    if (printingStep && !busy && !describing) {
      printingStep = false;
      if (aiWait) clearTimeout(aiWait);
      aiWait = null;
      if (printed?.src && printed.id !== landedId) land(printed.src, printed.id);
    }
    if (!printingStep && !landing) landedId = step?.id ?? null;
    const capturing = printingStep || landing;

    document.body.setAttribute('data-state', state);
    document.body.classList.toggle('collapsed', collapsed);
    document.body.classList.toggle('waiting', waiting || resting);
    document.body.classList.toggle('resting', resting);
    document.body.classList.toggle('busy', busy);

    const count = capturing ? printingIndex - 1 : (step?.index ?? 0);
    const counted = [String(count)];
    label.textContent = starting
      ? 'Starting…'
      : recording
        ? i18n.t(count === 1 ? 'recording_recording' : 'recording_recordingPlural', counted)
        : paused
          ? i18n.t('recording_capturePaused')
          : i18n.t('desktop_ready');
    counter.textContent = i18n.t(count === 1 ? 'fullview_stepCount' : 'fullview_stepCountPlural', counted);
    counter.hidden = !paused;

    const modeId = MODE_ID[mode] ?? 'window';
    if (modeId !== shownMode) {
      shownMode = modeId;
      const shown = MODES.find((candidate) => candidate.id === modeId) ?? MODES[0];
      badge.replaceChildren(icon(shown.glyph, 12), i18n.t(shown.label));
    }
    badge.hidden = paused || collapsed;

    const micLocked = !micKeyed && !micOn;
    const micState = micOn ? 'on' : micLocked ? 'locked' : 'off';
    if (micState !== shownMic) {
      shownMic = micState;
      const micLabel = i18n.t(micLocked ? 'voice_needsApiKey' : micOn ? 'voice_turnOff' : 'voice_turnOn');
      mic.className = micState;
      mic.title = micLabel;
      mic.setAttribute('aria-label', micLabel);
      mic.setAttribute('aria-pressed', String(micOn));
      mic.replaceChildren(icon(micOn ? 'mic' : 'micOff', 16));
    }

    const chevron = collapsed ? 'up' : 'down';
    if (chevron !== shownChevron) {
      shownChevron = chevron;
      collapse.replaceChildren(icon(collapsed ? 'chevronUp' : 'chevronDown'));
    }
    collapse.title = collapsed ? 'Expand' : 'Collapse';

    if (step && !capturing && shot.getAttribute('src') !== step.src) shot.src = step.src;
    stage.hidden = armed || !(capturing || step);
    stage.classList.toggle('capturing', capturing);
    printer.hidden = !capturing;
    const aimed = printingStep ? print.aim : null;
    aim.hidden = !aimed || aimed.x < 0 || aimed.x > 1 || aimed.y < 0 || aimed.y > 1;
    if (aimed && !aim.hidden) {
      const width = film.clientWidth;
      const height = film.clientHeight;
      const shownWidth = Math.max(width, height * aimed.aspect);
      const shownHeight = Math.max(height, width / aimed.aspect);
      aim.style.left = `${(width - shownWidth) / 2 + aimed.x * shownWidth}px`;
      aim.style.top = `${(height - shownHeight) / 2 + aimed.y * shownHeight}px`;
    }
    printing.textContent = `Capturing step ${printingIndex}`;
    shot.hidden = !step?.src;
    veil.hidden = !paused || capturing;
    remove.hidden = !step || capturing || armed;

    const title = step?.title ?? '\u00a0';
    const split = splitAtShortcut(title, step?.action);
    if (split) stepTitle.replaceChildren(split[0], el('kbd', {}, split[1]), split[2]);
    else stepTitle.textContent = title;
    const extra = stepTitle.getBoundingClientRect().height - Number.parseFloat(getComputedStyle(stepTitle).lineHeight);
    preview.style.setProperty('--title-extra', `${step ? Math.max(0, extra) : 0}px`);
    source.hidden = !step;
    const sourceKind = step?.source === 'ai' ? 'ai' : step?.source === 'narration' ? 'voice' : 'basic';
    source.textContent = i18n.t(`stepSource_${sourceKind}`);
    source.className = sourceKind;
    metaText.textContent =
      [step ? i18n.t('export_stepLabel', [String(step.index)]) : '', step?.app ?? ''].filter(Boolean).join(' · ') ||
      '\u00a0';

    intro.hidden = !(armed || waiting || resting);
    tip.textContent = armed
      ? 'Each click is saved as a step.'
      : resting
        ? 'Nothing is recorded while paused.'
        : 'Your first click will show up here.';
    const key = armed ? shortcuts.startStop : shortcuts.capture;
    hint.hidden = intro.hidden || resting || !key || Boolean(narration);
    voice.hidden = collapsed || !narration;
    voiceHint.hidden = intro.hidden;
    voiceBars.classList.toggle('speaking', narration?.speaking === true);
    voiceLabel.textContent = i18n.t(narration?.speaking ? 'voice_micHearing' : 'voice_micQuiet');
    bars.forEach((bar, index) => {
      const scale = Math.max(VOICE_BAR_FLOOR, Math.min(1, (narration?.level ?? 0) * VOICE_BARS[index]));
      bar.style.transform = `scaleY(${scale})`;
    });
    hintKey.textContent = key ?? '';
    hintText.textContent = armed ? ' to start and stop.' : ' to capture without clicking.';
    body.hidden = collapsed;

    modes.hidden = collapsed || !paused;
    for (const button of modeButtons) button.classList.toggle('active', button.dataset.mode === modeId);

    if (state !== shownIcon) {
      shownIcon = state;
      const secondaryLabel = i18n.t(armed ? 'common_close' : recording ? 'desktop_pause' : 'desktop_resume');
      secondary.replaceChildren(icon(armed ? 'close' : recording ? 'pause' : 'play', 16));
      secondary.title = secondaryLabel;
      secondary.setAttribute('aria-label', secondaryLabel);
      primary.replaceChildren(icon(armed ? 'video' : 'check'));
      primary.append(i18n.t(armed ? 'desktop_startButton' : 'desktop_finish'));
    }
    secondary.dataset.command = armed ? 'disarm' : recording ? 'pause' : 'resume';
    primary.dataset.command = armed ? 'start' : 'stop';
    primary.disabled = starting || (busy && !armed);
    foot.hidden = collapsed;

    aiNotice.hidden = collapsed || armed || !aiFailure;
    if (aiFailure) {
      const notice = aiFailureNotice(aiFailure.reason, aiFailure.provider);
      aiHeadline.textContent = notice.headline;
      aiAction.textContent = notice.action;
    }

    requestAnimationFrame(report);
  };

  let latest: OverlayView | null = null;
  const paint = () => {
    if (latest) render(latest);
  };

  function land(src: string, id: string): void {
    landedId = id;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    landing = true;
    setPercent(100, 150);
    flyerShot.src = src;
    const from = { ...rectIn(photo), borderRadius: '3px', padding: '4px 4px 10px', backgroundColor: '#ffffff' };
    const to = { ...rectIn(preview), borderRadius: '10px', padding: '0px', backgroundColor: '#eef2ff' };
    Object.assign(flyer.style, from);
    flyer.hidden = false;
    printer.classList.add('fired');
    const fade = printer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: 220, fill: 'forwards' });
    const grow = flyer.animate([from, to], {
      duration: 420,
      delay: 180,
      easing: 'cubic-bezier(.3,.7,.3,1)',
      fill: 'forwards',
    });
    grow.finished.then(() => {
      landing = false;
      flyer.hidden = true;
      grow.cancel();
      fade.cancel();
      printer.classList.remove('fired');
      stage.classList.add('arrived');
      setTimeout(() => stage.classList.remove('arrived'), 320);
      paint();
    });
  }

  primary.addEventListener('click', () => window.mimikOverlay.command(primary.dataset.command ?? 'start'));
  secondary.addEventListener('click', () => window.mimikOverlay.command(secondary.dataset.command ?? 'disarm'));
  remove.addEventListener('click', () => window.mimikOverlay.command('deleteStep'));
  mic.addEventListener('click', () => {
    if (shownMic !== 'locked') window.mimikOverlay.command(micOn ? 'narration:stop' : 'narration:start');
  });
  const readMic = () =>
    localStorage.get([...VOICE_KEY_SETTINGS, 'voiceEnabled']).then((stored) => {
      micOn = stored.voiceEnabled === true;
      micKeyed = hasVoiceApiKey(stored);
      paint();
    });
  void readMic();
  window.addEventListener('storage', () => void readMic());
  collapse.addEventListener('click', () => {
    collapsed = !collapsed;
    paint();
  });
  shot.addEventListener('load', report);

  window.mimikOverlay.view().then((view) => {
    latest = latest ?? view;
    paint();
  });
  window.mimikOverlay.onUpdate((view) => {
    latest = view;
    paint();
  });
}
