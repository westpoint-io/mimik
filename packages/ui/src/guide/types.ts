import type { Screenshot, Step } from '@mimik/core/guides/types';

export interface DragHandleProps {
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

export interface PreviewData {
  snapshotId: string;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
}
