interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  shown: string;
  disabled?: boolean;
  onChange: (next: number) => void;
}

export function Slider({ label, value, min, max, step, shown, disabled, onChange }: SliderProps) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-52 accent-accent disabled:opacity-50"
      />
      <span className="min-w-[56px] rounded-[7px] bg-secondary px-2 py-1 text-center text-xs font-semibold tabular-nums text-foreground">
        {shown}
      </span>
    </div>
  );
}
