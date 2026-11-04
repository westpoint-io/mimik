import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

interface OnboardingChoiceProps {
  selected: boolean;
  picture: ReactNode;
  title: string;
  message: string;
  best: string;
  onSelect: () => void;
}

export function OnboardingChoice({ selected, picture, title, message, best, onSelect }: OnboardingChoiceProps) {
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
        <span className="absolute -top-2.5 -right-2.5 flex size-[22px] items-center justify-center rounded-md bg-primary text-on-solid">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
      <div className="relative aspect-video w-full overflow-hidden rounded-[10px] bg-gradient-to-b from-lavender/50 to-secondary">
        {picture}
      </div>
      <b className="text-[14px] text-foreground">{title}</b>
      <p className="text-[12px] leading-snug text-muted-foreground">{message}</p>
      <span className="mt-auto rounded-[7px] bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground">
        {best}
      </span>
    </button>
  );
}
