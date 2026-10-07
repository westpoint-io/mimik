import type { Guide, Step } from '@/core/guides/types';

export const COVER_SEGMENT = -1;

export const MAX_SEGMENT_CHARS = 600;

export interface VoiceoverSegment {
  index: number;
  text: string;
}

export function narrationText(value: string | undefined): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= MAX_SEGMENT_CHARS) return text;
  const cut = text.slice(0, MAX_SEGMENT_CHARS);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(', '), cut.lastIndexOf(' '));
  return (stop > MAX_SEGMENT_CHARS / 2 ? cut.slice(0, stop) : cut).trim();
}

export function stepNarration(step: Step): string {
  return narrationText(step.description);
}

export function voiceoverScript(guide: Guide, frames: Step[], cover: boolean): VoiceoverSegment[] {
  const segments: VoiceoverSegment[] = [];

  if (cover) {
    const title = narrationText(guide.title);
    if (title) segments.push({ index: COVER_SEGMENT, text: title });
  }

  frames.forEach((step, index) => {
    const text = stepNarration(step);
    if (text) segments.push({ index, text });
  });

  return segments;
}
