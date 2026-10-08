import {
  CAMERA_MASCOT_DROP,
  CAMERA_MASCOT_PARTS,
  CAMERA_MASCOT_VIEW_BOX,
  MASCOT_BODY,
  MASCOT_CROWN,
  MASCOT_FACES,
  MASCOT_SEAM,
} from '../lib/mascot-shapes';

const FLASH = {
  loop: 'animate-[cam-flash_3s_ease_infinite]',
  off: 'opacity-0',
  shutter: 'opacity-0 animate-[shutter_0.4s_ease-out]',
} as const;

interface CameraMascotProps {
  size?: number;
  flash?: keyof typeof FLASH;
}

export function CameraMascot({ size = 64, flash = 'loop' }: CameraMascotProps) {
  const face = MASCOT_FACES.happy;
  const camera = CAMERA_MASCOT_PARTS;
  return (
    <svg viewBox={CAMERA_MASCOT_VIEW_BOX} width={size} height={size} fill="none" aria-hidden="true">
      <g transform={`translate(0 ${CAMERA_MASCOT_DROP})`}>
        <rect {...MASCOT_BODY} className="fill-primary" />
        <path d={MASCOT_CROWN} className="fill-violet-mid" />
        <rect {...MASCOT_SEAM} className="fill-lavender" />
        {face.eyes.map((d) => (
          <path
            key={d}
            d={d}
            className="stroke-lavender"
            strokeWidth={face.eyeWidth}
            fill="none"
            strokeLinecap="round"
          />
        ))}
        <path
          d={face.mouth}
          className="stroke-lavender"
          strokeWidth={face.mouthWidth}
          fill="none"
          strokeLinecap="round"
        />
      </g>
      <rect {...camera.body} className="fill-violet-mid stroke-violet-mid" strokeWidth={2} />
      <circle {...camera.lensRing} className="fill-primary stroke-violet-mid" strokeWidth={2} />
      <circle {...camera.lens} fill="#080818" />
      <circle {...camera.glint} className="fill-lavender" opacity={0.4} />
      <rect {...camera.flashUnit} className="fill-lavender" opacity={0.7} />
      <circle {...camera.flash} className={`fill-lavender ${FLASH[flash]}`} />
      <circle {...camera.light} className="fill-mascot" />
      {camera.hands.map((hand) => (
        <ellipse key={hand.cx} {...hand} className="fill-primary" />
      ))}
    </svg>
  );
}
