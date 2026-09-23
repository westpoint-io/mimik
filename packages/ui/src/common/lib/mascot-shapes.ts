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

export const CAMERA_MASCOT_VIEW_BOX = '0 0 200 200';
export const CAMERA_MASCOT_DROP = 10;

export const CAMERA_MASCOT_PARTS = {
  body: { x: 60, y: 38, width: 80, height: 50, rx: 8 },
  lensRing: { cx: 100, cy: 62, r: 16 },
  lens: { cx: 100, cy: 62, r: 9 },
  glint: { cx: 100, cy: 62, r: 4 },
  flashUnit: { x: 112, y: 42, width: 18, height: 8, rx: 3 },
  flash: { cx: 121, cy: 38, r: 20 },
  light: { cx: 80, cy: 42, r: 5 },
  hands: [
    { cx: 54, cy: 64, rx: 10, ry: 8 },
    { cx: 146, cy: 64, rx: 10, ry: 8 },
  ],
} as const;
