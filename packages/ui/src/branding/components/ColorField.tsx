import { ChevronDown } from 'lucide-react';
import { ColorPicker } from '../../annotation/components/ColorPicker';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';

interface ColorFieldProps {
  value: string;
  presets: readonly string[];
  onChange: (color: string) => void;
}

export function ColorField({ value, presets, onChange }: ColorFieldProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 shrink-0 border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground hover:border-accent"
        >
          <span
            className="w-[22px] h-[22px] rounded-full border border-foreground/15"
            style={{ backgroundColor: value }}
          />
          <code className="tabular-nums">{value.toUpperCase()}</code>
          <ChevronDown size={12} className="opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2.5">
        <ColorPicker value={value} presets={presets} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}
