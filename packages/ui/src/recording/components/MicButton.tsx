import { Mic, MicOff } from 'lucide-react';
import { RecordingIconButton } from './RecordingIconButton';

interface MicButtonProps {
  id?: string;
  enabled: boolean;
  locked: boolean;
  label: string;
  onClick: () => void;
}

export function MicButton({ id, enabled, locked, label, onClick }: MicButtonProps) {
  return (
    <RecordingIconButton
      id={id}
      label={label}
      tone={locked ? 'locked' : enabled ? 'on' : 'default'}
      pressed={enabled}
      onClick={onClick}
    >
      {enabled ? <Mic /> : <MicOff />}
    </RecordingIconButton>
  );
}
