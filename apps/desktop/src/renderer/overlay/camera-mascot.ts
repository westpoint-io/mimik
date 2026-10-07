import {
  CAMERA_MASCOT_DROP,
  CAMERA_MASCOT_PARTS,
  CAMERA_MASCOT_VIEW_BOX,
  MASCOT_BODY,
  MASCOT_CROWN,
  MASCOT_FACES,
  MASCOT_SEAM,
} from '@mimik/ui/common/lib/mascot-shapes';
import { svg } from './svg';

export function cameraMascot(size: number): SVGSVGElement {
  const face = MASCOT_FACES.happy;
  const camera = CAMERA_MASCOT_PARTS;
  const line = (d: string, width: number) =>
    svg('path', { d, stroke: 'var(--lavender)', 'stroke-width': width, fill: 'none', 'stroke-linecap': 'round' });
  const base = svg('g', { transform: `translate(0 ${CAMERA_MASCOT_DROP})` });
  base.append(
    svg('rect', { ...MASCOT_BODY, fill: 'var(--deep)' }),
    svg('path', { d: MASCOT_CROWN, fill: 'var(--violet-mid)' }),
    svg('rect', { ...MASCOT_SEAM, fill: 'var(--lavender)' }),
    ...face.eyes.map((d) => line(d, face.eyeWidth)),
    line(face.mouth, face.mouthWidth),
  );
  const root = svg('svg', { viewBox: CAMERA_MASCOT_VIEW_BOX, width: size, height: size, 'aria-hidden': 'true' });
  root.append(
    base,
    svg('rect', { ...camera.body, fill: 'var(--violet-mid)', stroke: 'var(--violet-mid)', 'stroke-width': 2 }),
    svg('circle', { ...camera.lensRing, fill: 'var(--deep)', stroke: 'var(--violet-mid)', 'stroke-width': 2 }),
    svg('circle', { ...camera.lens, fill: '#080818' }),
    svg('circle', { ...camera.glint, fill: 'var(--lavender)', opacity: 0.4 }),
    svg('rect', { ...camera.flashUnit, fill: 'var(--lavender)', opacity: 0.7 }),
    svg('circle', { ...camera.flash, fill: 'var(--lavender)', class: 'flash' }),
    svg('circle', { ...camera.light, fill: 'var(--accent)' }),
    ...camera.hands.map((hand) => svg('ellipse', { ...hand, fill: 'var(--deep)' })),
  );
  return root;
}
