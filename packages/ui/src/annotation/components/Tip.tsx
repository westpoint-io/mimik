import { Tooltip, TooltipContent, TooltipTrigger } from '@mimik/ui/components/ui/tooltip';
import type { ReactNode } from 'react';

export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
