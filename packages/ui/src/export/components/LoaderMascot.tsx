import {
  CAMERA_MASCOT_DROP,
  CAMERA_MASCOT_PARTS,
  CAMERA_MASCOT_VIEW_BOX,
  MASCOT_BODY,
  MASCOT_CROWN,
  MASCOT_CROWN_SPLIT,
  MASCOT_FACES,
  MASCOT_SEAM,
} from '../../common/lib/mascot-shapes';

const WAVES = ['M6 20 Q12 28 6 36', 'M16 12 Q26 28 16 44', 'M26 4 Q40 28 26 52'];
const MOVE = 'transition duration-500 ease-[cubic-bezier(.2,.9,.3,1.2)] motion-reduce:transition-none';

export function LoaderMascot({ filming, size = 128 }: { filming: boolean; size?: number }) {
  const face = MASCOT_FACES.happy;
  const camera = CAMERA_MASCOT_PARTS;
  return (
    <span className="relative inline-flex" aria-hidden="true">
      <svg viewBox={CAMERA_MASCOT_VIEW_BOX} width={size} height={size} fill="none">
        <defs>
          <clipPath id="loader-mascot-crown">
            <path d={MASCOT_CROWN_SPLIT} />
          </clipPath>
        </defs>
        <g className={MOVE} style={{ transform: `translateY(${filming ? CAMERA_MASCOT_DROP : 0}px)` }}>
          <rect {...MASCOT_BODY} className="fill-primary" />
          <path d={MASCOT_CROWN} className="fill-violet-mid" />
          <path d={MASCOT_CROWN} className="fill-mascot" clipPath="url(#loader-mascot-crown)" />
          <rect {...MASCOT_SEAM} className="fill-lavender" />
          {face.eyes.map((eye) => (
            <path
              key={eye}
              d={eye}
              className="stroke-lavender"
              strokeWidth={face.eyeWidth}
              fill="none"
              strokeLinecap="round"
            />
          ))}
          <g className={`transition-opacity duration-300 ${filming ? 'opacity-0' : 'opacity-100'}`}>
            <ellipse cx="100" cy="142" rx="11" ry="6" className="fill-lavender animate-talk [transform-box:fill-box]" />
          </g>
          <path
            d={face.mouth}
            className={`stroke-lavender transition-opacity duration-300 ${filming ? 'opacity-100 delay-200' : 'opacity-0'}`}
            strokeWidth={face.mouthWidth}
            fill="none"
            strokeLinecap="round"
          />
        </g>
        <g className={MOVE} style={{ opacity: filming ? 1 : 0, transform: `translateY(${filming ? 0 : -70}px)` }}>
          <rect {...camera.body} className="fill-violet-mid stroke-violet-mid" strokeWidth={2} />
          <circle {...camera.lensRing} className="fill-primary stroke-violet-mid" strokeWidth={2} />
          <circle {...camera.lens} fill="#080818" />
          <circle {...camera.glint} className="fill-lavender" opacity={0.4} />
          <rect {...camera.flashUnit} className="fill-lavender" opacity={0.7} />
          <circle {...camera.flash} className="fill-lavender animate-[cam-flash_3s_ease_infinite]" />
          <circle {...camera.light} className="fill-mascot" />
          {camera.hands.map((hand) => (
            <ellipse key={hand.cx} {...hand} className="fill-primary" />
          ))}
        </g>
      </svg>
      <svg
        viewBox="0 0 40 56"
        width={Math.round(size * 0.3)}
        className={`absolute left-full top-[40%] -ml-2 stroke-primary ${MOVE} ${filming ? '-translate-x-3 opacity-0' : 'opacity-100'}`}
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
      >
        {WAVES.map((d, i) => (
          <path key={d} d={d} className="animate-wave" style={{ animationDelay: `${i * 200}ms` }} />
        ))}
      </svg>
    </span>
  );
}
