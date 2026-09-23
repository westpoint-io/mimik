import type { ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';

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
