import {
  MASCOT_ASPECT,
  MASCOT_BODY,
  MASCOT_CROWN,
  MASCOT_CROWN_SPLIT,
  MASCOT_FACES,
  MASCOT_SEAM,
  MASCOT_VIEW_BOX,
} from '@mimik/ui';
import { svg } from './svg';

export function mascot(size = 42): SVGSVGElement {
  const root = svg('svg', {
    viewBox: MASCOT_VIEW_BOX,
    width: size,
    height: Math.round(size * MASCOT_ASPECT),
    'aria-hidden': 'true',
  });
  const clip = svg('clipPath', { id: 'mascot-crown-split' });
  clip.append(svg('path', { d: MASCOT_CROWN_SPLIT }));
  const defs = svg('defs', {});
  defs.append(clip);
  const face = MASCOT_FACES.happy;
  root.append(
    defs,
    svg('rect', { ...MASCOT_BODY, fill: 'var(--deep)' }),
    svg('path', { d: MASCOT_CROWN, fill: 'var(--violet-mid)' }),
    svg('path', { d: MASCOT_CROWN, fill: 'var(--accent)', 'clip-path': 'url(#mascot-crown-split)' }),
    svg('rect', { ...MASCOT_SEAM, fill: 'var(--lavender)' }),
    ...face.eyes.map((d) =>
      svg('path', {
        d,
        stroke: 'var(--lavender)',
        'stroke-width': face.eyeWidth,
        fill: 'none',
        'stroke-linecap': 'round',
      }),
    ),
    svg('path', {
      d: face.mouth,
      stroke: 'var(--lavender)',
      'stroke-width': face.mouthWidth,
      fill: 'none',
      'stroke-linecap': 'round',
    }),
  );
  return root;
}
