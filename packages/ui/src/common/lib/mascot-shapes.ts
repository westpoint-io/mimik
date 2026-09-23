export const MASCOT_VIEW_BOX = '20 50 160 120';
export const MASCOT_ASPECT = 120 / 160;

export const MASCOT_BODY = { x: 30, y: 95, width: 140, height: 68, rx: 5 };
export const MASCOT_SEAM = { x: 30, y: 93, width: 140, height: 3 };
export const MASCOT_CROWN = 'M30 95 L30 80 Q30 60, 100 60 Q170 60, 170 80 L170 95 Z';
export const MASCOT_CROWN_SPLIT = 'M30 95 L170 60 L170 95 Z';

export const MASCOT_FACES = {
  happy: {
    eyes: ['M68 122 Q76 112 84 122', 'M116 122 Q124 112 132 122'],
    eyeWidth: 5,
    mouth: 'M84 138 Q100 148 116 138',
    mouthWidth: 3.5,
  },
  lookaway: {
    pupils: [
      { cx: 80, cy: 124, r: 5 },
      { cx: 128, cy: 124, r: 5 },
    ],
    mouth: 'M86 141 Q100 136 116 141',
    mouthWidth: 3.5,
  },
} as const;

export type MascotPose = keyof typeof MASCOT_FACES;
