import { browser } from '#imports';
import { createOverlayRoot } from '@/core/capture/dom/overlay-root';
import type { CardFrameMessage } from '@/lib/card-frame-message';

const MARGIN = 24;
const STYLE = `iframe{position:fixed;z-index:2147483647;border:0;margin:0;padding:0;width:300px;height:0;color-scheme:normal;background:transparent;filter:drop-shadow(0 12px 28px rgb(30 27 75 / .2)) drop-shadow(0 1px 3px rgb(30 27 75 / .12))}`;

interface Corner {
  right: number;
  bottom: number;
}

export class CardFrame {
  private host: HTMLElement | null = null;
  private frame: HTMLIFrameElement | null = null;
  private corner: Corner = { right: MARGIN, bottom: MARGIN };

  constructor(private readonly query = '') {}

  get mounted(): boolean {
    return this.host !== null;
  }

  mount(): void {
    if (this.host) return;
    const { host, shadow } = createOverlayRoot(STYLE);
    const frame = document.createElement('iframe');
    frame.src = `${browser.runtime.getURL('/recording-card.html')}${this.query}`;
    frame.setAttribute('aria-label', 'Mimik');
    shadow.appendChild(frame);
    document.documentElement.appendChild(host);
    this.host = host;
    this.frame = frame;
    this.place();
    window.addEventListener('message', this.onMessage);
    void browser.storage.local.get('cardCorner').then((stored) => {
      const saved = stored.cardCorner as Corner | undefined;
      if (saved && typeof saved.right === 'number' && typeof saved.bottom === 'number') {
        this.corner = saved;
        this.place();
      }
    });
  }

  unmount(): void {
    window.removeEventListener('message', this.onMessage);
    this.host?.remove();
    this.host = null;
    this.frame = null;
  }

  setHidden(hidden: boolean): void {
    if (this.host) this.host.style.opacity = hidden ? '0' : '';
  }

  private place(): void {
    if (!this.frame) return;
    const width = this.frame.offsetWidth;
    const height = this.frame.offsetHeight;
    const right = Math.min(Math.max(this.corner.right, 0), Math.max(window.innerWidth - width, 0));
    const bottom = Math.min(Math.max(this.corner.bottom, 0), Math.max(window.innerHeight - height, 0));
    this.corner = { right, bottom };
    this.frame.style.right = `${right}px`;
    this.frame.style.bottom = `${bottom}px`;
  }

  private onMessage = (event: MessageEvent) => {
    if (!this.frame || event.source !== this.frame.contentWindow) return;
    const message = event.data as CardFrameMessage;
    if (message.mimikCard === 'size') {
      this.frame.style.width = `${Math.ceil(message.width)}px`;
      this.frame.style.height = `${Math.ceil(message.height)}px`;
      this.place();
    } else if (message.mimikCard === 'move') {
      this.corner = { right: this.corner.right - message.dx, bottom: this.corner.bottom - message.dy };
      this.place();
    } else if (message.mimikCard === 'drop') {
      void browser.storage.local.set({ cardCorner: this.corner });
    } else if (message.mimikCard === 'close') {
      this.unmount();
    }
  };
}
