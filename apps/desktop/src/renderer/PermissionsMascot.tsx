import {
  MASCOT_BODY,
  MASCOT_CROWN,
  MASCOT_CROWN_SPLIT,
  MASCOT_FACES,
  MASCOT_SEAM,
} from '@mimik/ui/common/lib/mascot-shapes';

const WIDTH = 84;
const ROWS = [112, 134];

export function PermissionsMascot({ granted }: { granted: boolean[] }) {
  const done = granted.every(Boolean);
  const happy = MASCOT_FACES.happy;
  const waiting = MASCOT_FACES.lookaway;
  return (
    <svg viewBox="20 55 180 112" width={WIDTH} height={Math.round((WIDTH * 112) / 180)} aria-hidden="true">
      <defs>
        <clipPath id="permissions-mascot-split">
          <path d={MASCOT_CROWN_SPLIT} />
        </clipPath>
      </defs>
      <rect {...MASCOT_BODY} className="fill-primary" />
      <path d={MASCOT_CROWN} className="fill-violet-mid" />
      <path d={MASCOT_CROWN} className="fill-mascot" clipPath="url(#permissions-mascot-split)" />
      <rect {...MASCOT_SEAM} className="fill-lavender" />
      {done
        ? happy.eyes.map((d) => (
            <path
              key={d}
              d={d}
              className="stroke-lavender"
              strokeWidth={happy.eyeWidth}
              fill="none"
              strokeLinecap="round"
            />
          ))
        : waiting.pupils.map((pupil) => <circle key={pupil.cx} {...pupil} className="fill-lavender" />)}
      <path
        d={done ? happy.mouth : waiting.mouth}
        className="stroke-lavender"
        strokeWidth={3.5}
        fill="none"
        strokeLinecap="round"
      />
      <rect x={146} y={98} width={48} height={62} rx={6} className="fill-card stroke-primary" strokeWidth={3} />
      <rect x={161} y={92} width={18} height={10} rx={3} className="fill-primary" />
      {ROWS.map((y, row) => (
        <g key={y}>
          {granted[row] ? (
            <>
              <rect x={153} y={y} width={12} height={12} rx={3} className="fill-success" />
              <path
                d={`M156 ${y + 6} l2.5 2.5 l4.5 -5`}
                className="stroke-card"
                strokeWidth={2.2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : (
            <rect x={153} y={y} width={12} height={12} rx={3} className="fill-card stroke-primary" strokeWidth={2} />
          )}
          <path d={`M171 ${y + 6} H186`} className="stroke-lavender" strokeWidth={4} strokeLinecap="round" />
        </g>
      ))}
      <ellipse cx={144} cy={156} rx={10} ry={8} className="fill-primary stroke-card" strokeWidth={2} />
    </svg>
  );
}
