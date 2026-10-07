import {
  MASCOT_ASPECT,
  MASCOT_BODY,
  MASCOT_CROWN,
  MASCOT_CROWN_SPLIT,
  MASCOT_FACES,
  MASCOT_SEAM,
  MASCOT_VIEW_BOX,
} from '@mimik/ui/shared/mascot-shapes';
import { icon } from './icons';
import './overlay.css';

interface LastStep {
  index: number;
  title: string;
  src: string;
}

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN = { width: 240, height: 160 };
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = (typeof HANDLES)[number];

const [role, originX, originY] = window.location.hash.slice(1).split(':');
const origin = { x: Number(originX) || 0, y: Number(originY) || 0 };

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function normalise(a: { x: number; y: number }, b: { x: number; y: number }): Region {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.max(Math.abs(a.x - b.x), MIN.width),
    height: Math.max(Math.abs(a.y - b.y), MIN.height),
  };
}

function editor(): void {
  document.body.className = 'editor';

  const size = el('div', { id: 'size' });
  const region = el('div', { id: 'region', className: 'empty' }, size);
  for (const handle of HANDLES) {
    const node = el('div', { className: 'handle' });
    node.dataset.handle = handle;
    region.append(node);
  }

  const hint = el(
    'div',
    { id: 'hint' },
    'Drag to set the capture area — ',
    el('b', {}, 'Enter'),
    ' to confirm, ',
    el('b', {}, 'Esc'),
    ' to cancel',
  );
  document.body.append(region, hint);

  let rect: Region | null = null;

  function paint(): void {
    if (!rect) {
      region.className = 'empty';
      return;
    }
    const local = { left: rect.x - origin.x, top: rect.y - origin.y };
    const onScreen =
      local.left + rect.width > 0 &&
      local.top + rect.height > 0 &&
      local.left < window.innerWidth &&
      local.top < window.innerHeight;
    region.className = onScreen ? '' : 'empty';
    region.style.left = `${local.left}px`;
    region.style.top = `${local.top}px`;
    region.style.width = `${rect.width}px`;
    region.style.height = `${rect.height}px`;
    size.textContent = `${rect.width} × ${rect.height}`;
  }

  function commit(next: Region): void {
    rect = next;
    paint();
    window.mimikOverlay.setRegion(next);
  }

  document.body.addEventListener('pointerdown', (event) => {
    const target = event.target as HTMLElement;
    const handle = target.dataset.handle as Handle | undefined;
    const moving = !handle && region.contains(target) && rect !== null;
    const start = { x: event.clientX + origin.x, y: event.clientY + origin.y };
    const from = rect ? { ...rect } : null;

    document.body.setPointerCapture(event.pointerId);
    event.preventDefault();

    const move = (e: PointerEvent) => {
      const point = { x: e.clientX + origin.x, y: e.clientY + origin.y };
      if (handle && from) {
        const left = handle.includes('w') ? point.x : from.x;
        const top = handle.includes('n') ? point.y : from.y;
        const right = handle.includes('e') ? point.x : from.x + from.width;
        const bottom = handle.includes('s') ? point.y : from.y + from.height;
        commit(normalise({ x: left, y: top }, { x: right, y: bottom }));
      } else if (moving && from) {
        commit({ ...from, x: from.x + (point.x - start.x), y: from.y + (point.y - start.y) });
      } else {
        commit(normalise(start, point));
      }
    };

    const up = () => {
      document.body.removeEventListener('pointermove', move);
      document.body.removeEventListener('pointerup', up);
    };

    document.body.addEventListener('pointermove', move);
    document.body.addEventListener('pointerup', up);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') window.mimikOverlay.command('arm');
    if (event.key === 'Escape') window.mimikOverlay.command('cancel');
  });

  window.mimikOverlay.region().then((current) => {
    rect = current;
    paint();
  });
  window.mimikOverlay.onUpdate((_state, current) => {
    rect = current;
    paint();
  });
}

function boundary(): void {
  document.body.className = 'boundary';
  document.body.append(el('div', { id: 'frame' }));
  const apply = (state: string) => document.body.setAttribute('data-state', state);
  window.mimikOverlay.state().then(apply);
  window.mimikOverlay.onUpdate(apply);
}

const MODES = [
  { id: 'window', label: 'Window' },
  { id: 'screen', label: 'Screen' },
  { id: 'area', label: 'Area' },
] as const;

const MODE_COMMAND: Record<string, string> = { window: 'mode:window', screen: 'mode:screen', area: 'mode:region' };
const MODE_ID: Record<string, string> = { window: 'window', screen: 'screen', region: 'area' };

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function mascot(size = 42): SVGSVGElement {
  const root = svg('svg', {
    viewBox: MASCOT_VIEW_BOX,
    width: size,
    height: Math.round(size * MASCOT_ASPECT),
    'aria-hidden': 'true',
  });
  const clip = svg('clipPath', { id: 'mascot-crown-split' });
  clip.append(svg('path', { d: MASCOT_CROWN_SPLIT }));
  const defs = svg('defs', {});
  defs.append(clip);
  const face = MASCOT_FACES.happy;
  root.append(
    defs,
    svg('rect', { ...MASCOT_BODY, fill: 'var(--deep)' }),
    svg('path', { d: MASCOT_CROWN, fill: 'var(--violet-mid)' }),
    svg('path', { d: MASCOT_CROWN, fill: 'var(--accent)', 'clip-path': 'url(#mascot-crown-split)' }),
    svg('rect', { ...MASCOT_SEAM, fill: 'var(--lavender)' }),
    ...face.eyes.map((d) =>
      svg('path', {
        d,
        stroke: 'var(--lavender)',
        'stroke-width': face.eyeWidth,
        fill: 'none',
        'stroke-linecap': 'round',
      }),
    ),
    svg('path', {
      d: face.mouth,
      stroke: 'var(--lavender)',
      'stroke-width': face.mouthWidth,
      fill: 'none',
      'stroke-linecap': 'round',
    }),
  );
  return root;
}

function controls(): void {
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
    badge.textContent = mode === 'screen' ? 'Full screen' : mode === 'region' ? 'Selected area' : 'Active window';
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

if (role === 'editor') editor();
else if (role === 'boundary') boundary();
else controls();
