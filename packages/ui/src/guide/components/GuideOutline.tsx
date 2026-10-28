import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { i18n } from '@mimik/core/env';
import { stepNumbers } from '@mimik/core/guides/blocks';
import { moveSteps } from '@mimik/core/guides/move-steps';
import { reorderSteps } from '@mimik/core/guides/service';
import type { Step } from '@mimik/core/guides/types';
import { logger } from '@mimik/core/logger';
import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { useFullview } from '../../stores/use-fullview';
import { outlineLabel } from '../lib/outline-label';
import { OutlineRow } from './OutlineRow';

interface GuideOutlineProps {
  guideId: string;
  steps: Step[];
  readOnly: boolean;
  wide: boolean;
  onReorder: (steps: Step[]) => void;
}

export function GuideOutline({ guideId, steps, readOnly, wide, onReorder }: GuideOutlineProps) {
  const { activeStepId, scrollToStep, collapsed, drawerOpen, setDrawerOpen, selected, toggleStepSelection } =
    useFullview((s) => ({
      activeStepId: s.activeStepId,
      scrollToStep: s.scrollToStep,
      collapsed: s.outlineCollapsed,
      drawerOpen: s.outlineDrawerOpen,
      setDrawerOpen: s.setOutlineDrawerOpen,
      selected: s.selectedStepIds,
      toggleStepSelection: s.toggleStepSelection,
    }));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  useEffect(() => {
    if (wide && drawerOpen) setDrawerOpen(false);
  }, [wide, drawerOpen, setDrawerOpen]);

  const numbers = stepNumbers(steps);
  const ids = steps.map((s) => s.id);
  const nameOf = (id: string) => {
    const step = steps.find((s) => s.id === id);
    if (!step) return '';
    const n = numbers.get(id);
    return n ? `${n}. ${outlineLabel(step)}` : outlineLabel(step);
  };
  const groupOf = (id: string) =>
    selected.has(id) && selected.size > 1 ? steps.filter((s) => selected.has(s.id)).map((s) => s.id) : [id];
  const dragging = draggingId ? groupOf(draggingId) : [];

  const handleDragStart = ({ active }: DragStartEvent) => setDraggingId(String(active.id));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const from = steps.findIndex((s) => s.id === activeId);
    const to = steps.findIndex((s) => s.id === overId);
    const next = moveSteps(steps, groupOf(activeId), overId, from < to);
    if (next === steps) return;
    reorderSteps(
      guideId,
      next.map((s) => s.id),
    ).catch((err) => logger.error(' Reordering steps failed', err));
    onReorder(next);
  };

  const activate = (step: Step, e: React.MouseEvent | React.KeyboardEvent) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      if (!readOnly) toggleStepSelection(steps, step.id, e.shiftKey);
      return;
    }
    scrollToStep(step.id);
    if (!wide) setDrawerOpen(false);
  };

  const list = (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
      accessibility={{
        screenReaderInstructions: { draggable: i18n.t('outline.instructions') },
        announcements: {
          onDragStart: ({ active }) => i18n.t('outline.pickedUp', [nameOf(String(active.id))]),
          onDragOver: ({ active, over }) =>
            over ? i18n.t('outline.movedOver', [nameOf(String(active.id)), nameOf(String(over.id))]) : undefined,
          onDragEnd: ({ active, over }) =>
            over
              ? i18n.t('outline.droppedOver', [nameOf(String(active.id)), nameOf(String(over.id))])
              : i18n.t('outline.dropped', [nameOf(String(active.id))]),
          onDragCancel: ({ active }) => i18n.t('outline.cancelled', [nameOf(String(active.id))]),
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-0.5 min-w-0">
          {steps.map((step) => (
            <OutlineRow
              key={step.id}
              step={step}
              number={numbers.get(step.id)}
              active={step.id === activeStepId}
              selected={selected.has(step.id)}
              dimmed={dragging.includes(step.id) && step.id !== draggingId}
              disabled={readOnly}
              onActivate={(e) => activate(step, e)}
            />
          ))}
        </div>
      </SortableContext>
      {createPortal(
        <DragOverlay>
          {draggingId && (
            <div className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-2 text-[13px] text-foreground shadow-lg border border-border">
              <span className="truncate">{nameOf(draggingId)}</span>
              {dragging.length > 1 && (
                <span className="shrink-0 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
                  {i18n.t('outline.moreSelected', [String(dragging.length - 1)])}
                </span>
              )}
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );

  if (wide) {
    if (collapsed) return null;
    return (
      <aside
        aria-label={i18n.t('outline.title')}
        className="sticky top-20 w-[280px] shrink-0 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2"
      >
        <div className="mb-2 px-3 text-[15px] font-semibold text-foreground">{i18n.t('outline.title')}</div>
        {list}
      </aside>
    );
  }

  return (
    <Dialog
      open={drawerOpen}
      onOpenChange={(open) => {
        if (!open && draggingId) return;
        setDrawerOpen(open);
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="top-0 left-0 translate-x-0 translate-y-0 flex flex-col h-full w-[320px] max-w-none sm:max-w-none rounded-none border-0 bg-card p-0 gap-0 shadow-xl data-[state=open]:animate-drawer-in data-[state=closed]:animate-drawer-out"
      >
        <div className="flex items-center justify-between pl-5 pr-4 pt-[18px] pb-3.5">
          <DialogPrimitive.Title className="text-[15px] font-semibold text-foreground">
            {i18n.t('outline.title')}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label={i18n.t('common.close')}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X size={16} />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">{list}</div>
      </DialogContent>
    </Dialog>
  );
}
