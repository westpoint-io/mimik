import { useEffect } from 'react';
import { browser } from '#imports';
import { onMessage } from '@/lib/messaging';
import { CardFrame } from '@/page-ui/card-frame';

export function useCardOnIcon(): void {
  useEffect(() => {
    const card = new CardFrame('?blocked');
    const stop = onMessage('toggleCardInPage', async ({ data }) => {
      const tab = await browser.tabs.getCurrent();
      if (tab?.id !== data) return;
      if (card.mounted) card.unmount();
      else card.mount();
    });
    return () => {
      stop();
      card.unmount();
    };
  }, []);
}
