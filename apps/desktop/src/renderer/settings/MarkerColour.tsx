import { i18n, localStorage } from '@mimik/core/env';
import { DEFAULT_TARGET_COLOR, TARGET_COLORS } from '@mimik/core/screenshot/types';
import { ColorPicker, Popover, PopoverContent, PopoverTrigger } from '@mimik/ui';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';

export function MarkerColour() {
  const [color, setColor] = useState(DEFAULT_TARGET_COLOR);

  useEffect(() => {
    localStorage.get(['targetColor']).then(({ targetColor }) => targetColor && setColor(targetColor));
  }, []);

  const change = (next: string) => {
    setColor(next);
    localStorage.set({ targetColor: next });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={i18n.t('desktop_markerColour')}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-[11px] text-foreground hover:border-accent"
        >
          <span
            className="h-[22px] w-[22px] rounded-full border border-foreground/15"
            style={{ backgroundColor: color }}
          />
          <code className="tabular-nums">{color.toUpperCase()}</code>
          <ChevronDown size={12} className="opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2.5">
        <ColorPicker value={color} presets={TARGET_COLORS} onChange={change} />
      </PopoverContent>
    </Popover>
  );
}
