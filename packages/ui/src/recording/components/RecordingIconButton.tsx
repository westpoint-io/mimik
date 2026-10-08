import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';

const TONES = {
  default: 'bg-secondary text-foreground hover:bg-lavender',
  on: 'bg-primary text-primary-foreground hover:bg-primary/90',
  danger: 'bg-secondary text-foreground hover:bg-destructive/10 hover:text-destructive',
  locked: 'bg-secondary text-muted-foreground/60 cursor-default',
} as const;

interface RecordingIconButtonProps {
  id?: string;
  label: string;
  tone?: keyof typeof TONES;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function RecordingIconButton({
  id,
  label,
  tone = 'default',
  pressed,
  disabled,
  onClick,
  children,
}: RecordingIconButtonProps) {
  const locked = tone === 'locked';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0">
          <button
            id={id}
            type="button"
            aria-label={label}
            aria-pressed={pressed}
            aria-disabled={locked || undefined}
            disabled={disabled}
            onClick={locked ? undefined : onClick}
            className={`flex size-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-[17px] ${TONES[tone]}`}
          >
            {children}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
