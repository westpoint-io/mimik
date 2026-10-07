export const MIC_BAR_MIN_SCALE = 0.14;

export interface MicBar {
  id: string;
  weight: number;
}

export const MIC_BARS: MicBar[] = [
  { id: 'far-left', weight: 0.45 },
  { id: 'left', weight: 0.75 },
  { id: 'center', weight: 1 },
  { id: 'right', weight: 0.75 },
  { id: 'far-right', weight: 0.45 },
];

export function micBarScale(level: number, weight: number): number {
  const bounded = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
  return MIC_BAR_MIN_SCALE + (1 - MIC_BAR_MIN_SCALE) * bounded * weight;
}
