import { i18n } from '@mimik/core/env';
import { Check } from 'lucide-react';
import { DemoCursor } from './DemoCursor';

interface WritingChoiceProps {
  selected: boolean;
  badge: string;
  example: string;
  title: string;
  message: string;
  best: string;
  ai?: boolean;
  onSelect: () => void;
}

export function WritingChoice({
  selected,
  badge,
  example,
  title,
  message,
  best,
  ai = false,
  onSelect,
}: WritingChoiceProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-2.5 rounded-[14px] border-[1.5px] bg-card p-3 text-center transition-shadow ${
        selected
          ? 'border-primary shadow-[0_0_0_3px_var(--color-lavender)]'
          : 'border-lavender/60 hover:border-lavender'
      }`}
    >
      {selected && (
        <span className="absolute -top-2.5 -right-2.5 flex size-[22px] items-center justify-center rounded-md bg-primary text-white">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
      <div className="relative aspect-video w-full overflow-hidden rounded-[10px] bg-gradient-to-b from-lavender/50 to-secondary">
        <div className="absolute inset-x-[10%] top-[14%] bottom-0 flex flex-col gap-[7%] rounded-t-lg bg-white px-[8%] pt-[8%] shadow-[0_4px_14px_rgba(30,27,75,0.12)]">
          <div className="relative h-[46%] rounded-[5px] bg-background bg-[linear-gradient(var(--color-lavender),var(--color-lavender)),linear-gradient(var(--color-lavender),var(--color-lavender))] bg-[length:45%_10%,65%_10%] bg-[position:8%_22%,8%_50%] bg-no-repeat">
            <span className="absolute top-[47%] left-[60%] h-[22%] w-[22%] rounded-[3px] bg-gray-200" />
            <span className="absolute top-[45%] left-[58%] h-[26%] w-[26%] animate-[ob-mark_5s_ease-in-out_infinite] rounded-[4px] border-2 border-dashed border-mascot motion-reduce:animate-none" />
            <DemoCursor className="top-[58%] left-[68%] animate-[ob-cur-in_5s_ease-in-out_infinite] motion-reduce:hidden" />
          </div>
          <div className="relative text-left text-[11px] leading-snug font-semibold text-foreground">
            {ai && (
              <span className="absolute inset-x-0 top-0 h-[9px] w-[80%] animate-[ob-shimmer_5s_linear_infinite] rounded bg-[linear-gradient(90deg,var(--color-lavender),#fff,var(--color-lavender))] bg-[length:200%_100%] opacity-0 motion-reduce:hidden" />
            )}
            <span
              className={`block ${ai ? 'animate-[ob-text-ai_5s_ease_infinite]' : 'animate-[ob-text-basic_5s_ease_infinite]'} motion-reduce:animate-none`}
            >
              {example}
              <span className="mt-1 flex items-center gap-1.5 text-[9.5px] font-medium text-muted-foreground">
                <span
                  className={`rounded px-1.5 py-0.5 text-[8.5px] font-bold tracking-wide uppercase ${
                    ai ? 'bg-lavender/60 text-foreground' : 'bg-primary text-primary-foreground'
                  }`}
                >
                  {badge}
                </span>
                {i18n.t('onboarding.exampleMeta')}
              </span>
            </span>
          </div>
        </div>
      </div>
      <b className="text-[14px] text-foreground">{title}</b>
      <p className="text-[12px] leading-snug text-muted-foreground">{message}</p>
      <span className="mt-auto rounded-[7px] bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground">
        {best}
      </span>
    </button>
  );
}
