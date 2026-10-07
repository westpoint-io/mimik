import { GripVertical } from 'lucide-react';

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
