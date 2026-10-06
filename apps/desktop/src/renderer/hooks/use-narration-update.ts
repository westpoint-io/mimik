import type { VoiceUpdate } from '@mimik/core/capture/voice/voice-update';
import { useEffect, useState } from 'react';
import { desktopNarration } from '../desktop-narration';

export function useNarrationUpdate(): { update: VoiceUpdate; seenLive: boolean } {
  const [update, setUpdate] = useState<VoiceUpdate>(desktopNarration.update);
  const [seenLive, setSeenLive] = useState(desktopNarration.update.phase !== 'idle');

  useEffect(
    () =>
      desktopNarration.onUpdate((next) => {
        if (next.phase !== 'idle') setSeenLive(true);
        setUpdate(next);
      }),
    [],
  );

  return { update, seenLive };
}
