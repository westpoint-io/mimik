import { CaptureState, type CaptureStateValue } from '@mimik/core/capture/machine';
import { micToggleState } from '@mimik/core/capture/voice/mic-toggle-state';
import { i18n } from '@mimik/core/env';
import { Button, FinishButton, MicButton, RecordingIconButton } from '@mimik/ui';
import { Pause, Play, Trash2, Video, X } from 'lucide-react';
import { useVoiceSettings } from './use-voice-settings';

interface CardFootProps {
  state: CaptureStateValue;
  hidden: boolean;
  starting: boolean;
  busy: boolean;
}

export function CardFoot({ state, hidden, starting, busy }: CardFootProps) {
  const voice = useVoiceSettings();
  const armed = state === CaptureState.ARMED;
  const recording = state === CaptureState.RECORDING;
  const paused = state === CaptureState.PAUSED;
  const mic = micToggleState(voice.enabled, voice.hasApiKey, paused);
  const command = (name: string) => window.mimikOverlay.command(name);

  return (
    <div id="foot" hidden={hidden} className="flex gap-2 px-3.5 pt-3 pb-3.5">
      {armed ? (
        <Button
          id="primary"
          disabled={starting}
          onClick={() => command('start')}
          className="h-9 min-w-0 flex-1 rounded-full text-[13px] font-semibold"
        >
          <Video size={16} />
          <span className="truncate">{i18n.t('desktop.startButton')}</span>
        </Button>
      ) : (
        <FinishButton id="primary" disabled={starting || busy} onClick={() => command('stop')} />
      )}
      <MicButton
        id="mic"
        enabled={voice.enabled}
        locked={mic.locked}
        label={i18n.t(mic.labelKey)}
        onClick={() => command(voice.enabled ? 'narration:stop' : 'narration:start')}
      />
      <RecordingIconButton
        id="secondary"
        label={i18n.t(armed ? 'common.close' : recording ? 'recording.pauseCapture' : 'recording.resumeCapture')}
        tone={paused ? 'on' : 'default'}
        onClick={() => command(armed ? 'disarm' : recording ? 'pause' : 'resume')}
      >
        {armed ? <X /> : recording ? <Pause /> : <Play />}
      </RecordingIconButton>
      {!armed && (
        <RecordingIconButton
          id="discard"
          label={i18n.t('recording.discard')}
          tone="danger"
          onClick={() => command('discard')}
        >
          <Trash2 />
        </RecordingIconButton>
      )}
    </div>
  );
}
