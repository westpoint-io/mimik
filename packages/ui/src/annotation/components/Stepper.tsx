import type { ReactNode } from 'react';
import { clampNumber } from '../lib/clamp-number';
import { Tip } from './Tip';

export interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  width: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  onChange: (value: number) => void;
}

export function Stepper({ label, value, min, max, step, decimals = 0, width, prefix, suffix, onChange }: StepperProps) {
  const round = (n: number) => Number(n.toFixed(decimals));
  return (
    <Tip label={label}>
      <div className="flex items-center gap-0.5 rounded-md bg-primary-foreground/10 h-6 px-1">
        {prefix}
        <button
          type="button"
          aria-label="-"
          onClick={() => onChange(round(clampNumber(value - step, min, max)))}
          className="w-4 h-5 rounded text-primary-foreground/70 hover:bg-primary-foreground/15 text-[13px] leading-none"
        >
          &minus;
        </button>
        <input
          value={value}
          inputMode="decimal"
          aria-label={label}
          onChange={(e) => onChange(round(clampNumber(e.target.value, min, max)))}
          className={`${width} bg-transparent text-center text-[11px] tabular-nums text-primary-foreground outline-none`}
        />
        <button
          type="button"
          aria-label="+"
          onClick={() => onChange(round(clampNumber(value + step, min, max)))}
          className="w-4 h-5 rounded text-primary-foreground/70 hover:bg-primary-foreground/15 text-[13px] leading-none"
        >
          +
        </button>
        {suffix}
      </div>
    </Tip>
  );
}
