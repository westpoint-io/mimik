import type { Command } from 'lucide-react';

interface SegmentedProps<T> {
  label: string;
  value: T;
  options: { value: T; label: string; Icon?: typeof Command }[];
  onChange: (next: T) => void;
}

export function Segmented<T>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <fieldset
      aria-label={label}
      className="flex shrink-0 gap-[3px] self-start rounded-[10px] border border-border bg-card p-[3px]"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-colors ${
              active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'
            }`}
          >
            {option.Icon && <option.Icon size={14} />}
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}
