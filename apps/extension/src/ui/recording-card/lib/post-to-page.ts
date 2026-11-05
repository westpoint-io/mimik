import type { CardFrameMessage } from '@/lib/card-frame-message';

export function postToPage(message: CardFrameMessage): void {
  window.parent.postMessage(message, '*');
}
