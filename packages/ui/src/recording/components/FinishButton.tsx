import { i18n } from '@mimik/core/env';
import { Check } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';

interface FinishButtonProps {
  id?: string;
  disabled?: boolean;
  onClick: () => void;
}

export function FinishButton({ id, disabled, onClick }: FinishButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          id={id}
          onClick={onClick}
          disabled={disabled}
          aria-label={i18n.t('recording.finishRecording')}
          className="h-9 min-w-0 flex-1 rounded-full text-[13px] font-semibold"
        >
          <Check size={16} strokeWidth={3} />
          <span className="truncate">{i18n.t('recording.finish')}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{i18n.t('recording.finishRecording')}</TooltipContent>
    </Tooltip>
  );
}
