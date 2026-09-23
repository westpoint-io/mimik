import type { EditorMode, EditorTool } from '../types';

export function modeForTool(tool: EditorTool): EditorMode {
  if (tool === 'crop') return 'crop';
  if (tool === 'redact') return 'redact';
  return 'annotate';
}
