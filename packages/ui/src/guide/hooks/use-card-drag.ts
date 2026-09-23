import { useRef } from 'react';
import type { DragHandleProps } from '../types';

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
