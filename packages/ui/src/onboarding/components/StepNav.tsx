import { i18n } from '@mimik/core/env';
import { Button } from '../../components/ui/button';

interface StepNavProps {
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
}

export function StepNav({ onNext, onBack, nextLabel }: StepNavProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      {onBack && (
        <Button variant="ghost" onClick={onBack} className="h-11 rounded-xl px-5 text-muted-foreground">
          {i18n.t('common.back')}
        </Button>
      )}
      <Button onClick={onNext} className="h-11 rounded-xl px-7 text-[14px] font-semibold">
        {nextLabel ?? i18n.t('common.continue')}
      </Button>
    </div>
  );
}
