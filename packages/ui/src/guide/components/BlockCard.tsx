import { i18n } from '@mimik/core/env';
import { CALLOUT_VARIANTS, calloutAccent, DEFAULT_CALLOUT_COLOR, tint, variantLabel } from '@mimik/core/guides/blocks';
import { updateCallout } from '@mimik/core/guides/service';
import type { CalloutVariant, Step } from '@mimik/core/guides/types';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import ConfirmDialog from '../../common/components/ConfirmDialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { useCardDrag } from '../hooks/use-card-drag';
import type { DragHandleProps } from '../types';
import { DragGrip } from './DragGrip';

interface BlockCardProps {
  step: Step;
  onDescriptionChange?: (stepId: string, description: string) => void;
  onDelete?: (stepId: string) => void;
  onChanged?: () => void;
  dragHandleProps?: DragHandleProps;
  readOnly?: boolean;
}

export default function BlockCard({
  step,
  onDescriptionChange,
  onDelete,
  onChanged,
  dragHandleProps,
  readOnly,
}: BlockCardProps) {
  const [description, setDescription] = useState(step.description);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDescription(step.description);
  }, [step.description]);

  const cardDrag = useCardDrag(dragHandleProps);
  const isHeading = step.blockType === 'heading';
  const accent = calloutAccent(step);
  const variant = step.calloutVariant ?? 'info';

  const pickVariant = async (next: CalloutVariant) => {
    await updateCallout(step.id, next, next === 'custom' ? (step.calloutColor ?? DEFAULT_CALLOUT_COLOR) : undefined);
    onChanged?.();
  };

  const pickColor = async (color: string) => {
    await updateCallout(step.id, 'custom', color);
    onChanged?.();
  };

  const textClass = isHeading
    ? 'text-[15px] font-bold leading-tight text-foreground'
    : 'text-[13px] font-medium leading-snug text-foreground';

  return (
    <div
      {...cardDrag}
      onDragOver={(e) => {
        e.preventDefault();
        dragHandleProps?.onDragOver(e);
      }}
      onDragEnd={dragHandleProps?.onDragEnd}
      className="mb-3"
    >
      <div
        className={isHeading ? 'border-b border-foreground pb-1.5' : 'rounded-lg px-3 py-2.5 border-l-[3px]'}
        style={isHeading ? undefined : { borderLeftColor: accent, background: tint(accent) }}
      >
        {readOnly ? (
          <p className={`${textClass} whitespace-pre-wrap`}>{step.description}</p>
        ) : (
          <textarea
            className={`${textClass} w-full resize-none outline-none border-0 bg-transparent p-0`}
            value={description}
            rows={1}
            ref={(el) => {
              if (el) {
                el.style.height = '0';
                el.style.height = `${el.scrollHeight}px`;
              }
            }}
            onChange={(e) => {
              setDescription(e.target.value);
              e.target.style.height = '0';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onBlur={() => {
              if (description !== step.description) onDescriptionChange?.(step.id, description);
            }}
            placeholder={isHeading ? i18n.t('blocks.headingPlaceholder') : i18n.t('blocks.calloutPlaceholder')}
          />
        )}
      </div>
      {!readOnly && (
        <div className="flex items-center gap-1 mt-1">
          {dragHandleProps && <DragGrip />}
          {!isHeading &&
            CALLOUT_VARIANTS.map((option) => (
              <Tooltip key={option}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => pickVariant(option)}
                    aria-label={variantLabel(option)}
                    aria-pressed={variant === option}
                    className={`w-3.5 h-3.5 rounded-full border ${variant === option ? 'border-foreground' : 'border-border'}`}
                    style={{
                      background:
                        option === 'custom' && variant !== 'custom'
                          ? 'linear-gradient(135deg,#DC2626,#4F46E5,#059669)'
                          : calloutAccent({ ...step, calloutVariant: option }),
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent>{variantLabel(option)}</TooltipContent>
              </Tooltip>
            ))}
          {!isHeading && variant === 'custom' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => pickColor(e.target.value)}
                  aria-label={variantLabel('custom')}
                  className="w-5 h-4 bg-transparent border-0 p-0 cursor-pointer"
                />
              </TooltipTrigger>
              <TooltipContent>{variantLabel('custom')}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label={isHeading ? i18n.t('blocks.deleteHeading') : i18n.t('blocks.deleteCallout')}
                className="ml-auto p-1 rounded-md transition-colors text-border hover:text-destructive"
              >
                <Trash2 size={13} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {isHeading ? i18n.t('blocks.deleteHeading') : i18n.t('blocks.deleteCallout')}
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        heading={isHeading ? i18n.t('blocks.deleteHeading') : i18n.t('blocks.deleteCallout')}
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete?.(step.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
