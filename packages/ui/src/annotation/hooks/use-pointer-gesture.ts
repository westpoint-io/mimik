import type { ScreenshotBounds } from '@mimik/core/guides/types';
import type { Annotation } from '@mimik/core/screenshot/types';
import { useState } from 'react';

export interface PointerGesture {
  draft: Annotation | null;
  setDraft: (next: Annotation | null) => void;
  cropDraft: ScreenshotBounds | null;
  setCropDraft: (next: ScreenshotBounds | null) => void;
  hovering: boolean;
  setHovering: (next: boolean) => void;
  grabbing: boolean;
  setGrabbing: (next: boolean) => void;
  anchor: { x: number; y: number } | null;
  setAnchor: (next: { x: number; y: number } | null) => void;
  clear: () => void;
}

export function usePointerGesture(): PointerGesture {
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [cropDraft, setCropDraft] = useState<ScreenshotBounds | null>(null);
  const [hovering, setHovering] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const clear = () => {
    setDraft(null);
    setCropDraft(null);
  };

  return {
    draft,
    setDraft,
    cropDraft,
    setCropDraft,
    hovering,
    setHovering,
    grabbing,
    setGrabbing,
    anchor,
    setAnchor,
    clear,
  };
}
