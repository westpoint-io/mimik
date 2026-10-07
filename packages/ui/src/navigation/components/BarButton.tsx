import type { ComponentProps, ReactNode } from 'react';
import { Button } from '../../components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';

type BarButtonProps = ComponentProps<typeof Button> & { icon: ReactNode; label: string; iconOnly: boolean };

export function BarButton({ icon, label, iconOnly, className, ...props }: BarButtonProps) {
  if (!iconOnly) {
    return (
      <Button size="sm" className={className} {...props}>
        {icon}
        {label}
      </Button>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" aria-label={label} className={`${className ?? ''} w-8 px-0`} {...props}>
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
