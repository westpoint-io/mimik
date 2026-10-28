import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { i18n } from '@mimik/core/env';
import { calloutAccent, tint } from '@mimik/core/guides/blocks';
import type { Step } from '@mimik/core/guides/types';
import { Check } from 'lucide-react';
import { outlineLabel } from '../lib/outline-label';

interface OutlineRowProps {
  step: Step;
  number?: number;
  active: boolean;
  selected: boolean;
  dimmed: boolean;
  disabled: boolean;
  onActivate: (e: React.MouseEvent | React.KeyboardEvent) => void;
}

export function OutlineRow({ step, number, active, selected, dimmed, disabled, onActivate }: OutlineRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
    disabled,
  });
  const heading = step.blockType === 'heading';
  const callout = step.blockType === 'callout';
  const accent = callout ? calloutAccent(step) : undefined;
  const tone = active
    ? 'bg-secondary text-foreground'
    : heading || selected
      ? 'text-foreground hover:bg-secondary/60'
      : 'text-foreground/80 hover:bg-secondary/60';
  const layout = heading ? 'mt-3 first:mt-0 py-1.5 text-[13px] font-semibold' : 'py-2.5 text-[13px] leading-snug';

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      aria-disabled={false}
      {...listeners}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isDragging) {
          onActivate(e);
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
      data-step-id={step.id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        background: callout && accent && !active ? tint(accent) : undefined,
      }}
      className={`flex items-start gap-2.5 min-w-0 rounded-[10px] px-3 select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border ${disabled ? 'cursor-pointer' : 'cursor-grab'} ${layout} ${tone} ${dimmed || isDragging ? 'opacity-40' : ''}`}
    >
      {number !== undefined && (
        <span
          className={`flex items-center justify-center w-[22px] h-[22px] shrink-0 rounded-full text-[11px] font-bold tabular-nums ${active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}
        >
          {number}
        </span>
      )}
      {accent && <span className="w-2 h-2 mt-1.5 rounded-full shrink-0" style={{ background: accent }} />}
      <span className="flex-1 min-w-0 line-clamp-2 break-words">{outlineLabel(step)}</span>
      {selected && (
        <span
          role="img"
          aria-label={i18n.t('outline.selected')}
          className="shrink-0 mt-0.5 flex items-center justify-center w-4 h-4 rounded bg-primary text-primary-foreground"
        >
          <Check size={11} strokeWidth={3} />
        </span>
      )}
    </div>
  );
}
