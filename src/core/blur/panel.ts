import { i18n } from '#imports';
import type { PresetKey } from './regexes';
import { PRESET_LABELS } from './regexes';

const PRESET_KEYS: PresetKey[] = [
  'email',
  'phone',
  'ssn',
  'creditCard',
  'ipAddress',
  'macAddress',
  'ukPhone',
  'ukPostcode',
  'ukNino',
  'ukSortCode',
];

const STYLES = `
  :host {
    position: fixed;
    z-index: 2147483646;
    pointer-events: none;
    font-family: 'Poppins', system-ui, sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .panel {
    position: fixed;
    top: 20px;
    left: 20px;
    width: 280px;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #C7D2FE;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    user-select: none;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    cursor: grab;
  }

  .header:active { cursor: grabbing; }

  .header-title {
    font-size: 14px;
    font-weight: 700;
    color: #1E1B4B;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1E1B4B;
    transition: background 0.15s ease;
  }

  .close-btn:hover { background: #EEF2FF; }

  .body {
    padding: 0 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-label {
    font-size: 12px;
    font-weight: 600;
    color: #1E1B4B;
  }

  .toggle {
    position: relative;
    width: 40px;
    height: 22px;
    flex-shrink: 0;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .toggle-track {
    position: absolute;
    inset: 0;
    background: #C7D2FE;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .toggle-track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  }

  .toggle input:checked + .toggle-track {
    background: #4F46E5;
  }

  .toggle input:checked + .toggle-track::after {
    transform: translateX(18px);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s ease;
    line-height: 1.4;
  }

  .tag[data-on="true"] {
    background: #1E1B4B;
    color: #C7D2FE;
  }

  .tag[data-on="false"] {
    background: #EEF2FF;
    color: #1E1B4B;
  }

  .tag:hover { opacity: 0.85; }

  .btn-picker {
    width: 100%;
    padding: 9px 0;
    border-radius: 8px;
    border: 1.5px solid #C7D2FE;
    background: #fff;
    color: #1E1B4B;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 0.15s ease;
  }

  .btn-picker:hover {
    border-color: #1E1B4B;
    background: #EEF2FF;
  }

  .btn-reset {
    background: none;
    border: none;
    color: #6B7280;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    padding: 4px 0;
    align-self: center;
    transition: color 0.15s ease;
  }

  .btn-reset:hover { color: #1E1B4B; }

  .divider {
    height: 1px;
    background: #C7D2FE;
    margin: 0 -16px;
    width: calc(100% + 32px);
  }

  .footer {
    padding: 12px 16px;
    border-top: 1px solid #C7D2FE;
  }

  .btn-done {
    width: 100%;
    padding: 10px 0;
    border-radius: 8px;
    border: none;
    background: #1E1B4B;
    color: #C7D2FE;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s ease;
  }

  .btn-done:hover { opacity: 0.9; }

`;

function icon(name: 'close' | 'blur' | 'cursor'): string {
  switch (name) {
    case 'close':
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    case 'blur':
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/></svg>`;
    case 'cursor':
      return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>`;
  }
}

export class BlurPanel {
  private host: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private presets: Record<PresetKey, boolean>;

  constructor(presets: Record<PresetKey, boolean>) {
    this.presets = { ...presets };
  }

  mount() {
    this.host = document.createElement('div');
    this.host.setAttribute('data-mimik-ignore', '');

    const shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = STYLES;
    shadow.appendChild(style);

    this.panel = this.buildPanel();
    shadow.appendChild(this.panel);

    document.documentElement.appendChild(this.host);
    this.setupDrag(shadow);
  }

  unmount() {
    this.host?.remove();
    this.host = null;
    this.panel = null;
  }

  private buildPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'panel';

    panel.appendChild(this.buildHeader());

    const body = document.createElement('div');
    body.className = 'body';

    body.appendChild(this.buildManualSection());

    const divider = document.createElement('div');
    divider.className = 'divider';
    body.appendChild(divider);

    body.appendChild(this.buildPickerButton());
    body.appendChild(this.buildResetButton());

    panel.appendChild(body);
    panel.appendChild(this.buildFooter());

    return panel;
  }

  private buildHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'header';

    const title = document.createElement('div');
    title.className = 'header-title';
    title.innerHTML = `${icon('blur')} ${i18n.t('blurPanel.title')}`;
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = icon('close');
    closeBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('mimik-blur:done'));
    });
    header.appendChild(closeBtn);

    return header;
  }

  private buildManualSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'section';

    const row = document.createElement('div');
    row.className = 'section-row';

    const label = document.createElement('span');
    label.className = 'section-label';
    label.textContent = i18n.t('blurPanel.manualMode');
    row.appendChild(label);

    const anyOn = PRESET_KEYS.some((k) => this.presets[k]);

    const toggle = this.buildToggle(anyOn, (checked) => {
      const tags = section.querySelector('.tags') as HTMLElement;
      if (checked) {
        tags.style.display = 'flex';
      } else {
        tags.style.display = 'none';
        PRESET_KEYS.forEach((k) => {
          this.presets[k] = false;
        });
        this.updateTags(tags);
        this.dispatchPresets();
      }
    });
    row.appendChild(toggle);
    section.appendChild(row);

    const tags = document.createElement('div');
    tags.className = 'tags';
    tags.style.display = anyOn ? 'flex' : 'none';

    for (const key of PRESET_KEYS) {
      const tag = document.createElement('button');
      tag.className = 'tag';
      tag.textContent = PRESET_LABELS[key];
      tag.dataset.key = key;
      tag.dataset.on = String(this.presets[key]);
      tag.addEventListener('click', () => {
        this.presets[key] = !this.presets[key];
        tag.dataset.on = String(this.presets[key]);
        this.dispatchPresets();
      });
      tags.appendChild(tag);
    }

    section.appendChild(tags);
    return section;
  }

  private buildToggle(initial: boolean, onChange: (checked: boolean) => void): HTMLElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = initial;
    input.addEventListener('change', () => onChange(input.checked));
    wrapper.appendChild(input);

    const track = document.createElement('span');
    track.className = 'toggle-track';
    wrapper.appendChild(track);

    return wrapper;
  }

  private buildPickerButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'btn-picker';
    btn.innerHTML = `${icon('cursor')} Click to Blur`;
    btn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('mimik-blur:start-picker'));
    });
    return btn;
  }

  private buildResetButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'btn-reset';
    btn.textContent = i18n.t('blurPanel.resetAll');
    btn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('mimik-blur:reset'));
    });
    return btn;
  }

  private buildFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.className = 'footer';

    const btn = document.createElement('button');
    btn.className = 'btn-done';
    btn.textContent = i18n.t('blurPanel.doneResume');
    btn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('mimik-blur:done'));
    });
    footer.appendChild(btn);

    return footer;
  }

  private updateTags(container: HTMLElement) {
    const tags = container.querySelectorAll('.tag');
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i] as HTMLElement;
      const key = tag.dataset.key as PresetKey;
      tag.dataset.on = String(this.presets[key]);
    }
  }

  private dispatchPresets() {
    const active = PRESET_KEYS.filter((k) => this.presets[k]);
    document.dispatchEvent(new CustomEvent('mimik-blur:update-presets', { detail: { presets: active } }));
  }

  private setupDrag(shadow: ShadowRoot) {
    const header = shadow.querySelector('.header') as HTMLElement;
    const panel = shadow.querySelector('.panel') as HTMLElement;
    if (!header || !panel) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let panelX = 0;
    let panelY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.close-btn')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      panelX = parseInt(panel.style.left || '20', 10);
      panelY = parseInt(panel.style.top || '20', 10);
      header.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = `${panelX + dx}px`;
      panel.style.top = `${panelY + dy}px`;
    };

    const onPointerUp = () => {
      dragging = false;
    };

    header.addEventListener('pointerdown', onPointerDown);
    header.addEventListener('pointermove', onPointerMove);
    header.addEventListener('pointerup', onPointerUp);
  }
}
