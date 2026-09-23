import { i18n } from '@mimik/core/env';
import { isBlock, stepNumbers } from '@mimik/core/guides/blocks';
import { createSnapshot, deleteSteps, insertBlock, reorderSteps } from '@mimik/core/guides/service';
import type { BlockType, Screenshot, Step } from '@mimik/core/guides/types';
import { logger } from '@mimik/core/logger';
import { dominantRatio } from '@mimik/core/screenshot/geometry';
import ConfirmDialog from '@mimik/ui/common/components/ConfirmDialog';
import { Button } from '@mimik/ui/components/ui/button';
import BlockCard from '@mimik/ui/guide/components/BlockCard';
import CaptureTabDialog from '@mimik/ui/guide/components/CaptureTabDialog';
import EmptyGuideState from '@mimik/ui/guide/components/EmptyGuideState';
import InsertBlockMenu from '@mimik/ui/guide/components/InsertBlockMenu';
import StepCard from '@mimik/ui/guide/components/StepCard';
import { useFullview } from '@mimik/ui/stores/fullview';
import { Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface GuideStepListProps {
  guideId: string;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
  onDescriptionChange: (stepId: string, description: string) => void;
  onDelete: (stepId: string) => void;
  onOpenEditor: (stepId: string, tool: 'annotate' | 'redact' | 'crop' | 'target') => void;
  onReorder: (newSteps: Step[]) => void;
  readOnly?: boolean;
  onChanged?: () => void;
  hasApiKey?: boolean;
  onInsertRecording?: (guideId: string, insertAtIndex: number, tabId: number) => void;
}

export default function GuideStepList({
  guideId,
  steps,
  screenshots,
  onDescriptionChange,
  onDelete,
  onOpenEditor,
  onReorder,
  readOnly,
  onChanged,
  hasApiKey,
  onInsertRecording,
}: GuideStepListProps) {
  const { scrollToStepId, setActiveStepId, bumpHistoryRefresh } = useFullview((s) => ({
    scrollToStepId: s.scrollToStepId,
    setActiveStepId: s.setActiveStepId,
    bumpHistoryRefresh: s.bumpHistoryRefresh,
  }));

  const [recordAtIndex, setRecordAtIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const anchorIndex = useRef<number | null>(null);
  const stepRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const frameRatio = dominantRatio(screenshots);
  const numbers = stepNumbers(steps);

  useEffect(() => {
    if (scrollToStepId) {
      stepRefs.current.get(scrollToStepId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [scrollToStepId]);

  useEffect(() => {
    if (steps.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
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
    if (readOnly) {
      setSelected(new Set());
      anchorIndex.current = null;
    }
  }, [readOnly]);

  const handleDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const newSteps = [...steps];
      const [moved] = newSteps.splice(dragIndex, 1);
      newSteps.splice(dragOverIndex, 0, moved);
      reorderSteps(
        guideId,
        newSteps.map((s) => s.id),
      );
      onReorder(newSteps);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleInsertBlock = async (atIndex: number, blockType: BlockType) => {
    await insertBlock(guideId, atIndex, blockType, '');
    onChanged?.();
  };

  const toggleSelected = (index: number, extend: boolean) => {
    const from = extend && anchorIndex.current !== null ? anchorIndex.current : index;
    anchorIndex.current = index;
    setSelected((prev) => {
      const next = new Set(prev);
      const adding = !prev.has(steps[index].id);
      for (let i = Math.min(from, index); i <= Math.max(from, index); i++) {
        if (adding) next.add(steps[i].id);
        else next.delete(steps[i].id);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setConfirmBulkDelete(false);
    const ids = steps.filter((step) => selected.has(step.id)).map((step) => step.id);
    try {
      if (await createSnapshot(guideId)) bumpHistoryRefresh();
    } catch (err) {
      logger.error(' Snapshot before bulk delete failed', err);
    }
    await deleteSteps(guideId, ids);
    setSelected(new Set());
    anchorIndex.current = null;
    onChanged?.();
  };

  const dragHandlers = (idx: number) =>
    readOnly
      ? undefined
      : {
          onDragStart: (e: React.DragEvent) => {
            setDragIndex(idx);
            e.dataTransfer.effectAllowed = 'move';
          },
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            setDragOverIndex(idx);
          },
          onDragEnd: handleDragEnd,
        };

  const captureDialog = (
    <CaptureTabDialog
      open={recordAtIndex !== null}
      onCancel={() => setRecordAtIndex(null)}
      onStart={(tabId) => {
        const atIndex = recordAtIndex;
        setRecordAtIndex(null);
        if (atIndex !== null) onInsertRecording?.(guideId, atIndex, tabId);
      }}
    />
  );

  if (steps.length === 0) {
    return (
      <div className="flex flex-col">
        <EmptyGuideState />
        {!readOnly && (
          <InsertBlockMenu
            onInsert={(blockType) => handleInsertBlock(0, blockType)}
            onRecord={onInsertRecording && (() => setRecordAtIndex(0))}
          />
        )}
        {captureDialog}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!readOnly && (
        <InsertBlockMenu
          onInsert={(blockType) => handleInsertBlock(0, blockType)}
          onRecord={onInsertRecording && (() => setRecordAtIndex(0))}
        />
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
          {dragOverIndex === idx && dragIndex !== null && dragIndex !== idx && (
            <div className="h-1 bg-accent rounded-full mx-4 mb-2" />
          )}
          <div className="flex items-start gap-2">
            {!readOnly && (
              <input
                type="checkbox"
                checked={selected.has(step.id)}
                onChange={() => {}}
                onClick={(e) => toggleSelected(idx, e.shiftKey)}
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
                  dragHandleProps={dragHandlers(idx)}
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
                  dragHandleProps={dragHandlers(idx)}
                />
              )}
            </div>
          </div>
          {!readOnly && (
            <InsertBlockMenu
              onInsert={(blockType) => handleInsertBlock(idx + 1, blockType)}
              onRecord={onInsertRecording && (() => setRecordAtIndex(idx + 1))}
            />
          )}
        </div>
      ))}
      {captureDialog}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-lg">
          <span className="text-[12px] font-medium text-foreground">
            {i18n.t('editor.selectedCount', [String(selected.size)])}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
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
          selected.size === 1
            ? i18n.t('editor.deleteSelectedStep', ['1'])
            : i18n.t('editor.deleteSelectedSteps', [String(selected.size)])
        }
        destructive
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  );
}
