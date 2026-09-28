import { localStorage } from '@mimik/core/env';
import { hasVoiceoverKey, VOICEOVER_SETTINGS } from '@mimik/core/export/voiceover/config';
import { useEffect, useState } from 'react';

export function useVoiceoverReady(open: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    localStorage.get([...VOICEOVER_SETTINGS]).then((stored) => {
      if (active) setReady(hasVoiceoverKey(stored));
    });
    return () => {
      active = false;
    };
  }, [open]);
  return ready;
}
