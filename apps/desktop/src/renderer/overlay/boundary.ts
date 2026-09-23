import { el } from './el';

export function boundary(): void {
  document.body.className = 'boundary';
  document.body.append(el('div', { id: 'frame' }));
  const apply = (state: string) => document.body.setAttribute('data-state', state);
  window.mimikOverlay.view().then((view) => apply(view.state));
  window.mimikOverlay.onUpdate((view) => apply(view.state));
}
