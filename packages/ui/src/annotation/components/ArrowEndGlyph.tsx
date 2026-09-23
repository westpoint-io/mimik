import type { ArrowEnd } from '@mimik/core/screenshot/types';
import type { ReactNode } from 'react';

const ARROW_END_MARKS: Record<ArrowEnd, ReactNode> = {
  none: null,
  bar: <line x1="25" y1="2" x2="25" y2="10" />,
  arrow: <polyline points="19,2 25,6 19,10" fill="none" />,
  'arrow-solid': <polygon points="26,6 18,2 18,10" stroke="none" />,
  circle: <circle cx="22" cy="6" r="3.5" fill="none" />,
  'circle-solid': <circle cx="22" cy="6" r="3.5" stroke="none" />,
  square: <rect x="18.5" y="2.5" width="7" height="7" fill="none" />,
  'square-solid': <rect x="18.5" y="2.5" width="7" height="7" stroke="none" />,
};

export function ArrowEndGlyph({ end }: { end: ArrowEnd }) {
  return (
    <svg
      width="30"
      height="12"
      viewBox="0 0 30 12"
      stroke="currentColor"
      strokeWidth="1.6"
      fill="currentColor"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2={end === 'none' ? 27 : 19} y2="6" />
      {ARROW_END_MARKS[end]}
    </svg>
  );
}
