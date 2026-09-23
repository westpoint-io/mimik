import { Popover, PopoverContent, PopoverTrigger } from '@mimik/ui/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mimik/ui/components/ui/tooltip';
import type { ReactNode } from 'react';
import ColorPicker from './ColorPicker';

export interface ColorPopoverProps {
  label: string;
  value: string;
  allowNone?: boolean;
  onChange: (color: string) => void;
  children: ReactNode;
}

export function ColorPopover({ label, value, allowNone, onChange, children }: ColorPopoverProps) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>{children}</PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="center" className="w-56 p-2.5">
        <ColorPicker value={value} allowNone={allowNone} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}
