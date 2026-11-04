import type { CardCommand } from '@mimik/core/capture/card-view';
import { CaptureState, type CaptureStateValue } from '@mimik/core/capture/machine';
import { i18n } from '@mimik/core/env';
import { Pause, Play, Trash2, Video, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { FinishButton } from '../components/FinishButton';
import { RecordingIconButton } from '../components/RecordingIconButton';

interface CardFootProps {
  state: CaptureStateValue;
  hidden: boolean;
  starting: boolean;
  busy: boolean;
  blocked?: string;
  mic?: ReactNode;
  tools?: ReactNode;
  onCommand: (command: CardCommand) => void;
}

export function CardFoot({ state, hidden, starting, busy, blocked, mic, tools, onCommand }: CardFootProps) {
  const armed = state === CaptureState.ARMED;
  const recording = state === CaptureState.RECORDING;
  const paused = state === CaptureState.PAUSED;

  return (
    <div id="foot" hidden={hidden} className="flex gap-2 px-3.5 pt-3 pb-3.5">
      {armed && blocked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex min-w-0 flex-1">
              <Button disabled className="h-9 min-w-0 flex-1 rounded-full text-[13px] font-semibold">
                <Video size={16} />
                <span className="truncate">{i18n.t('desktop.startButton')}</span>
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{blocked}</TooltipContent>
        </Tooltip>
      ) : armed ? (
        <Button
          id="primary"
          disabled={starting}
          onClick={() => onCommand('start')}
          className="h-9 min-w-0 flex-1 rounded-full text-[13px] font-semibold"
        >
          <Video size={16} />
          <span className="truncate">{i18n.t('desktop.startButton')}</span>
        </Button>
      ) : (
        <FinishButton id="primary" disabled={starting || busy} onClick={() => onCommand('stop')} />
      )}
      {mic}
      {!armed && tools}
      <RecordingIconButton
        id="secondary"
        label={i18n.t(armed ? 'common.close' : recording ? 'recording.pauseCapture' : 'recording.resumeCapture')}
        tone={paused ? 'on' : 'default'}
        onClick={() => onCommand(armed ? 'disarm' : recording ? 'pause' : 'resume')}
      >
        {armed ? <X /> : recording ? <Pause /> : <Play />}
      </RecordingIconButton>
      {!armed && (
        <RecordingIconButton
          id="discard"
          label={i18n.t('recording.discard')}
          tone="danger"
          onClick={() => onCommand('discard')}
        >
          <Trash2 />
        </RecordingIconButton>
      )}
    </div>
  );
}
