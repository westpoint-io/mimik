import { i18n } from '@mimik/core/env';
import type { DuplicatePlace } from '@mimik/core/guides/duplicate-index';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';

interface DuplicateMenuProps {
  children: ReactNode;
  belowStep: number;
  aboveStep: number;
  lastStep: number;
  onDuplicate: (place: DuplicatePlace) => void;
  tooltip?: string;
  align?: 'start' | 'center' | 'end';
}

const ITEM =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-secondary hover:text-accent focus-visible:bg-secondary';

export function DuplicateMenu({
  children,
  belowStep,
  aboveStep,
  lastStep,
  onDuplicate,
  tooltip,
  align = 'end',
}: DuplicateMenuProps) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(String(belowStep));
  const number = Number(target);
  const valid = Number.isInteger(number) && number >= 1 && number <= lastStep;

  const pick = (place: DuplicatePlace) => {
    setOpen(false);
    onDuplicate(place);
  };

  const trigger = <PopoverTrigger asChild>{children}</PopoverTrigger>;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setTarget(String(belowStep));
      }}
    >
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <PopoverContent align={align} className="w-60 p-1">
        <button type="button" className={ITEM} onClick={() => pick('below')}>
          <ArrowDown size={14} className="shrink-0" />
          <span className="flex-1 text-left">{i18n.t('editor.duplicateBelow')}</span>
          <span className="text-[11px] text-muted-foreground">
            {i18n.t('editor.duplicateLandsAt', [String(belowStep)])}
          </span>
        </button>
        <button type="button" className={ITEM} onClick={() => pick('above')}>
          <ArrowUp size={14} className="shrink-0" />
          <span className="flex-1 text-left">{i18n.t('editor.duplicateAbove')}</span>
          <span className="text-[11px] text-muted-foreground">
            {i18n.t('editor.duplicateLandsAt', [String(aboveStep)])}
          </span>
        </button>
        <div className="my-1 h-px bg-border" />
        <form
          className="flex items-center gap-2 px-2 py-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) pick({ step: number });
          }}
        >
          <label className="flex flex-1 items-center gap-2 text-sm text-foreground">
            {i18n.t('editor.duplicateToStep')}
            <Input
              type="number"
              min={1}
              max={lastStep}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-invalid={!valid}
              className="h-7 w-16 px-2"
            />
          </label>
          <Button type="submit" size="sm" disabled={!valid}>
            {i18n.t('editor.duplicateGo')}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
