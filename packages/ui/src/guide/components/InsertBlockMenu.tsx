import { i18n } from '@mimik/core/env';
import type { BlockType } from '@mimik/core/guides/types';
import { Circle, Heading, Plus, StickyNote } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';

interface InsertBlockMenuProps {
  onInsert: (blockType: BlockType) => void;
  onRecord?: () => void;
}

export default function InsertBlockMenu({ onInsert, onRecord }: InsertBlockMenuProps) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const choices = [
    { type: 'heading' as const, icon: Heading, label: i18n.t('blocks.heading') },
    { type: 'callout' as const, icon: StickyNote, label: i18n.t('blocks.callout') },
  ];

  return (
    <div
      ref={rowRef}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !open) return;
        setOpen(false);
        triggerRef.current?.focus();
      }}
      className="group relative flex items-center justify-center gap-1 h-6 my-1"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            ref={triggerRef}
            onClick={() => setOpen((prev) => !prev)}
            aria-label={i18n.t('blocks.add')}
            aria-expanded={open}
            className={`relative flex items-center justify-center w-5 h-5 rounded-full border border-border bg-card transition-colors hover:text-accent hover:border-accent ${open ? 'text-accent border-accent' : 'text-purple'}`}
          >
            <Plus size={13} />
          </button>
        </TooltipTrigger>
        <TooltipContent>{i18n.t('blocks.add')}</TooltipContent>
      </Tooltip>
      {open &&
        choices.map((choice) => (
          <button
            key={choice.type}
            type="button"
            onClick={() => {
              setOpen(false);
              onInsert(choice.type);
            }}
            className="relative flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-purple hover:text-accent hover:bg-secondary"
          >
            <choice.icon size={13} />
            {choice.label}
          </button>
        ))}
      {open && onRecord && (
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onRecord();
          }}
          className="relative flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-purple hover:text-accent hover:bg-secondary"
        >
          <Circle size={13} />
          {i18n.t('capture.recordSteps')}
        </button>
      )}
    </div>
  );
}
