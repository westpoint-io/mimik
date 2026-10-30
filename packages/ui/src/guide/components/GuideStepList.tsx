import type { CaptureInsert } from '@mimik/core/capture/capture-insert';
import { i18n } from '@mimik/core/env';
import { isBlock, stepNumbers } from '@mimik/core/guides/blocks';
import { createSnapshot, deleteSteps, insertBlock } from '@mimik/core/guides/service';
import type { BlockType, Screenshot, Step } from '@mimik/core/guides/types';
import { logger } from '@mimik/core/logger';
import { dominantRatio } from '@mimik/core/screenshot/geometry';
import { Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '../../common/components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { useFullview } from '../../stores/use-fullview';
import { BlockCard } from './BlockCard';
import { EmptyGuideState } from './EmptyGuideState';
import { InsertBlockMenu } from './InsertBlockMenu';
import { StepCard } from './StepCard';

const JUMP_SETTLE_MS = 1500;

interface GuideStepListProps {
  guideId: string;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
  onDescriptionChange: (stepId: string, description: string) => void;
  onDelete: (stepId: string) => void;
  onOpenEditor: (stepId: string, tool: 'annotate' | 'redact' | 'crop' | 'target') => void;
  readOnly?: boolean;
  onChanged?: () => void;
  hasApiKey?: boolean;
  onCaptureMore?: (target: CaptureInsert) => void;
}

export function GuideStepList({
  guideId,
  steps,
  screenshots,
  onDescriptionChange,
  onDelete,
  onOpenEditor,
  readOnly,
  onChanged,
  hasApiKey,
  onCaptureMore,
}: GuideStepListProps) {
  const {
    scrollToStepId,
    setActiveStepId,
    bumpHistoryRefresh,
    selectedStepIds,
    toggleStepSelection,
    clearStepSelection,
  } = useFullview((s) => ({
    scrollToStepId: s.scrollToStepId,
    setActiveStepId: s.setActiveStepId,
    bumpHistoryRefresh: s.bumpHistoryRefresh,
    selectedStepIds: s.selectedStepIds,
    toggleStepSelection: s.toggleStepSelection,
    clearStepSelection: s.clearStepSelection,
  }));

  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const stepRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const jumpingTo = useRef<string | null>(null);
  const frameRatio = dominantRatio(screenshots);
  const numbers = stepNumbers(steps);
  const selectedCount = steps.filter((step) => selectedStepIds.has(step.id)).length;
  const recordAt = onCaptureMore
    ? (atIndex: number) => () =>
        onCaptureMore({
          insertTargetGuideId: guideId,
          insertAtIndex: atIndex,
          afterStep: steps.slice(0, atIndex).filter((step) => !isBlock(step)).length,
        })
    : undefined;

  useEffect(() => {
    if (!scrollToStepId) return;
    const target = scrollToStepId;
    const release = () => {
      if (jumpingTo.current === target) jumpingTo.current = null;
    };
    jumpingTo.current = target;
    setActiveStepId(target);
    document.addEventListener('scrollend', release, { once: true });
    setTimeout(release, JUMP_SETTLE_MS);
    stepRefs.current.get(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [scrollToStepId, setActiveStepId]);

  useEffect(() => {
    if (steps.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (jumpingTo.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveStepId(entry.target.getAttribute('data-step-id'));
          }
        }
      },
      { threshold: 0.5 },
    );
    for (const el of stepRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [steps, setActiveStepId]);

  useEffect(() => {
    if (readOnly) clearStepSelection();
  }, [readOnly, clearStepSelection]);

  const handleInsertBlock = async (atIndex: number, blockType: BlockType) => {
    await insertBlock(guideId, atIndex, blockType, '');
    onChanged?.();
  };

  const handleBulkDelete = async () => {
    setConfirmBulkDelete(false);
    const ids = steps.filter((step) => selectedStepIds.has(step.id)).map((step) => step.id);
    try {
      if (await createSnapshot(guideId)) bumpHistoryRefresh();
    } catch (err) {
      logger.error(' Snapshot before bulk delete failed', err);
    }
    await deleteSteps(guideId, ids);
    clearStepSelection();
    onChanged?.();
  };

  if (steps.length === 0) {
    return (
      <div className="flex flex-col">
        <EmptyGuideState />
        {!readOnly && (
          <InsertBlockMenu onInsert={(blockType) => handleInsertBlock(0, blockType)} onRecord={recordAt?.(0)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!readOnly && (
        <InsertBlockMenu onInsert={(blockType) => handleInsertBlock(0, blockType)} onRecord={recordAt?.(0)} />
      )}
      {steps.map((step, idx) => (
        <div
          key={step.id}
          ref={(el) => {
            if (el) stepRefs.current.set(step.id, el);
            else stepRefs.current.delete(step.id);
          }}
          data-step-id={step.id}
        >
          <div className="flex items-start gap-2">
            {!readOnly && (
              <input
                type="checkbox"
                checked={selectedStepIds.has(step.id)}
                onChange={() => {}}
                onClick={(e) => toggleStepSelection(steps, step.id, e.shiftKey)}
                aria-label={i18n.t('editor.selectStep')}
                className="mt-3 shrink-0 w-4 h-4 accent-accent"
              />
            )}
            <div className="flex-1 min-w-0">
              {isBlock(step) ? (
                <BlockCard
                  step={step}
                  onDescriptionChange={onDescriptionChange}
                  onDelete={onDelete}
                  onChanged={onChanged}
                  readOnly={readOnly}
                />
              ) : (
                <StepCard
                  step={step}
                  number={numbers.get(step.id) ?? 0}
                  screenshot={screenshots.get(step.id)}
                  placeholderRatio={frameRatio}
                  frameRatio={frameRatio}
                  onDescriptionChange={onDescriptionChange}
                  onDelete={onDelete}
                  onOpenEditor={onOpenEditor}
                  readOnly={readOnly}
                  hasApiKey={hasApiKey}
                  onChanged={onChanged}
                />
              )}
            </div>
          </div>
          {!readOnly && (
            <InsertBlockMenu
              onInsert={(blockType) => handleInsertBlock(idx + 1, blockType)}
              onRecord={recordAt?.(idx + 1)}
            />
          )}
        </div>
      ))}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-lg">
          <span className="text-[12px] font-medium text-foreground">
            {i18n.t('editor.selectedCount', [String(selectedCount)])}
          </span>
          <Button variant="ghost" size="sm" onClick={clearStepSelection}>
            {i18n.t('common.cancel')}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setConfirmBulkDelete(true)}>
            <Trash2 size={13} />
            {i18n.t('common.delete')}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmBulkDelete}
        heading={
          selectedCount === 1
            ? i18n.t('editor.deleteSelectedStep', ['1'])
            : i18n.t('editor.deleteSelectedSteps', [String(selectedCount)])
        }
        destructive
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  );
}
