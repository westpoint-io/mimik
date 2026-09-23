import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@mimik/ui/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mimik/ui/components/ui/tooltip';
import type { ReactNode } from 'react';

export function MenuPopover({ label, children, items }: { label: string; children: ReactNode; items: ReactNode }) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="center">{items}</DropdownMenuContent>
    </DropdownMenu>
  );
}
