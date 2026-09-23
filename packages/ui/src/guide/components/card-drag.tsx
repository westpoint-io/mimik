import { GripVertical } from 'lucide-react';
import { useRef } from 'react';

export interface DragHandleProps {
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

export function useCardDrag(dragHandleProps?: DragHandleProps) {
  const pressedHandle = useRef(false);
  return {
    draggable: !!dragHandleProps,
    onPointerDownCapture: (e: React.PointerEvent) => {
      pressedHandle.current = !!(e.target as Element).closest('[data-drag-handle]');
    },
    onDragStart: (e: React.DragEvent) => {
      if (!pressedHandle.current) {
        e.preventDefault();
        return;
      }
      dragHandleProps?.onDragStart(e);
    },
  };
}

export function DragGrip() {
  return (
    <span
      data-drag-handle=""
      aria-hidden="true"
      className="shrink-0 p-1 -m-1 cursor-grab text-border hover:text-muted-foreground"
    >
      <GripVertical size={14} />
    </span>
  );
}
