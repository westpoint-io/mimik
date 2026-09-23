import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';

export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
