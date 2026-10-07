import { Check } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  label: string;
  hint?: string;
  onChange: (next: boolean) => void;
}

export function Checkbox({ checked, label, hint, onChange }: CheckboxProps) {
  return (
    <label className="flex w-full cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1 ${
          checked ? 'border-accent bg-accent text-primary-foreground' : 'border-border bg-card'
        }`}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}
