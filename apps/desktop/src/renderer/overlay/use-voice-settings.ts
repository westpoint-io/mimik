import { readVoiceSettings, type VoiceSettings } from '@mimik/core/capture/voice/read-voice-settings';
import { useEffect, useState } from 'react';

export function useVoiceSettings(): VoiceSettings {
  const [voice, setVoice] = useState<VoiceSettings>({ enabled: false, hasApiKey: false });

  useEffect(() => {
    const read = () => void readVoiceSettings().then(setVoice);
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);

  return voice;
}
