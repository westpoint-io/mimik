import {
  MASCOT_ASPECT,
  MASCOT_BODY,
  MASCOT_CROWN,
  MASCOT_CROWN_SPLIT,
  MASCOT_FACES,
  MASCOT_SEAM,
  MASCOT_VIEW_BOX,
  type MascotPose,
} from '../lib/mascot-shapes';

interface MascotIconProps {
  size?: number;
  pose?: MascotPose;
  tone?: 'brand' | 'muted';
}

export function MascotIcon({ size = 22, pose = 'happy', tone = 'brand' }: MascotIconProps) {
  const muted = tone === 'muted';
  const body = muted ? 'fill-current opacity-55' : 'fill-primary';
  const crown = muted ? 'fill-current opacity-80' : 'fill-violet-mid';
  const seam = muted ? 'fill-current opacity-25' : 'fill-lavender';
  const feature = muted ? 'fill-card stroke-card' : 'fill-lavender stroke-lavender';
  const face = MASCOT_FACES[pose];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={MASCOT_VIEW_BOX}
      width={size}
      height={Math.round(size * MASCOT_ASPECT)}
      className="block shrink-0"
      aria-hidden="true"
    >
      <defs>
        <clipPath id="mascot-crown-split">
          <path d={MASCOT_CROWN_SPLIT} />
        </clipPath>
      </defs>
      <rect {...MASCOT_BODY} className={body} />
      <path d={MASCOT_CROWN} className={crown} />
      {!muted && <path d={MASCOT_CROWN} className="fill-accent" clipPath="url(#mascot-crown-split)" />}
      <rect {...MASCOT_SEAM} className={seam} />

      {'pupils' in face
        ? face.pupils.map((pupil) => <circle key={pupil.cx} {...pupil} className={feature} strokeWidth="0" />)
        : face.eyes.map((eye) => (
            <path key={eye} d={eye} className={feature} strokeWidth={face.eyeWidth} fill="none" strokeLinecap="round" />
          ))}
      <path d={face.mouth} className={feature} strokeWidth={face.mouthWidth} fill="none" strokeLinecap="round" />
    </svg>
  );
}
