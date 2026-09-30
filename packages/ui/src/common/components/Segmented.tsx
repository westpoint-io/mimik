import type { Command } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';

interface SegmentedProps<T> {
  label: string;
  value: T;
  options: { value: T; label: string; Icon?: typeof Command; logo?: ReactNode }[];
  onChange: (next: T) => void;
}

export function Segmented<T>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <TooltipProvider>
      <fieldset
        aria-label={label}
        className="flex shrink-0 gap-[3px] self-start rounded-[10px] border border-border bg-card p-[3px]"
      >
        {options.map((option) => {
          const active = option.value === value;
          const button = (
            <button
              key={option.label}
              type="button"
              aria-pressed={active}
              aria-label={option.logo ? option.label : undefined}
              onClick={() => onChange(option.value)}
              className={`flex h-8 items-center gap-1.5 rounded-lg text-[12.5px] font-semibold transition-colors ${
                option.logo ? 'w-9 justify-center' : 'px-3'
              } ${active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'}`}
            >
              {option.logo ?? (
                <>
                  {option.Icon && <option.Icon size={14} />}
                  {option.label}
                </>
              )}
            </button>
          );
          return option.logo ? (
            <Tooltip key={option.label}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent>{option.label}</TooltipContent>
            </Tooltip>
          ) : (
            button
          );
        })}
      </fieldset>
    </TooltipProvider>
  );
}
