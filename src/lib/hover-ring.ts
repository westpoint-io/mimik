import { createOverlayRoot } from '@/core/capture/dom/overlay-root';

const PAD = 3;
const Z_INDEX = 2147483644;
const COLOR_VAR = '--mimik-ring-color';

const STYLES = `
  .ring {
    position: fixed;
    display: none;
    border: 2px dashed var(${COLOR_VAR});
    border-radius: 4px;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(${COLOR_VAR}) 10%, transparent);
    pointer-events: none;
    transition: all 0.15s ease;
  }
`;

export class HoverRing {
  private host: HTMLElement | null = null;
  private ring: HTMLElement | null = null;

  constructor(private color: string) {}

  setColor(color: string) {
    this.color = color;
    this.host?.style.setProperty(COLOR_VAR, color);
  }

  show(el: Element) {
    const ring = this.ring?.isConnected ? this.ring : this.mount();
    const rect = el.getBoundingClientRect();
    ring.style.left = `${rect.left - PAD}px`;
    ring.style.top = `${rect.top - PAD}px`;
    ring.style.width = `${rect.width + PAD * 2}px`;
    ring.style.height = `${rect.height + PAD * 2}px`;
    ring.style.display = 'block';
  }

  hide() {
    if (this.ring) this.ring.style.display = 'none';
  }

  dispose() {
    this.host?.remove();
    this.host = null;
    this.ring = null;
  }

  private mount(): HTMLElement {
    const { host, shadow } = createOverlayRoot(STYLES);
    host.style.cssText = `position:fixed;inset:0;z-index:${Z_INDEX};pointer-events:none;`;
    host.style.setProperty(COLOR_VAR, this.color);

    const ring = document.createElement('div');
    ring.className = 'ring';
    shadow.appendChild(ring);

    document.documentElement.appendChild(host);
    this.host = host;
    this.ring = ring;
    return ring;
  }
}
