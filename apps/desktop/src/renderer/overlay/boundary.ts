import { el } from './el';

export function boundary(): void {
  document.body.className = 'boundary';
  document.body.append(el('div', { id: 'frame' }));
  const apply = (state: string) => document.body.setAttribute('data-state', state);
  window.mimikOverlay.state().then(apply);
  window.mimikOverlay.onUpdate(apply);
}
