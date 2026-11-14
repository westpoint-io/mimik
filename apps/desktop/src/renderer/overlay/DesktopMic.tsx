import { micToggleState } from '@mimik/core/capture/voice/mic-toggle-state';
import { i18n } from '@mimik/core/env';
import { MicButton } from '@mimik/ui';
import { useVoiceSettings } from './use-voice-settings';

export function DesktopMic({ paused }: { paused: boolean }) {
  const voice = useVoiceSettings();
  const mic = micToggleState(voice.enabled, voice.blocker, paused);
  return (
    <MicButton
      id="mic"
      enabled={voice.enabled}
      locked={mic.locked}
      label={i18n.t(mic.labelKey)}
      onClick={() => window.mimikOverlay.command(voice.enabled ? 'narration:stop' : 'narration:start')}
    />
  );
}
