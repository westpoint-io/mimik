import type { VideoResolution } from '@/core/export/options';

export const FRAME_WIDTH = 1280;
export const FRAME_HEIGHT = 720;

export const FRAME_FILL = '#0B0A1F';

export const FPS = 30;
export const STEP_ZOOMED_OUT_SEC = 1.5;
export const STEP_ZOOM_TRANSITION_SEC = 0.73;
export const STEP_ZOOMED_IN_SEC = 3;
export const STEP_SECONDS = STEP_ZOOMED_OUT_SEC + STEP_ZOOM_TRANSITION_SEC + STEP_ZOOMED_IN_SEC;

export const COVER_SECONDS = 3;

export const TRANSITION_SECONDS = 0.33;

export const VOICE_LEAD_SEC = 0.35;
export const VOICE_TAIL_SEC = 0.6;

export interface VideoTimeline {
  coverSeconds: number;
  stepSeconds: number[];
}

export function uniformTimeline(stepCount: number): VideoTimeline {
  return { coverSeconds: COVER_SECONDS, stepSeconds: Array.from({ length: stepCount }, () => STEP_SECONDS) };
}

export function narratedSeconds(clipSeconds: number): number {
  return VOICE_LEAD_SEC + clipSeconds + VOICE_TAIL_SEC;
}

export function videoSeconds(stepCount: number, cover: boolean, timeline?: VideoTimeline): number {
  if (stepCount <= 0) return 0;
  const plan = timeline ?? uniformTimeline(stepCount);
  const held = Array.from({ length: stepCount }, (_, index) =>
    Math.max(STEP_SECONDS, plan.stepSeconds[index] ?? STEP_SECONDS),
  ).reduce((total, seconds) => total + seconds, 0);
  const cards = cover ? plan.coverSeconds + COVER_SECONDS : 0;
  return held - (stepCount - 1) * TRANSITION_SECONDS + cards;
}

export function voiceTimeline(stepCount: number, clipSeconds: Map<number, number>, coverIndex = -1): VideoTimeline {
  const cover = clipSeconds.get(coverIndex);
  return {
    coverSeconds: cover === undefined ? COVER_SECONDS : Math.max(COVER_SECONDS, narratedSeconds(cover)),
    stepSeconds: Array.from({ length: stepCount }, (_, index) => {
      const clip = clipSeconds.get(index);
      return clip === undefined ? STEP_SECONDS : Math.max(STEP_SECONDS, narratedSeconds(clip));
    }),
  };
}

export interface ResolutionSpec {
  width: number;
  height: number;
  avc: string;
  vp9: string;
}

export const RESOLUTION_SPECS: Record<VideoResolution, ResolutionSpec> = {
  '720p': { width: 1280, height: 720, avc: 'avc1.64001f', vp9: 'vp09.00.31.08' },
  '1080p': { width: 1920, height: 1080, avc: 'avc1.640028', vp9: 'vp09.00.40.08' },
};

export const AVC_CODEC = RESOLUTION_SPECS['720p'].avc;
export const VP9_CODEC = RESOLUTION_SPECS['720p'].vp9;

export type VideoContainer = 'mp4' | 'webm';

async function encodes(codec: string, width: number, height: number): Promise<boolean> {
  try {
    const { supported } = await VideoEncoder.isConfigSupported({ codec, width, height });
    return Boolean(supported);
  } catch {
    return false;
  }
}

async function probe(spec: ResolutionSpec): Promise<VideoContainer | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  if (await encodes(spec.avc, spec.width, spec.height)) return 'mp4';
  return (await encodes(spec.vp9, spec.width, spec.height)) ? 'webm' : null;
}

const pending = new Map<VideoResolution, Promise<VideoContainer | null>>();

export function pickContainer(resolution: VideoResolution = '720p'): Promise<VideoContainer | null> {
  const cached = pending.get(resolution);
  if (cached) return cached;
  const next = probe(RESOLUTION_SPECS[resolution]);
  pending.set(resolution, next);
  return next;
}

export async function canExportVideo(): Promise<boolean> {
  return (await pickContainer()) !== null;
}
