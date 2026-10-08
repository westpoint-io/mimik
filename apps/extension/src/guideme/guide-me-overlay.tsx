import { mountInPage, type PageUi } from '@/page-ui/mount-in-page';
import { GuideMeMarker } from './GuideMeMarker';

const ELEMENT_TAG = 'mimik-guideme';
const SCROLL_SETTLE_MS = 400;

export class GuideMeOverlay {
  private page: PageUi = mountInPage(ELEMENT_TAG);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(description: string, stepNumber: number, targetElement: HTMLElement | null): void {
    this.clear();
    if (!targetElement) return;
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.timer = setTimeout(
      () => this.page.render(<GuideMeMarker target={targetElement} description={description} number={stepNumber} />),
      SCROLL_SETTLE_MS,
    );
  }

  destroy(): void {
    this.clear();
    this.page.unmount();
  }

  private clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.page.render(null);
  }
}
