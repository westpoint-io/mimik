import type { VoiceUpdate } from '@mimik/core/capture/voice/voice-update';
import { useEffect, useState } from 'react';
import { getVoiceStatus } from '@/lib/offscreen/get-voice-status';
import { observeVoiceFromBackground } from '@/lib/port/observe-voice-from-background';

export function useBackgroundVoice(): { update: VoiceUpdate; seenLive: boolean } {
  const [update, setUpdate] = useState<VoiceUpdate>({ phase: 'idle' });
  const [seenLive, setSeenLive] = useState(false);

  useEffect(() => {
    let stop: (() => void) | null = null;

    const receive = (next: VoiceUpdate) => {
      if (next.phase !== 'idle') setSeenLive(true);
      setUpdate(next);
    };

    const resync = () => {
      getVoiceStatus()
        .then((status) => {
          if (!status?.transcribing) return;
          setSeenLive(true);
          setUpdate({ phase: 'transcribing' });
        })
        .catch(() => undefined);
    };

    const follow = () => {
      if (document.visibilityState === 'visible') {
        stop ??= observeVoiceFromBackground(receive, resync);
        return;
      }
      stop?.();
      stop = null;
    };

    follow();
    document.addEventListener('visibilitychange', follow);

    return () => {
      document.removeEventListener('visibilitychange', follow);
      stop?.();
    };
  }, []);

  return { update, seenLive };
}
