import type { OverlayView } from '../../main/overlay';
import { icon } from '../icons';
import { cameraMascot } from './camera-mascot';
import { el } from './el';

const MODES = [
  { id: 'window', label: 'Window', glyph: 'window' },
  { id: 'screen', label: 'Screen', glyph: 'monitor' },
  { id: 'area', label: 'Area', glyph: 'area' },
] as const;

const MODE_COMMAND: Record<string, string> = {
  window: 'mode:window',
  screen: 'mode:screen',
  area: 'mode:region',
};

const MODE_ID: Record<string, string> = { window: 'window', screen: 'screen', region: 'area' };

export function controls(): void {
  document.body.className = 'controls';

  let collapsed = false;

  const dot = el('span', { id: 'dot' });
  const label = el('span', { id: 'label' }, 'Ready');
  const counter = el('span', { id: 'counter' });
  const badge = el('span', { id: 'badge' });
  const pillWriting = el('span', { id: 'pillWriting' }, icon('loader', 12), 'writing');
  const collapse = el('button', { id: 'collapse', type: 'button', title: 'Collapse' });
  collapse.append(icon('chevronDown'));
  const head = el('div', { id: 'head' }, dot, label, counter, badge, pillWriting, collapse);

  const shot = el('img', { id: 'shot', alt: '' });
  const veilText = el('span', { id: 'veilText' });
  const veilMascot = el('div', { id: 'veilMascot' }, cameraMascot(56));
  const veilPause = el('span', { id: 'veilPause' }, icon('pause', 16));
  const veil = el('div', { id: 'veil' }, veilMascot, veilPause, veilText);
  const remove = el('button', { id: 'remove', type: 'button', title: 'Remove this step' });
  remove.setAttribute('aria-label', 'Remove this step');
  remove.append(icon('trash', 13));
  const preview = el('div', { id: 'preview' }, shot, veil, remove);

  const stepTitle = el('p', { id: 'stepTitle' });
  const writing = el('p', { id: 'writing' }, icon('loader', 13), 'Writing step description…');
  const skeleton = el(
    'div',
    { id: 'skeleton' },
    el('p', { className: 'line' }, el('span', {}), '\u00a0'),
    el('div', { className: 'meta' }, el('span', {}), '\u00a0'),
  );
  const source = el('span', { id: 'source' });
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
  const body = el('div', { id: 'body' }, preview, stepTitle, writing, skeleton, stepMeta, intro, hint);

  const modeLabel = el('p', { id: 'modeLabel' }, 'Capture mode');
  const modeRow = el('div', { id: 'modes' });
  const modeButtons = MODES.map(({ id, label: text, glyph }) => {
    const button = el('button', { type: 'button', className: 'mode' }, icon(glyph, 13), text);
    button.dataset.mode = id;
    button.addEventListener('click', () => window.mimikOverlay.command(MODE_COMMAND[id]));
    modeRow.append(button);
    return button;
  });
  const modes = el('div', { id: 'modeBlock' }, modeLabel, modeRow);

  const secondary = el('button', { id: 'secondary', type: 'button' });
  const primary = el('button', { id: 'primary', type: 'button', className: 'primary' });
  const foot = el('div', { id: 'foot' }, secondary, primary);

  document.body.append(head, body, modes, foot);

  const report = () => window.mimikOverlay.size(document.body.scrollWidth, document.body.scrollHeight);

  let shownIcon = '';
  let shownChevron = '';
  let shownMode = '';

  const render = (view: OverlayView) => {
    const { state, step, busy, starting, mode, shortcuts } = view;
    const armed = state === 'armed';
    const recording = state === 'recording';
    const paused = state === 'paused';
    const waiting = recording && !step && !busy;
    const resting = paused && !step && !busy;
    const pending = Boolean(step?.pending);

    document.body.setAttribute('data-state', state);
    document.body.classList.toggle('collapsed', collapsed);
    document.body.classList.toggle('waiting', waiting || resting);
    document.body.classList.toggle('resting', resting);
    document.body.classList.toggle('busy', busy);

    label.textContent = starting ? 'Starting…' : recording ? 'Recording' : paused ? 'Paused' : 'Ready';
    const count = step?.index ?? 0;
    counter.textContent = `${count} ${count === 1 ? 'step' : 'steps'}`;
    counter.hidden = armed;

    const modeId = MODE_ID[mode] ?? 'window';
    if (modeId !== shownMode) {
      shownMode = modeId;
      const shown = MODES.find((candidate) => candidate.id === modeId) ?? MODES[0];
      badge.replaceChildren(icon(shown.glyph, 12), shown.label);
    }
    badge.hidden = paused || collapsed;
    pillWriting.hidden = !(collapsed && pending);

    const chevron = collapsed ? 'up' : 'down';
    if (chevron !== shownChevron) {
      shownChevron = chevron;
      collapse.replaceChildren(icon(collapsed ? 'chevronUp' : 'chevronDown'));
    }
    collapse.title = collapsed ? 'Expand' : 'Collapse';

    if (step && shot.getAttribute('src') !== step.src) shot.src = step.src;
    preview.hidden = armed || !(busy || step);
    shot.hidden = !step || busy;
    veil.hidden = !(busy || paused);
    veilMascot.hidden = !busy;
    veilPause.hidden = busy || !paused;
    veilText.hidden = !busy;
    veilText.textContent = `Capturing step ${count + 1}…`;
    remove.hidden = !step || busy || armed;

    const settled = Boolean(step) && !busy && !paused;
    stepTitle.textContent = step?.title ?? '';
    stepTitle.hidden = !settled || pending;
    const extra = stepTitle.getBoundingClientRect().height - Number.parseFloat(getComputedStyle(stepTitle).lineHeight);
    preview.style.setProperty('--title-extra', `${stepTitle.hidden ? 0 : Math.max(0, extra)}px`);
    writing.hidden = !settled || !pending;
    skeleton.hidden = !busy;
    stepMeta.hidden = !settled;
    source.hidden = pending;
    source.textContent = step?.source === 'ai' ? 'AI' : 'Basic';
    source.className = step?.source === 'ai' ? 'ai' : 'basic';
    metaText.textContent = [step ? `Step ${step.index}` : '', step?.app ?? ''].filter(Boolean).join(' · ');

    intro.hidden = !(armed || waiting || resting);
    tip.textContent = armed
      ? 'Each click is saved as a step.'
      : resting
        ? 'Nothing is recorded while paused.'
        : 'Your first click will show up here.';
    const key = armed ? shortcuts.startStop : shortcuts.capture;
    hint.hidden = intro.hidden || resting || !key;
    hintKey.textContent = key ?? '';
    hintText.textContent = armed ? ' to start and stop.' : ' to capture without clicking.';
    body.hidden = collapsed;

    modes.hidden = collapsed || !paused;
    for (const button of modeButtons) button.classList.toggle('active', button.dataset.mode === modeId);

    if (state !== shownIcon) {
      shownIcon = state;
      secondary.replaceChildren();
      if (!armed) secondary.append(icon(recording ? 'pause' : 'play'));
      secondary.append(armed ? 'Close' : recording ? 'Pause' : 'Resume');
      primary.replaceChildren(icon(armed ? 'video' : 'check'));
      primary.append(armed ? 'Start' : 'Finish');
    }
    secondary.dataset.command = armed ? 'cancel' : recording ? 'pause' : 'resume';
    primary.dataset.command = armed ? 'start' : 'stop';
    primary.disabled = starting || (busy && !armed);
    foot.hidden = collapsed;

    requestAnimationFrame(report);
  };

  let latest: OverlayView | null = null;
  const paint = () => {
    if (latest) render(latest);
  };

  primary.addEventListener('click', () => window.mimikOverlay.command(primary.dataset.command ?? 'start'));
  secondary.addEventListener('click', () => window.mimikOverlay.command(secondary.dataset.command ?? 'cancel'));
  remove.addEventListener('click', () => window.mimikOverlay.command('remove'));
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
