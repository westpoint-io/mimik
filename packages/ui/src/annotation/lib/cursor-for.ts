import type { EditorMode, EditorTool } from '../types';

export function cursorFor(mode: EditorMode, tool: EditorTool, hovering: boolean, grabbing: boolean): string {
  if (grabbing) return 'grabbing';
  if (mode !== 'annotate') return 'crosshair';
  if (hovering) return 'grab';
  if (tool === 'select') return 'default';
  if (tool === 'text') return 'text';
  return 'crosshair';
}
