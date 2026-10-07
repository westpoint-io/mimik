import { createOverlayRoot } from '@/core/capture/dom/overlay-root';

const ELEMENT_TAG = 'mimik-guideme';
const PAD = 6;

const STYLES = `
  :host {
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    pointer-events: none;
    font-family: 'Poppins', system-ui, sans-serif;
  }

  .highlight {
    position: fixed;
    border: 2px solid #4F46E5;
    border-radius: 4px;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15), 0 0 12px rgba(79, 70, 229, 0.2);
    pointer-events: none;
    transition: all 0.3s ease;
  }

  .label {
    position: fixed;
    background: white;
    border-radius: 10px;
    padding: 10px 14px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(0, 0, 0, 0.06);
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 320px;
    pointer-events: none;
  }

  .label .num {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #1E1B4B;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    color: #C7D2FE;
    flex-shrink: 0;
  }

  .label .text {
    font-size: 12px;
    font-weight: 600;
    color: #1E1B4B;
    line-height: 1.35;
  }
`;

export class GuideMeOverlay {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private highlightEl: HTMLDivElement | null = null;
  private labelEl: HTMLDivElement | null = null;
  private currentTarget: HTMLElement | null = null;
  private scrollHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    const { host, shadow } = createOverlayRoot(STYLES, ELEMENT_TAG);
    this.host = host;
    this.shadow = shadow;

    document.documentElement.appendChild(this.host);
  }

  show(description: string, stepNumber: number, targetElement: HTMLElement | null): void {
    this.cleanup();
    this.currentTarget = targetElement;

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => this.render(description, stepNumber, targetElement), 400);
    }
  }

  private render(description: string, stepNumber: number, target: HTMLElement): void {
    const rect = target.getBoundingClientRect();

    this.highlightEl = document.createElement('div');
    this.highlightEl.className = 'highlight';
    this.positionHighlight(rect);
    this.shadow.appendChild(this.highlightEl);

    this.labelEl = document.createElement('div');
    this.labelEl.className = 'label';
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(stepNumber);
    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = description;
    this.labelEl.append(num, text);
    this.shadow.appendChild(this.labelEl);
    this.positionLabel(rect);

    this.scrollHandler = () => this.reposition();
    window.addEventListener('scroll', this.scrollHandler, true);
    this.resizeObserver = new ResizeObserver(() => this.reposition());
    this.resizeObserver.observe(document.documentElement);
  }

  private positionHighlight(rect: DOMRect): void {
    if (!this.highlightEl) return;
    this.highlightEl.style.left = `${rect.left - PAD}px`;
    this.highlightEl.style.top = `${rect.top - PAD}px`;
    this.highlightEl.style.width = `${rect.width + PAD * 2}px`;
    this.highlightEl.style.height = `${rect.height + PAD * 2}px`;
  }

  private positionLabel(rect: DOMRect): void {
    if (!this.labelEl) return;
    const gap = 10;
    const labelRect = this.labelEl.getBoundingClientRect();
    const belowY = rect.bottom + PAD + gap;
    const aboveY = rect.top - PAD - gap - labelRect.height;
    const leftX = Math.max(8, Math.min(rect.left, window.innerWidth - labelRect.width - 8));

    if (belowY + labelRect.height < window.innerHeight) {
      this.labelEl.style.top = `${belowY}px`;
      this.labelEl.style.left = `${leftX}px`;
    } else if (aboveY > 0) {
      this.labelEl.style.top = `${aboveY}px`;
      this.labelEl.style.left = `${leftX}px`;
    } else {
      this.labelEl.style.top = `${rect.top}px`;
      this.labelEl.style.left = `${rect.right + PAD + gap}px`;
    }
  }

  private reposition(): void {
    if (!this.currentTarget) return;
    const rect = this.currentTarget.getBoundingClientRect();
    this.positionHighlight(rect);
    this.positionLabel(rect);
  }

  private cleanup(): void {
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler, true);
      this.scrollHandler = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.highlightEl?.remove();
    this.highlightEl = null;
    this.labelEl?.remove();
    this.labelEl = null;
  }

  destroy(): void {
    this.cleanup();
    this.host.remove();
  }
}
