import { useEffect, useState } from 'react';
import { browser } from '#imports';
import { localStorage } from '@/lib/browser-api/local-storage';

export function useRecordingCard(): boolean {
  const [card, setCard] = useState(false);

  useEffect(() => {
    void localStorage.get(['recordingCard']).then((stored) => setCard(stored.recordingCard === true));
    const onChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && 'recordingCard' in changes) setCard(changes.recordingCard?.newValue === true);
    };
    browser.storage.onChanged.addListener(onChange);
    return () => browser.storage.onChanged.removeListener(onChange);
  }, []);

  return card;
}
