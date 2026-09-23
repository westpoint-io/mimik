import { icon } from '../icons';
import { el } from './el';
import { mascot } from './mascot';
import type { Region } from './types';

interface LastStep {
  index: number;
  title: string;
  src: string;
}

const MODES = [
  { id: 'window', label: 'Window' },
  { id: 'screen', label: 'Screen' },
  { id: 'area', label: 'Area' },
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
  const collapse = el('button', { id: 'collapse', type: 'button', title: 'Collapse' });
  collapse.append(icon('chevronDown'));
  const head = el('div', { id: 'head' }, dot, label, counter, badge, collapse);

  const shot = el('img', { id: 'shot', alt: '' });
  const preview = el('div', { id: 'preview' }, shot);
  const stepTitle = el('p', { id: 'stepTitle' });
  const stepMeta = el('p', { id: 'stepMeta' });
  const tip = el('p', { id: 'tip' });
  const intro = el('div', { id: 'intro' }, el('div', { id: 'mascot' }, mascot()), tip);
  const body = el('div', { id: 'body' }, preview, stepTitle, stepMeta, intro);

  const modeLabel = el('p', { id: 'modeLabel' }, 'Capture mode');
  const modeRow = el('div', { id: 'modes' });
  const modeButtons = MODES.map(({ id, label: text }) => {
    const button = el('button', { type: 'button', className: 'mode' }, text);
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

  const render = (state: string, _region?: Region, last?: LastStep | null, mode?: string, busy = false) => {
    const armed = state === 'armed';
    document.body.setAttribute('data-state', state);
    document.body.classList.toggle('collapsed', collapsed);

    label.textContent = state === 'recording' ? 'Recording' : state === 'paused' ? 'Paused' : 'Ready';
    counter.textContent = last ? String(last.index) : '';
    counter.hidden = !last;
    badge.textContent = mode === 'screen' ? 'Screen' : mode === 'region' ? 'Area' : 'Window';
    badge.hidden = state !== 'armed';

    const chevron = collapsed ? 'up' : 'down';
    if (chevron !== shownChevron) {
      shownChevron = chevron;
      collapse.replaceChildren(icon(collapsed ? 'chevronUp' : 'chevronDown'));
    }
    collapse.title = collapsed ? 'Expand' : 'Collapse';

    if (last) {
      if (shot.getAttribute('src') !== last.src) shot.src = last.src;
      stepTitle.textContent = last.title;
      stepMeta.textContent = `Step ${last.index}`;
    }
    preview.hidden = !last;
    stepTitle.hidden = !last;
    stepMeta.hidden = !last;
    tip.textContent = armed
      ? 'Press Start, then work as you normally would. Every click becomes a step.'
      : 'Waiting for your first click.';
    intro.hidden = Boolean(last) || state === 'paused';
    body.hidden = collapsed || (state === 'paused' && !last);

    modes.hidden = collapsed || state !== 'paused';
    for (const button of modeButtons) button.classList.toggle('active', button.dataset.mode === MODE_ID[mode ?? '']);

    if (state !== shownIcon) {
      shownIcon = state;
      secondary.replaceChildren();
      if (!armed) secondary.append(icon(state === 'recording' ? 'pause' : 'play'));
      secondary.append(armed ? 'Close' : state === 'recording' ? 'Pause' : 'Resume');
      primary.replaceChildren(icon(armed ? 'video' : 'check'));
      primary.append(armed ? 'Start' : 'Finish');
    }
    secondary.dataset.command = armed ? 'cancel' : state === 'recording' ? 'pause' : 'resume';
    primary.dataset.command = armed ? 'start' : 'stop';
    primary.disabled = busy && !armed;
    foot.hidden = collapsed;

    requestAnimationFrame(report);
  };

  let latest: [string, Region | undefined, LastStep | null | undefined, string | undefined, boolean] = [
    'armed',
    undefined,
    null,
    undefined,
    false,
  ];
  const paint = () => render(...latest);

  primary.addEventListener('click', () => window.mimikOverlay.command(primary.dataset.command ?? 'start'));
  secondary.addEventListener('click', () => window.mimikOverlay.command(secondary.dataset.command ?? 'cancel'));
  collapse.addEventListener('click', () => {
    collapsed = !collapsed;
    paint();
  });
  shot.addEventListener('load', report);

  Promise.all([
    window.mimikOverlay.state(),
    window.mimikOverlay.last(),
    window.mimikOverlay.mode(),
    window.mimikOverlay.busy(),
  ]).then(([state, last, mode, busy]) => {
    latest = [state, undefined, last, mode, busy];
    paint();
  });
  window.mimikOverlay.onUpdate((state, region, last, mode, busy) => {
    latest = [state, region, last, mode, busy];
    paint();
  });
}
